/**
 * In-memory HLS segment cache with ahead-of-playback prefetch.
 *
 * When a media playlist is proxied, upstream segment URLs are registered.
 * Serving a segment caches it and prefetches the next N segments in the background.
 */

import { request } from 'undici';

const MAX_ENTRIES = parseInt(process.env.SEGMENT_CACHE_MAX_ENTRIES || '200', 10);
const MAX_BYTES = parseInt(process.env.SEGMENT_CACHE_MAX_MB || '256', 10) * 1024 * 1024;
const PREFETCH_COUNT = parseInt(process.env.SEGMENT_CACHE_PREFETCH || '3', 10);
const TTL_MS = parseInt(process.env.SEGMENT_CACHE_TTL_MS || String(30 * 60 * 1000), 10);
const PLAYLIST_TTL_MS = parseInt(process.env.SEGMENT_PLAYLIST_TTL_MS || String(30 * 60 * 1000), 10);

interface CacheEntry {
    data: Buffer;
    contentType: string;
    size: number;
    expireAt: number;
}

interface PlaylistContext {
    urls: string[];
    headers: Record<string, string>;
    expireAt: number;
}

const cache = new Map<string, CacheEntry>();
const playlistBySegmentUrl = new Map<string, PlaylistContext>();
const inflight = new Map<string, Promise<CacheEntry | null>>();

let totalBytes = 0;

function cacheKey(url: string): string {
    return url;
}

function stripFakePngHeader(content: Buffer): Buffer {
    const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (content.length <= 8 || !content.subarray(0, 8).equals(pngSig)) {
        return content;
    }

    const tsPayload = content.subarray(8);
    if (tsPayload.length === 0 || tsPayload[0] !== 0x47) {
        return content;
    }
    if (tsPayload.length > 188 && tsPayload[188] !== 0x47) {
        return content;
    }

    return tsPayload;
}

function cacheDelete(key: string): void {
    const entry = cache.get(key);
    if (!entry) return;
    totalBytes -= entry.size;
    cache.delete(key);
}

function cacheGet(key: string): CacheEntry | undefined {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (entry.expireAt < Date.now()) {
        cacheDelete(key);
        return undefined;
    }
    cache.delete(key);
    cache.set(key, entry);
    return entry;
}

function cacheSet(key: string, entry: CacheEntry): void {
    if (cache.has(key)) {
        cacheDelete(key);
    }

    while (cache.size > 0 && (cache.size >= MAX_ENTRIES || totalBytes + entry.size > MAX_BYTES)) {
        const oldest = cache.keys().next().value;
        if (!oldest) break;
        cacheDelete(oldest);
    }

    if (entry.size > MAX_BYTES) {
        return;
    }

    cache.set(key, entry);
    totalBytes += entry.size;
}

function getPlaylistContext(url: string): PlaylistContext | null {
    const ctx = playlistBySegmentUrl.get(url);
    if (!ctx) return null;
    if (ctx.expireAt < Date.now()) {
        for (const segmentUrl of ctx.urls) {
            playlistBySegmentUrl.delete(segmentUrl);
        }
        return null;
    }
    return ctx;
}

function guessNextSegmentUrls(url: string, count: number): string[] {
    const match = url.match(/^(.*)(\d+)(\.[^./?#]+(?:\?.*)?)$/);
    if (!match) return [];

    const [, prefix, numStr, suffix] = match;
    const num = parseInt(numStr, 10);
    const padLen = numStr.length;
    const results: string[] = [];

    for (let i = 1; i <= count; i++) {
        const nextNum = String(num + i).padStart(padLen, '0');
        results.push(`${prefix}${nextNum}${suffix}`);
    }

    return results;
}

async function fetchSegment(url: string, headers: Record<string, string>): Promise<CacheEntry | null> {
    const key = cacheKey(url);
    const existing = inflight.get(key);
    if (existing) return existing;

    const promise = (async () => {
        try {
            const { body, statusCode, headers: respHeaders } = await request(url, { headers });
            if (statusCode !== 200) {
                return null;
            }

            const raw = Buffer.from(await body.arrayBuffer());
            const data = stripFakePngHeader(raw);
            const contentTypeHeader = respHeaders['content-type'];
            const contentType = Array.isArray(contentTypeHeader)
                ? contentTypeHeader[0]
                : (contentTypeHeader || 'video/mp2t');
            const entry: CacheEntry = {
                data,
                contentType,
                size: data.length,
                expireAt: Date.now() + TTL_MS,
            };
            cacheSet(key, entry);
            return entry;
        } catch (err: any) {
            console.error('[SegmentCache] fetch error:', err?.message || err);
            return null;
        } finally {
            inflight.delete(key);
        }
    })();

    inflight.set(key, promise);
    return promise;
}

function prefetchSegment(url: string, headers: Record<string, string>): void {
    const key = cacheKey(url);
    if (cache.has(key) || inflight.has(key)) return;
    void fetchSegment(url, headers);
}

function schedulePrefetch(url: string, headers: Record<string, string>): void {
    const ctx = getPlaylistContext(url);
    if (ctx) {
        const idx = ctx.urls.indexOf(url);
        if (idx >= 0) {
            for (let i = 1; i <= PREFETCH_COUNT; i++) {
                const nextUrl = ctx.urls[idx + i];
                if (nextUrl) prefetchSegment(nextUrl, ctx.headers);
            }
            return;
        }
    }

    for (const nextUrl of guessNextSegmentUrls(url, PREFETCH_COUNT)) {
        prefetchSegment(nextUrl, headers);
    }
}

export function registerMediaPlaylist(segmentUrls: string[], headers: Record<string, string>): void {
    if (segmentUrls.length === 0) return;

    const ctx: PlaylistContext = {
        urls: segmentUrls,
        headers,
        expireAt: Date.now() + PLAYLIST_TTL_MS,
    };

    for (const url of segmentUrls) {
        playlistBySegmentUrl.set(url, ctx);
    }

    const warmCount = Math.min(PREFETCH_COUNT, segmentUrls.length);
    for (let i = 0; i < warmCount; i++) {
        prefetchSegment(segmentUrls[i], headers);
    }
}

export async function serveSegment(
    url: string,
    headers: Record<string, string>,
    res: any
): Promise<void> {
    const key = cacheKey(url);
    let entry = cacheGet(key);
    const cacheHit = Boolean(entry);

    if (!entry) {
        entry = await fetchSegment(url, headers);
        if (!entry) {
            if (!res.headersSent) {
                res.status(502).send('Upstream error');
            }
            return;
        }
    }

    res.setHeader('Content-Type', entry.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Segment-Cache', cacheHit ? 'HIT' : 'MISS');
    res.send(entry.data);

    schedulePrefetch(url, headers);
}
