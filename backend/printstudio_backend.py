from __future__ import annotations

import os
from multiprocessing import freeze_support
from pathlib import Path

import uvicorn

from app.main import app


def _default_user_data_dir() -> Path:
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        return Path(local_app_data) / "PrintStudio"
    return Path.home() / "AppData" / "Local" / "PrintStudio"


def main() -> None:
    os.environ.setdefault("PRINTSTUDIO_USER_DATA_DIR", str(_default_user_data_dir()))
    host = os.environ.get("PRINTSTUDIO_BACKEND_HOST", "0.0.0.0")
    port = int(os.environ.get("PRINTSTUDIO_BACKEND_PORT", "8765"))
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level=os.environ.get("PRINTSTUDIO_LOG_LEVEL", "warning"),
        access_log=False,
        loop="asyncio",
        http="h11",
    )


if __name__ == "__main__":
    freeze_support()
    main()
