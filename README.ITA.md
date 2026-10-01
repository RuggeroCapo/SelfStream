# SelfStream 🤌

Addon leggero e self-hosted per Stremio con **3 sorgenti configurabili**, proxy HLS integrato, supporto multi-lingua (40 lingue) e iniezione automatica dei sottotitoli.

> **Tutte le sorgenti sono disabilitate di default.** Attiva solo quelle che ti servono dalla pagina di configurazione.

---

## Funzionalità

| Funzione | Descrizione |
|---|---|
| **3 Sorgenti** | **VixSrc** (film e serie), **CinemaCity** (film e serie + sottotitoli), **AnimeUnity** (anime tramite Kitsu) |
| **Configurazione per sorgente** | Abilita/disabilita ogni sorgente indipendentemente dalla landing page |
| **40 Lingue** | Scegli lingua audio e sottotitoli preferita per ogni sorgente |
| **Proxy HLS** | Tutti gli stream passano attraverso l'addon — bypassa restrizioni geo/IP |
| **Synthetic FHD** | Il proxy riscrive i manifest per servire solo la qualità migliore disponibile (1080p) |
| **Iniezione Sottotitoli** | CinemaCity: fino a 90 tracce VTT iniettate come stream HLS con codici lingua BCP-47 |
| **Selezione Audio** | Lingua preferita → fallback inglese → primo disponibile |
| **Selezione Sottotitoli** | Lingua preferita → nessuno (nessun fallback) |
| **Titoli Localizzati** | I titoli degli stream mostrano il titolo TMDB localizzato nella tua lingua |
| **ID Agnostico** | Funziona con ID TMDB (`786892`), IMDB (`tt30144839`) e Kitsu (`kitsu:12:1`) |

### Label degli Stream
- **VixSrc**: `VixSrc 🤌` — `🎬 Titolo Localizzato`
- **CinemaCity**: `CinemaCity 🤌` — `🎬 Titolo Localizzato`
- **AnimeUnity**: `AU 🤌` — `VIX 1080 🤌`

---

## Deploy

> Per la stack Docker locale qui sotto usa direttamente il `Dockerfile` incluso.
> Aggiorna `Dockerfile.hf` solo se fai deploy su Hugging Face tramite il tuo fork.
>
> [📺 Video Guida](https://www.youtube.com/watch?v=nnhwo0C5x3I)

### Docker locale

Lo stack Docker del repo è stato semplificato per il setup attuale:
- `selfstream` locale su `127.0.0.1:7000`
- profilo opzionale `vpn-egress` con `gluetun`
- profilo opzionale `public-web` con `caddy` per un URL pubblico stabile

Avvio base:

```bash
cp .env.example .env
docker compose up -d --build selfstream
```

Manifest locale:

```text
http://127.0.0.1:7000/manifest.json
```

### DuckDNS + OpenWRT + Caddy

Se vuoi un URL pubblico **stabile e gratis**, il setup consigliato qui è:

- `DuckDNS` per il sottodominio gratuito
- `OpenWRT` per aggiornare il record DDNS e fare il port forwarding
- `Caddy` per HTTPS automatico e reverse proxy verso `127.0.0.1:7000`

Prerequisiti:
- devi avere un IPv4 pubblico raggiungibile; se sei sotto CGNAT questa soluzione non funziona
- sul router OpenWRT devi inoltrare `TCP 80` e `TCP 443` verso l'IP LAN della macchina che esegue Docker
- su OpenWRT conviene usare i pacchetti `ddns-scripts`, `ddns-scripts-services` e `luci-app-ddns` per aggiornare DuckDNS automaticamente

Configura `.env`:

```bash
PUBLIC_DOMAIN=tuonome.duckdns.org
```

Avvio senza VPN:

```bash
docker compose up -d --build selfstream
docker compose --profile public-web up -d caddy
```

Avvio con VPN solo per l'egress:

```bash
docker compose stop selfstream
docker compose --profile vpn-egress up -d --build gluetun selfstream-vpn
docker compose --profile public-web up -d caddy
```

Note:
- `caddy` termina TLS pubblicamente e inoltra tutto a `host.docker.internal:7000`, quindi funziona sia con `selfstream` sia con `selfstream-vpn`
- non tenere attivi `selfstream` e `selfstream-vpn` insieme: usano la stessa porta locale
- una volta propagato DuckDNS, il manifest pubblico sarà:

```text
https://tuonome.duckdns.org/manifest.json
```

Passi lato OpenWRT:
1. crea il sottodominio su DuckDNS e copia il token
2. configura un servizio DDNS DuckDNS su OpenWRT per aggiornare quel record
3. crea due port forward WAN -> host Docker:
   - `TCP 80 -> 80`
   - `TCP 443 -> 443`
4. verifica dall'esterno che `http://tuonome.duckdns.org` risponda e lascia a Caddy il completamento del certificato Let's Encrypt

Se vuoi solo un fallback temporaneo senza toccare il router, `ngrok` o `Tailscale Funnel` restano opzioni rapide ma non sono più il percorso consigliato qui.

### VPN solo per l'egress con Gluetun

Se vuoi che **solo le richieste verso i provider di streaming** escano da una VPN, senza mettere sotto VPN tutto il PC, usa il profilo `vpn-egress`.

Il modello è:
- `client -> Caddy su 80/443`
- `Caddy -> localhost:7000`
- `gluetun -> selfstream-vpn -> provider finale`

Configurazione minima in `.env`:

```bash
GLUETUN_VPN_SERVICE_PROVIDER=protonvpn
GLUETUN_VPN_TYPE=wireguard
GLUETUN_SERVER_COUNTRIES=Switzerland
GLUETUN_WIREGUARD_PRIVATE_KEY=...
GLUETUN_WIREGUARD_ADDRESSES=...
```

Note:
- Per `Mullvad`, `ProtonVPN` e simili conviene preferire `wireguard` per latenza e throughput.
- Se il provider richiede credenziali OpenVPN, usa `GLUETUN_OPENVPN_USER` e `GLUETUN_OPENVPN_PASSWORD` al posto delle variabili WireGuard.

Avvio:

```bash
docker compose stop selfstream
docker compose --profile vpn-egress up -d --build gluetun selfstream-vpn
```

Verifiche:

```bash
curl http://127.0.0.1:7000/manifest.json
docker compose exec selfstream-vpn wget -qO- https://api.ipify.org
```

Se vuoi esporlo pubblicamente con DuckDNS:

```bash
docker compose --profile public-web up -d caddy
```

Performance:
- C'è un overhead VPN, quindi un po' di degrado esiste.
- Con `wireguard` e un server vicino di solito il degrado è moderato.
- Per questo caso d'uso il compromesso è buono: solo l'egress di SelfStream passa nella VPN, mentre l'ingresso pubblico resta semplice e stabile via Caddy.

### Consigliato: VPS / Raspberry Pi (Massima compatibilità)

Un server persistente è l'opzione più affidabile — mantiene la cache proxy in memoria e evita i blocchi IP dei provider cloud.

```bash
git clone https://github.com/TUO_USER/SelfStream.git
cd SelfStream
npm install
npm run build
PORT=7020 node dist/addon.js
```

L'addon sarà disponibile su `http://tuo-ip:7020/manifest.json`.

### Koyeb (Cloud consigliato — stabile, senza sleep, AnimeUnity potrebbe non funzionare)

[📺 Video Guida](https://www.youtube.com/watch?v=IXEi81ONdNo)

1. Crea un account su [Koyeb.com](https://www.koyeb.com/).
2. Clicca **"Create Service"** → seleziona **GitHub**.
3. Collega il tuo repository forkato.
4. Configurazione:
   - **Builder**: `Docker`
   - **Dockerfile Path**: `Dockerfile.hf`
   - **Port**: `7000`
5. Clicca **Deploy**.

### Hugging Face Spaces (Gratuito, AnimeUnity potrebbe non funzionare))

[📺 Video Guida](https://www.youtube.com/watch?v=Ti2BNDjm0ns)

1. Crea un nuovo **Space** su [Hugging Face](https://huggingface.co/spaces).
2. Scegli **Docker** come SDK, template **Blank**.
3. Carica il Dockerfile (prima fai il fork e rinomina `Dockerfile.hf` con il tuo username GitHub).
4. Copia il link embed.
5. Lo Space gira sulla porta `7860`.

> **Nota**: AnimeUnity/VixCloud potrebbe non funzionare su HuggingFace a causa del blocco IP dei provider cloud.

### Vercel (Serverless — veloce, con limitazioni, CinemaCity e AnimeUnity potrebbe non funzionare))

[📺 Video Guida](https://www.youtube.com/watch?v=TP3_sbt94Ag)

Il progetto include `vercel.json` e `api/index.ts` per il deploy serverless.

1. Vai su [Vercel.com](https://vercel.com/) e importa il tuo repo GitHub.
2. Vercel rileva automaticamente la configurazione.
3. Clicca **Deploy**.
4. Accessibile su `https://tua-app.vercel.app/manifest.json`.

> **Limitazioni**: Il piano gratuito di Vercel ha un timeout di 10s per funzione. Lo scraping multi-step (AnimeUnity) potrebbe superarlo. La cache proxy in memoria si resetta tra le invocazioni (c'è un fallback, ma il VPS è più affidabile).

---

## Sviluppo Locale

```bash
npm install
npm run build
npm start
# Oppure con ts-node:
npm run dev
```

L'addon gira su `http://localhost:7000` di default.

---

## Note Tecniche

- **Architettura proxy**: Gli URL degli stream puntano a `/proxy/hls/manifest.m3u8` che riscrive tutti gli URI di segmenti/audio/sottotitoli per passare anch'essi dal proxy, garantendo la riproduzione da qualsiasi rete.
- **Sottotitoli CinemaCity**: Il JSON del player espone un array `subtitle` con fino a 90 tracce VTT. Queste vengono wrappate in playlist HLS (`/proxy/hls/subtitle.m3u8` → `/proxy/hls/subtitle.vtt`) con iniezione di `X-TIMESTAMP-MAP` per la sincronizzazione.
- **AnimeMapping**: Gli ID Kitsu vengono convertiti in percorsi AnimeUnity tramite l'API AnimeMapping, poi risolti attraverso VixCloud.
- **Fallback cache headers**: Sulle piattaforme serverless dove la cache in memoria è vuota, il proxy inferisce gli headers corretti dal pattern dell'URL (VixSrc, VixCloud, o generico).
