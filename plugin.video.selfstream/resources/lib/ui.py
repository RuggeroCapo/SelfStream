from __future__ import annotations

from urllib.parse import urlencode

import xbmc
import xbmcgui
import xbmcplugin

from .constants import HANDLE, PLUGIN_URL


def plugin_url(**params: str | int) -> str:
    return "{0}?{1}".format(PLUGIN_URL, urlencode(params))


def add_directory_item(
    label: str,
    url: str,
    is_folder: bool,
    playable: bool = False,
    art: dict[str, str] | None = None,
    info: dict[str, str] | None = None,
) -> None:
    item = xbmcgui.ListItem(label=label)
    if art:
        item.setArt(art)
    if info:
        tag = item.getVideoInfoTag()
        if info.get("title"):
            tag.setTitle(info["title"])
        if info.get("plot"):
            tag.setPlot(info["plot"])
        if info.get("year"):
            try:
                tag.setYear(int(info["year"]))
            except ValueError:
                pass
    if playable:
        item.setProperty("IsPlayable", "true")
    xbmcplugin.addDirectoryItem(HANDLE, url, item, is_folder)


def end_directory(content: str) -> None:
    xbmcplugin.setContent(HANDLE, content)
    xbmcplugin.endOfDirectory(HANDLE)


def prompt_text(heading: str) -> str | None:
    keyboard = xbmc.Keyboard("", heading)
    keyboard.doModal()
    if not keyboard.isConfirmed():
        return None
    value = keyboard.getText().strip()
    return value or None


def notify(message: str, level: int = xbmcgui.NOTIFICATION_ERROR) -> None:
    xbmcgui.Dialog().notification("SelfStream", message, level)


def open_settings() -> None:
    xbmc.executebuiltin("Addon.OpenSettings(plugin.video.selfstream)")


def resolve_playback(url: str, title: str) -> None:
    item = xbmcgui.ListItem(label=title, offscreen=True)
    item.setPath(url)
    item.setMimeType("application/vnd.apple.mpegurl")
    item.setContentLookup(False)
    item.getVideoInfoTag().setTitle(title)
    xbmcplugin.setResolvedUrl(HANDLE, True, item)
