from __future__ import annotations

from .constants import ADDON


def backend_base_url() -> str:
    return ADDON.getSettingString("backend_base_url").strip().rstrip("/")


def preferred_language() -> str:
    value = ADDON.getSettingString("preferred_language").strip()
    return value or "en"


def autoplay_single_source() -> bool:
    return ADDON.getSettingBool("autoplay_single_source")


def enable_experimental_adapters() -> bool:
    return ADDON.getSettingBool("enable_experimental_adapters")
