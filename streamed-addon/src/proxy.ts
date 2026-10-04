import { request } from 'undici';

type Headers = Record<string, string>;

export const encodeToken = (url: string, headers: Headers) =>
    Buffer.from(JSON.stringify({ u: url, h: headers })).toString('base64url');

export function decodeToken(t: string): { u: string; h: Headers } | null {
    try {
        const o = JSON.parse(Buffer.from(t, 'base64url').toString('utf8'));
        return typeof o.u === 'string' && /^https?:\/\//.test(o.u) ? { u: o.u, h: o.h || {} } : null;
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

/** Fetch `url` with `headers`; rewrite HLS playlists, pipe everything else. */
export async function proxyFetch(url: string, headers: Headers, proxyBase: string, res: any, range?: string) {
    const reqHeaders: Headers = { ...headers };
    if (range) reqHeaders['Range'] = range;
    const up = await request(url, { headers: reqHeaders, maxRedirections: 5 } as any);
    const ct = String(up.headers['content-type'] || '');
    const isPlaylist = /mpegurl/i.test(ct) || /\.m3u8(\?|$)/i.test(url);
    if (isPlaylist && up.statusCode === 200) {
        const text = await up.body.text();
        if (text.startsWith('#EXTM3U')) {
            res.status(200).set('Content-Type', 'application/vnd.apple.mpegurl').set('Cache-Control', 'no-cache');
            return res.send(rewritePlaylist(text, url, headers, proxyBase));
        }
        res.status(200).set('Content-Type', ct).send(text);
        return;
    }
    res.status(up.statusCode);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
        if (up.headers[h]) res.set(h, up.headers[h] as string);
    }
    up.body.pipe(res);
}
