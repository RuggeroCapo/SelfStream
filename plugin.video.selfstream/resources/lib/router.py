from __future__ import annotations

import sys
from urllib.parse import parse_qsl

from .backend import BackendClient, BackendError
from .constants import DISCOVERY_SECTIONS
from .settings import autoplay_single_source
from .ui import add_directory_item, end_directory, notify, open_settings, plugin_url, prompt_text, resolve_playback


def run() -> None:
    params = dict(parse_qsl(sys.argv[2][1:]))
    action = params.get("action", "")

    if not action:
        show_root()
        return

    try:
        if action == "open_settings":
            open_settings()
        elif action == "search_movies":
            run_search("movie")
        elif action == "search_tv":
            run_search("tv")
        elif action == "discover":
            list_discover(params["section"], params["media_type"])
        elif action == "tv_seasons":
            list_seasons(int(params["tmdb_id"]), params["title"])
        elif action == "tv_episodes":
            list_episodes(int(params["tmdb_id"]), int(params["season"]), params["title"])
        elif action == "streams":
            list_streams(
                media_type=params["media_type"],
                tmdb_id=int(params["tmdb_id"]),
                title=params["title"],
                season=int(params["season"]) if params.get("season") else None,
                episode=int(params["episode"]) if params.get("episode") else None,
            )
        elif action == "play":
            resolve_playback(params["url"], params.get("title", "SelfStream"))
        else:
            raise ValueError("Unsupported action")
    except BackendError as exc:
        notify(str(exc))
        end_directory("videos")


def show_root() -> None:
    add_directory_item("Search Movies", plugin_url(action="search_movies"), is_folder=True)
    add_directory_item("Search TV Shows", plugin_url(action="search_tv"), is_folder=True)
    for section, label, media_type in DISCOVERY_SECTIONS:
        add_directory_item(
            label,
            plugin_url(action="discover", section=section, media_type=media_type),
            is_folder=True,
        )
    add_directory_item("Settings", plugin_url(action="open_settings"), is_folder=False)
    end_directory("videos")


def run_search(media_type: str) -> None:
    term = prompt_text("Search")
    if not term:
        end_directory("videos")
        return
    client = BackendClient()
    payload = client.search(term, media_type)
    show_media_items(payload.get("items", []))


def list_discover(section: str, media_type: str) -> None:
    client = BackendClient()
    payload = client.discover(section)
    show_media_items(payload.get("items", []), media_type)


def show_media_items(items: list[dict], fallback_media_type: str | None = None) -> None:
    for item in items:
        media_type = item.get("media_type") or fallback_media_type or "movie"
        label = _label_with_year(item.get("title", "Unknown"), item.get("year"))
        art = {"poster": item.get("poster") or "", "fanart": item.get("fanart") or ""}
        info = {"title": item.get("title", ""), "plot": item.get("overview", ""), "year": item.get("year", "")}
        if media_type == "tv":
            url = plugin_url(action="tv_seasons", tmdb_id=item["id"], title=item.get("title", "TV Show"))
            add_directory_item(label, url, is_folder=True, art=art, info=info)
        else:
            url = plugin_url(action="streams", media_type="movie", tmdb_id=item["id"], title=item.get("title", "Movie"))
            add_directory_item(label, url, is_folder=True, art=art, info=info)
    end_directory("videos")


def list_seasons(tmdb_id: int, title: str) -> None:
    client = BackendClient()
    payload = client.show_seasons(tmdb_id)
    for season in payload.get("seasons", []):
        label = season.get("name") or "Season"
        art = {"poster": season.get("poster") or "", "fanart": payload.get("show", {}).get("fanart") or ""}
        info = {"title": label, "plot": season.get("overview", "")}
        url = plugin_url(
            action="tv_episodes",
            tmdb_id=tmdb_id,
            season=season["season_number"],
            title=title,
        )
        add_directory_item(label, url, is_folder=True, art=art, info=info)
    end_directory("episodes")


def list_episodes(tmdb_id: int, season: int, title: str) -> None:
    client = BackendClient()
    payload = client.season_episodes(tmdb_id, season)
    for episode in payload.get("episodes", []):
        label = "{0:02d}. {1}".format(episode.get("episode_number", 0), episode.get("title", "Episode"))
        art = {"thumb": episode.get("thumb") or "", "fanart": payload.get("show", {}).get("fanart") or ""}
        info = {"title": episode.get("title", ""), "plot": episode.get("overview", "")}
        url = plugin_url(
            action="streams",
            media_type="tv",
            tmdb_id=tmdb_id,
            season=season,
            episode=episode["episode_number"],
            title="{0} - {1}".format(title, label),
        )
        add_directory_item(label, url, is_folder=True, art=art, info=info)
    end_directory("episodes")


def list_streams(media_type: str, tmdb_id: int, title: str, season: int | None, episode: int | None) -> None:
    client = BackendClient()
    payload = client.streams(media_type=media_type, tmdb_id=tmdb_id, season=season, episode=episode)
    streams = payload.get("streams", [])
    if not streams:
        notify("No streams found", level=1)
        end_directory("videos")
        return

    if autoplay_single_source() and len(streams) == 1:
        resolve_playback(streams[0]["play_url"], title)
        return

    for stream in streams:
        label = "{0} [{1}]".format(stream.get("label", "Stream"), stream.get("source", "unknown"))
        url = plugin_url(action="play", url=stream["play_url"], title=title)
        add_directory_item(label, url, is_folder=False, playable=True)
    end_directory("videos")


def _label_with_year(title: str, year: str | None) -> str:
    if not year:
        return title
    return "{0} ({1})".format(title, year)
