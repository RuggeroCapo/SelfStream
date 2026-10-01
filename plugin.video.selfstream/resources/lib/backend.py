from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from . import settings


class BackendError(RuntimeError):
    pass


class BackendClient:
    def __init__(self) -> None:
        self.base_url = settings.backend_base_url()
        if not self.base_url:
            raise BackendError("Backend base URL is empty")

    def search(self, query: str, media_type: str) -> dict[str, Any]:
        return self._get_json(
            "/api/search",
            {
                "query": query,
                "media_type": media_type,
                "lang": settings.preferred_language(),
            },
        )

    def discover(self, section: str) -> dict[str, Any]:
        return self._get_json(
            f"/api/discover/{section}",
            {"lang": settings.preferred_language()},
        )

    def show_seasons(self, tmdb_id: int) -> dict[str, Any]:
        return self._get_json(
            f"/api/tv/{tmdb_id}/seasons",
            {"lang": settings.preferred_language()},
        )

    def season_episodes(self, tmdb_id: int, season_number: int) -> dict[str, Any]:
        return self._get_json(
            f"/api/tv/{tmdb_id}/season/{season_number}",
            {"lang": settings.preferred_language()},
        )

    def streams(self, media_type: str, tmdb_id: int, season: int | None = None, episode: int | None = None) -> dict[str, Any]:
        params: dict[str, Any] = {
            "lang": settings.preferred_language(),
            "allow_experimental": "true" if settings.enable_experimental_adapters() else "false",
        }
        if season is not None:
            params["season"] = season
        if episode is not None:
            params["episode"] = episode
        return self._get_json(f"/api/streams/{media_type}/{tmdb_id}", params)

    def _get_json(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        query = urlencode(params)
        url = f"{self.base_url}{path}"
        if query:
            url = f"{url}?{query}"
        request = Request(url, headers={"Accept": "application/json"})
        try:
            with urlopen(request, timeout=20) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise BackendError(f"Backend request failed ({exc.code}): {detail}") from exc
        except URLError as exc:
            raise BackendError(f"Backend is unreachable: {exc.reason}") from exc
