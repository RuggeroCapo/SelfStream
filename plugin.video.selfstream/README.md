# plugin.video.selfstream

Kodi video add-on for the `kodi_backend` service.

## Install

1. Build the add-on ZIP:
   ```bash
   cd plugin.video.selfstream
   python3 build.py
   ```
2. In Kodi, install the generated ZIP from `plugin.video.selfstream/dist/`.
3. Open add-on settings and set `Backend Base URL` to your backend, for example `http://192.168.1.10:7100`.

## Features

- Search movies and TV shows
- Browse trending and popular TMDb lists
- Resolve VixSrc streams through the self-hosted backend proxy
- Optional experimental adapter toggle for external Python resolvers
