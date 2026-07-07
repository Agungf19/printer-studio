from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.export import router as export_router
from app.api.health import router as health_router
from app.api.network import router as network_router
from app.api.printers import router as printers_router
from app.api.profiles import router as profiles_router
from app.api.scanners import router as scanners_router
from app.api.sharing import router as sharing_router
from app.core.naps2_service import clear_scan_dir
from app.core.paths import scan_dir

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)

APP_NAME = "PrintStudio"
APP_VERSION = "0.2.4"

# Restrict CORS to the local dev server and the packaged Electron origin
# instead of the previous wide-open "*".
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost",
    "http://127.0.0.1",
    "app://.",
    "null",
]

app = FastAPI(title=f"{APP_NAME} Local API", version=APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=(
        r"^https?://("
        r"localhost|127\.0\.0\.1|"
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"192\.168\.\d{1,3}\.\d{1,3}|"
        r"172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}"
        r")(:\d+)?$"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(export_router)
app.include_router(health_router)
app.include_router(network_router)
app.include_router(printers_router)
app.include_router(scanners_router)
app.include_router(profiles_router)
app.include_router(sharing_router)

scan_files_dir = scan_dir()
app.mount("/files/scans", StaticFiles(directory=str(scan_files_dir)), name="scan-files")


@app.on_event("startup")
def _cleanup_leftover_scans() -> None:
    """Ephemeral mode: clear any scans left over from a previous session."""
    try:
        removed = clear_scan_dir()
        if removed:
            logger.info("Startup: menghapus %d berkas scan sisa.", removed)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Startup: gagal membersihkan temp/scans: %s", exc)
