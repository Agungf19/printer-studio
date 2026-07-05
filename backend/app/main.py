from __future__ import annotations

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

app = FastAPI(title="ScanPilot Local API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
