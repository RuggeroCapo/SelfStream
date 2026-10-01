from __future__ import annotations

import shutil
import zipfile
from pathlib import Path
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"


def build_zip() -> Path:
    addon_xml = ElementTree.parse(ROOT / "addon.xml").getroot()
    addon_id = addon_xml.attrib["id"]
    version = addon_xml.attrib["version"]
    DIST.mkdir(exist_ok=True)
    archive_path = DIST / f"{addon_id}-{version}.zip"
    if archive_path.exists():
        archive_path.unlink()

    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in ROOT.rglob("*"):
            if path.is_dir():
                continue
            if "__pycache__" in path.parts or path.suffix == ".pyc" or path.is_relative_to(DIST):
                continue
            arcname = Path(addon_id) / path.relative_to(ROOT)
            archive.write(path, arcname.as_posix())
    return archive_path


if __name__ == "__main__":
    built = build_zip()
    print(f"Built {built}")
