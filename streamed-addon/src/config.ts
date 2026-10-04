export const config = {
    port: parseInt(process.env.PORT || '7010', 10),
    apiBase: process.env.STREAMED_API || 'https://streamed.pk',
    // Chromium used to pull the m3u8 out of the embed page
    chromiumPath: process.env.CHROMIUM_PATH || undefined,
    extractTimeoutMs: parseInt(process.env.EXTRACT_TIMEOUT_MS || '20000', 10),
    extractCacheMs: 2 * 60 * 1000,
    maxBrowserPages: parseInt(process.env.MAX_BROWSER_PAGES || '2', 10),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};
