import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { request } from 'undici';
import { config } from './config';

type Headers = Record<string, string>;

// Tokens are signed so /proxy only fetches URLs this server handed out (no open proxy / SSRF).
// Without PROXY_SECRET a random key is used: tokens stop working after a restart.
const secret = config.proxySecret || randomBytes(32).toString('hex');
const sign = (payload: string) => createHmac('sha256', secret).update(payload).digest('base64url');

export const encodeToken = (url: string, headers: Headers) => {
    const payload = Buffer.from(JSON.stringify({ u: url, h: headers, e: Date.now() + config.proxyTokenTtlMs })).toString('base64url');
    return `${payload}.${sign(payload)}`;
};

export function decodeToken(t: string): { u: string; h: Headers } | null {
    const [payload, sig] = t.split('.');
    if (!payload || !sig) return null;
    const expected = Buffer.from(sign(payload));
    const given = Buffer.from(sig);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    try {
        const o = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (typeof o.u !== 'string' || !/^https?:\/\//.test(o.u) || !(o.e > Date.now())) return null;
        return { u: o.u, h: o.h || {} };
    } catch {
        return null;
    }
}

function rewritePlaylist(text: string, baseUrl: string, headers: Headers, proxyBase: string): string {
    const wrap = (ref: string) => {
        const abs = new URL(ref, baseUrl).toString();
        const ext = /\.m3u8(\?|$)/i.test(abs) ? '.m3u8' : '';
        return `${proxyBase}/proxy/${encodeToken(abs, headers)}${ext}`;
    };
    return text
        .split(/\r?\n/)
        .map((line) => {
            if (!line.trim()) return line;
            if (line.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${wrap(u)}"`);
            return wrap(line.trim());
        })
        .join('\n');
}

// Some CDNs serve MPEG-TS segments disguised as images (a tiny WebP/PNG header in front of the
// TS data). Players probing the content see an image, so drop everything before the first TS
// sync byte that repeats every 188 bytes. If no sync is found the data passes through unchanged.
const TS_PACKET = 188;
const SYNC_SCAN = 4096;
function stripImagePrefix(): Transform {
    let head: Buffer | null = Buffer.alloc(0);
    const findSync = (b: Buffer) => {
        for (let i = 0; i < Math.min(b.length, SYNC_SCAN); i++) {
            if (b[i] === 0x47 && b[i + TS_PACKET] === 0x47 && b[i + 2 * TS_PACKET] === 0x47) return i;
        }
        return -1;
    };
    return new Transform({
        transform(chunk: Buffer, _enc, cb) {
            if (!head) return cb(null, chunk);
            head = Buffer.concat([head, chunk]);
            if (head.length < SYNC_SCAN + 3 * TS_PACKET) return cb();
            const i = findSync(head);
            const out = i >= 0 ? head.subarray(i) : head;
            head = null;
            cb(null, out);
        },
        flush(cb) {
            if (head) {
                const i = findSync(head);
                this.push(i >= 0 ? head.subarray(i) : head);
            }
            cb();
        },
    });
}

/** Fetch `url` with `headers`; rewrite HLS playlists, pipe everything else. */
export async function proxyFetch(url: string, headers: Headers, proxyBase: string, res: any, range?: string) {
    const reqHeaders: Headers = { ...headers };
    const looksLikePlaylist = /\.m3u8(\?|$)/i.test(url);
    // Players (ffmpeg/mpv) send "Range: bytes=0-" for playlists too; a 206 would skip the rewrite
    if (range && !looksLikePlaylist) reqHeaders['Range'] = range;
    const up = await request(url, { headers: reqHeaders, maxRedirections: 5 } as any);
    const ct = String(up.headers['content-type'] || '');
    const isPlaylist = /mpegurl/i.test(ct) || looksLikePlaylist;
    if (isPlaylist && (up.statusCode === 200 || up.statusCode === 206)) {
        const text = await up.body.text();
        if (text.startsWith('#EXTM3U')) {
            res.status(200).set('Content-Type', 'application/vnd.apple.mpegurl').set('Cache-Control', 'no-cache');
            return res.send(rewritePlaylist(text, url, headers, proxyBase));
        }
        res.status(200).set('Content-Type', ct).send(text);
        return;
    }
    // Players send "Range: bytes=0-" for segments too, so a 206 from the start counts as whole
    const fromStart = up.statusCode === 200 || (up.statusCode === 206 && /^bytes 0-/.test(String(up.headers['content-range'] || '')));
    const disguised = fromStart && /^image\//i.test(ct);
    if (disguised) {
        // Length changes once the prefix is stripped: answer 200 and let it go chunked
        res.status(200).set('Content-Type', 'video/mp2t');
    } else {
        res.status(up.statusCode);
        for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
            if (up.headers[h]) res.set(h, up.headers[h] as string);
        }
    }
    // pipeline forwards upstream errors instead of crashing the process,
    // and aborts the upstream request when the player disconnects.
    try {
        if (disguised) await pipeline(up.body, stripImagePrefix(), res);
        else await pipeline(up.body, res);
    } catch (e: any) {
        if (e.code !== 'ERR_STREAM_PREMATURE_CLOSE') console.error('[proxy]', e.message);
        res.destroy();
    }
}
