import { chromium, Browser, BrowserContext } from 'playwright-core';
import { config } from './config';

export interface Extracted {
    url: string;
    headers: Record<string, string>;
}

let browserP: Promise<Browser> | null = null;
function getBrowser(): Promise<Browser> {
    if (!browserP) {
        browserP = chromium
            .launch({ executablePath: config.chromiumPath, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] })
            .then((b) => {
                b.on('disconnected', () => (browserP = null));
                return b;
            });
        // Don't keep a failed launch around: retry on the next play
        browserP.catch(() => (browserP = null));
    }
    return browserP;
}

const cache = new Map<string, { exp: number; val: Extracted }>();
const inflight = new Map<string, Promise<Extracted>>();
let active = 0;
const waiters: (() => void)[] = [];

async function slot() {
    if (active >= config.maxBrowserPages) await new Promise<void>((r) => waiters.push(r));
    active++;
}
function release() {
    active--;
    waiters.shift()?.();
}

async function run(embedUrl: string): Promise<Extracted> {
    await slot();
    let ctx: BrowserContext | undefined;
    let timer: NodeJS.Timeout | undefined;
    try {
        const browser = await getBrowser();
        ctx = await browser.newContext({ userAgent: config.userAgent });
        const page = await ctx.newPage();
        // Intercept the playlist request and abort it: the CDN binds the playlist token to the
        // first client that fetches it, so the browser must never load it, only our proxy.
        const found = new Promise<Extracted>((resolve) => {
            page.route(/\.m3u8(\?|$)/i, async (route) => {
                const req = route.request();
                // headers() omits security-related headers; allHeaders() has what would be sent
                const h = await req.allHeaders().catch((): Record<string, string> => ({}));
                const headers: Record<string, string> = { 'User-Agent': config.userAgent };
                if (h['referer']) headers['Referer'] = h['referer'];
                if (h['origin']) headers['Origin'] = h['origin'];
                resolve({ url: req.url(), headers });
                await route.abort().catch(() => {});
            }).catch(() => {});
        });
        const timeout = new Promise<never>((_, rej) => {
            timer = setTimeout(() => rej(new Error('m3u8 extraction timed out')), config.extractTimeoutMs);
        });
        page.goto(embedUrl, { referer: config.apiBase + '/', waitUntil: 'domcontentloaded' }).catch(() => {});
        return await Promise.race([found, timeout]);
    } finally {
        clearTimeout(timer);
        await ctx?.close().catch(() => {});
        release();
    }
}

export function extractM3u8(embedUrl: string): Promise<Extracted> {
    const hit = cache.get(embedUrl);
    if (hit && hit.exp > Date.now()) return Promise.resolve(hit.val);
    let p = inflight.get(embedUrl);
    if (!p) {
        p = run(embedUrl)
            .then((val) => {
                cache.set(embedUrl, { exp: Date.now() + config.extractCacheMs, val });
                return val;
            })
            .finally(() => inflight.delete(embedUrl));
        inflight.set(embedUrl, p);
    }
    return p;
}
