"""Output profile management — save/load/delete named compression presets."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from app.core.paths import profile_dir

PROFILE_DIR = profile_dir()


@dataclass
class OutputProfile:
    name: str
    target_size_kb: int = 1000
    output_format: str = "PNG"
    quality: str = "Auto"
    dpi: int = 300
    color_mode: str = "Color"
    paper_size: str = "A4"
    ocr_language: str = "ind+eng"


DEFAULT_PROFILE = OutputProfile(name="Default")


class ProfileService:
    """CRUD for named output profiles stored as JSON files."""

    def __init__(self) -> None:
        PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    def _path(self, name: str) -> Path:
        safe = name.replace("/", "_").replace("\\", "_")
        return PROFILE_DIR / f"{safe}.json"

    def list_profiles(self) -> list[OutputProfile]:
        profiles: list[OutputProfile] = []
        for fp in sorted(PROFILE_DIR.glob("*.json")):
            try:
                data = json.loads(fp.read_text(encoding="utf-8"))
                profiles.append(OutputProfile(**data))
            except Exception:
                continue
        if not profiles:
            return [DEFAULT_PROFILE]
        return profiles

    def get_profile(self, name: str) -> OutputProfile | None:
        fp = self._path(name)
        if not fp.exists():
            return None
        try:
            data = json.loads(fp.read_text(encoding="utf-8"))
            return OutputProfile(**data)
        except Exception:
            return None

    def save_profile(self, profile: OutputProfile) -> None:
        fp = self._path(profile.name)
        data = {
            "name": profile.name,
            "target_size_kb": profile.target_size_kb,
            "output_format": profile.output_format,
            "quality": profile.quality,
            "dpi": profile.dpi,
            "color_mode": profile.color_mode,
            "paper_size": profile.paper_size,
            "ocr_language": profile.ocr_language,
        }
        fp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    def delete_profile(self, name: str) -> bool:
        fp = self._path(name)
        if fp.exists():
            fp.unlink()
            return True
        return False
