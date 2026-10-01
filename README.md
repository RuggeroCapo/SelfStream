# SelfStream 🤌

A lightweight, self-hosted Stremio addon with **3 configurable sources**, built-in HLS proxy, multi-language support (40 languages), and automatic subtitle injection.

> **All sources are disabled by default.** Enable only the ones you need from the configuration page.

---

## Features

| Feature | Description |
|---|---|
| **3 Sources** | **VixSrc** (movies & series), **CinemaCity** (movies & series + subtitles), **AnimeUnity** (anime via Kitsu) |
| **Per-source configuration** | Enable/disable each source independently from the landing page |
| **40 Languages** | Select preferred audio and subtitle language per source |
| **HLS Proxy** | All streams are proxied through the addon — bypasses geo/IP restrictions |
| **Synthetic FHD** | Proxy rewrites manifests to serve only the best available quality (1080p) |
| **Subtitle Injection** | CinemaCity: up to 90 VTT subtitle tracks injected as HLS subtitle streams with proper BCP-47 language codes |
| **Audio Selection** | Preferred language → English fallback → first available |
| **Subtitle Selection** | Preferred language → none (no fallback) |
| **Localized Titles** | Stream titles show the localized TMDB title in your language |
| **ID Agnostic** | Works with TMDB (`786892`), IMDB (`tt30144839`), and Kitsu (`kitsu:12:1`) IDs |

### Stream Labels
- **VixSrc**: `VixSrc 🤌` — `🎬 Localized Title`
- **CinemaCity**: `CinemaCity 🤌` — `🎬 Localized Title`
- **AnimeUnity**: `AU 🤌` — `VIX 1080 🤌`

---

## Deployment

> For the local Docker stack below, use the included `Dockerfile` as-is.
> Update `Dockerfile.hf` only if you deploy through Hugging Face with your own fork.
>
> [📺 Video Guide](https://www.youtube.com/watch?v=nnhwo0C5x3I)

### Local Docker

The Docker stack has been simplified for the current setup:
- local `selfstream` on `127.0.0.1:7000`
- optional `vpn-egress` profile with `gluetun`
- optional `public-web` profile with `caddy` for a stable public URL

Basic startup:

```bash
cp .env.example .env
docker compose up -d --build selfstream
```

Local manifest:

```text
http://127.0.0.1:7000/manifest.json
```

### DuckDNS + OpenWRT + Caddy

If you want a **stable free public URL**, the recommended setup here is:

- `DuckDNS` for the free subdomain
- `OpenWRT` to keep the DDNS record updated and forward ports
- `Caddy` for automatic HTTPS and reverse proxying to `127.0.0.1:7000`

Prerequisites:
- you need a publicly reachable IPv4 address; if your ISP puts you behind CGNAT, this setup will not work
- on OpenWRT, forward `TCP 80` and `TCP 443` to the LAN IP of the machine running Docker
- on OpenWRT, `ddns-scripts`, `ddns-scripts-services`, and `luci-app-ddns` are the easiest way to keep DuckDNS updated automatically

Configure `.env`:

```bash
PUBLIC_DOMAIN=yourname.duckdns.org
```

Start without VPN:

```bash
docker compose up -d --build selfstream
docker compose --profile public-web up -d caddy
```

Start with VPN only for outbound traffic:

```bash
docker compose stop selfstream
docker compose --profile vpn-egress up -d --build gluetun selfstream-vpn
docker compose --profile public-web up -d caddy
```

Notes:
- `caddy` terminates public TLS and proxies to `host.docker.internal:7000`, so it works with both `selfstream` and `selfstream-vpn`
- do not run `selfstream` and `selfstream-vpn` at the same time: they use the same local port
- once DuckDNS has propagated, your public manifest will be:

```text
https://yourname.duckdns.org/manifest.json
```

OpenWRT side steps:
1. create the subdomain on DuckDNS and copy its token
2. configure a DuckDNS DDNS service on OpenWRT to keep that record updated
3. add two WAN -> Docker host port forwards:
   - `TCP 80 -> 80`
   - `TCP 443 -> 443`
4. verify externally that `http://yourname.duckdns.org` responds and let Caddy complete the Let's Encrypt certificate issuance

If you only need a temporary workaround without touching the router, `ngrok` or `Tailscale Funnel` still work as quick fallback options, but they are no longer the recommended path here.

### VPN only for outbound traffic with Gluetun

If you want **only the requests to streaming providers** to leave through a VPN, without putting the whole PC behind a VPN, use the `vpn-egress` profile.

The model is:
- `client -> Caddy on 80/443`
- `Caddy -> localhost:7000`
- `gluetun -> selfstream-vpn -> final provider`

Minimal `.env` configuration:

```bash
GLUETUN_VPN_SERVICE_PROVIDER=protonvpn
GLUETUN_VPN_TYPE=wireguard
GLUETUN_SERVER_COUNTRIES=Switzerland
GLUETUN_WIREGUARD_PRIVATE_KEY=...
GLUETUN_WIREGUARD_ADDRESSES=...
```

Notes:
- For `Mullvad`, `ProtonVPN`, and similar providers, prefer `wireguard` for latency and throughput.
- If your provider requires OpenVPN credentials, use `GLUETUN_OPENVPN_USER` and `GLUETUN_OPENVPN_PASSWORD` instead of the WireGuard variables.

Start it:

```bash
docker compose stop selfstream
docker compose --profile vpn-egress up -d --build gluetun selfstream-vpn
```

Verify it:

```bash
curl http://127.0.0.1:7000/manifest.json
docker compose exec selfstream-vpn wget -qO- https://api.ipify.org
```

If you want to expose it publicly through DuckDNS:

```bash
docker compose --profile public-web up -d caddy
```

Performance:
- There is VPN overhead, so some degradation is expected.
- With `wireguard` and a nearby server, the degradation is usually moderate.
- For this use case, the tradeoff is good: only SelfStream's egress goes through the VPN, while public ingress remains simple and stable through Caddy.

### Recommended: VPS / Raspberry Pi (Best compatibility)

A persistent server is the most reliable option — it keeps the in-memory proxy cache alive and avoids cloud IP blocks.

```bash
git clone https://github.com/YOUR_USER/SelfStream.git
cd SelfStream
npm install
npm run build
PORT=7020 node dist/addon.js
```

The addon will be available at `http://your-ip:7020/manifest.json`.

### Koyeb (Recommended cloud — stable, no sleep, AnimeUnity may not work)

[📺 Video Guide](https://www.youtube.com/watch?v=IXEi81ONdNo)

1. Create an account on [Koyeb.com](https://www.koyeb.com/).
2. Click **"Create Service"** → select **GitHub**.
3. Connect your forked repository.
4. Configuration:
   - **Builder**: `Docker`
   - **Dockerfile Path**: `Dockerfile.hf`
   - **Port**: `7000`
5. Click **Deploy**.

### Hugging Face Spaces (Free, AnimeUnity may not work)

[📺 Video Guide](https://www.youtube.com/watch?v=Ti2BNDjm0ns)

1. Create a new **Space** on [Hugging Face](https://huggingface.co/spaces).
2. Choose **Docker** as SDK, **Blank** template.
3. Upload the Dockerfile (fork the project first and rename `Dockerfile.hf` with your GitHub username).
4. Copy the embed link.
5. The Space runs on port `7860`.

> **Note**: AnimeUnity/VixCloud may not work on HuggingFace due to cloud IP blocking.

### Vercel (Serverless — fast, limited, CinemaCity and AnimeUnity may not work)

[📺 Video Guide](https://www.youtube.com/watch?v=TP3_sbt94Ag)

The project includes `vercel.json` and `api/index.ts` for serverless deployment.

1. Go to [Vercel.com](https://vercel.com/) and import your GitHub repo.
2. Vercel auto-detects the configuration.
3. Click **Deploy**.
4. Access at `https://your-app.vercel.app/manifest.json`.

> **Limitations**: Vercel free plan has a 10s function timeout. Multi-step scraping (AnimeUnity) may exceed this. The in-memory proxy header cache resets between invocations (a fallback is in place, but VPS is more reliable).

---

## Local Development

```bash
npm install
npm run build
npm start
# Or with ts-node:
npm run dev
```

The addon runs on `http://localhost:7000` by default.

---

## Technical Notes

- **Proxy architecture**: Stream URLs point to `/proxy/hls/manifest.m3u8` which rewrites all segment/audio/subtitle URIs to also go through the proxy, ensuring playback works from any network.
- **CinemaCity subtitles**: The player JSON exposes a `subtitle` array with up to 90 VTT tracks. These are wrapped into HLS subtitle playlists (`/proxy/hls/subtitle.m3u8` → `/proxy/hls/subtitle.vtt`) with `X-TIMESTAMP-MAP` injection for sync.
- **AnimeMapping**: Kitsu IDs are converted to AnimeUnity paths via the AnimeMapping API, then resolved through VixCloud.
- **Header cache fallback**: On serverless platforms where the in-memory cache is empty, the proxy infers the correct headers from the URL pattern (VixSrc, VixCloud, or generic).
