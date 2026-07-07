from __future__ import annotations

import os
from pathlib import Path


def project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def runtime_root() -> Path:
    override = os.environ.get("PRINTSTUDIO_USER_DATA_DIR")
    if override:
        return Path(override)
    return project_root()


def data_dir() -> Path:
    path = runtime_root() / "data"
    path.mkdir(parents=True, exist_ok=True)
    return path


def temp_dir() -> Path:
    path = runtime_root() / "temp"
    path.mkdir(parents=True, exist_ok=True)
    return path


def scan_dir() -> Path:
    path = temp_dir() / "scans"
    path.mkdir(parents=True, exist_ok=True)
    return path


def profile_dir() -> Path:
    path = data_dir() / "profiles"
    path.mkdir(parents=True, exist_ok=True)
    return path


def sharing_data_dir() -> Path:
    path = data_dir() / "sharing"
    path.mkdir(parents=True, exist_ok=True)
    return path


def shared_print_dir() -> Path:
    path = temp_dir() / "shared-print"
    path.mkdir(parents=True, exist_ok=True)
    return path
