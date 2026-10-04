# Streamed Events (Stremio addon)

Separate addon, same pattern as SelfStream: catalogs of live sport events from the streamed.pk API,
playback through an HLS proxy running on your own server.

- `src/api.ts` – streamed.pk API client (matches / streams / images) with short caches
- `src/extract.ts` – opens the embed page in headless Chromium and intercepts the m3u8 request (+ Referer/Origin).
  The request is aborted in the browser: the CDN binds the playlist token to the first client that loads it.
- `src/proxy.ts` – stateless HLS proxy: rewrites playlists, pipes segments (stripping the fake image header some
  CDNs put in front of TS segments). Proxy tokens are HMAC-signed and expire, so it is not an open proxy.
- `src/addon.ts` – manifest, catalog/meta/stream handlers, `/play/*` and `/proxy/*` routes

Embeds are only resolved when you press play (`/play/<embed>.m3u8`), so browsing is cheap.

## Run
```bash
docker compose up -d --build        # manifest: http://127.0.0.1:7010/manifest.json
```
Behind HTTPS/reverse proxy set `PUBLIC_URL=https://your.domain`.
Set `PROXY_SECRET` to a random string so playback links survive restarts (otherwise a random key is used per run).
Env: `PORT`, `PUBLIC_URL`, `PROXY_SECRET`, `PROXY_TOKEN_TTL_MS` (default 6h), `STREAMED_API`, `CHROMIUM_PATH`,
`MAX_BROWSER_PAGES`, `EXTRACT_TIMEOUT_MS`, `TZ`.

The Docker image tag must match the exact `playwright-core` version in `package.json`.

## Status
Tested end to end against the live API: catalog → streams → `/play` (Chromium extraction, ~4s)
→ master/variant playlists → segments, decoded with ffmpeg (1080p h264 + AAC) entirely through the proxy.
