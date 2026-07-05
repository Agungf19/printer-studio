from __future__ import annotations

import logging
from pathlib import Path

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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

APP_NAME = "ScanPilot"
APP_VERSION = "0.1.0"

# Restrict CORS to the local dev server and the packaged Electron origin
# instead of the previous wide-open "*".
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost",
    "http://127.0.0.1",
    "app://.",
]

app = FastAPI(title=f"{APP_NAME} Local API", version=APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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

project_root = Path(__file__).resolve().parents[2]
scan_files_dir = project_root / "temp" / "scans"
scan_files_dir.mkdir(parents=True, exist_ok=True)
app.mount("/files/scans", StaticFiles(directory=str(scan_files_dir)), name="scan-files")
