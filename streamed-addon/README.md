# Streamed Events (Stremio addon)

Separate addon, same pattern as SelfStream: catalogs of live sport events from the streamed.pk API,
playback through an HLS proxy running on your own server.

- `src/api.ts` – streamed.pk API client (matches / streams / images) with short caches
- `src/extract.ts` – opens the embed page in headless Chromium and captures the m3u8 request (+ Referer/Origin)
- `src/proxy.ts` – stateless HLS proxy: rewrites playlists, pipes segments
- `src/addon.ts` – manifest, catalog/meta/stream handlers, `/play/*` and `/proxy/*` routes

Embeds are only resolved when you press play (`/play/<embed>.m3u8`), so browsing is cheap.

## Run
```bash
docker compose up -d --build        # manifest: http://127.0.0.1:7010/manifest.json
```
Behind HTTPS/reverse proxy set `PUBLIC_URL=https://your.domain`.
Env: `PORT`, `PUBLIC_URL`, `STREAMED_API`, `CHROMIUM_PATH`, `MAX_BROWSER_PAGES`, `EXTRACT_TIMEOUT_MS`, `TZ`.

## Status
Catalog, meta and stream listing are tested against the live API. The browser extraction
(`extract.ts`) has not been tested end to end yet.
