from __future__ import annotations

import sys

from xbmcaddon import Addon


ADDON = Addon()
ADDON_ID = ADDON.getAddonInfo("id")
PLUGIN_URL = sys.argv[0]
HANDLE = int(sys.argv[1])

DISCOVERY_SECTIONS = [
    ("trending-movies", "Trending Movies", "movie"),
    ("popular-movies", "Popular Movies", "movie"),
    ("trending-tv", "Trending TV Shows", "tv"),
    ("popular-tv", "Popular TV Shows", "tv"),
]
