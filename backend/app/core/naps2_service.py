"""NAPS2 Console scanner service.

Uses NAPS2 CLI (NAPS2.Console.exe) to enumerate and scan from physical scanners.
Supports WIA + TWAIN drivers via NAPS2's unified interface.

Requirements:
- NAPS2 must be installed on Windows: https://www.naps2.com/download
- Default path: C:\\Program Files\\NAPS2\\NAPS2.Console.exe
"""

from __future__ import annotations

import json
import logging
import re
import shutil
import subprocess
import uuid
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

SCAN_DIR = Path(__file__).resolve().parents[3] / "temp" / "scans"
SCAN_DIR.mkdir(parents=True, exist_ok=True)

# Active background ADF scan jobs, keyed by job_id.
_adf_jobs: dict[str, dict] = {}

# NAPS2 Console executable paths to check (in priority order)
_NAPS2_PATHS = [
    Path(r"C:\Program Files\NAPS2\NAPS2.Console.exe"),
    Path(r"C:\Program Files (x86)\NAPS2\NAPS2.Console.exe"),
    Path.home() / "AppData" / "Local" / "NAPS2" / "NAPS2.Console.exe",
]


@dataclass
class ScannerDevice:
    id: str
    name: str
    description: str = ""
    has_adf: bool = False


@dataclass
class ScanSettings:
    dpi: int = 300
    color_mode: str = "Color"
    paper_size: str = "A4"
    source: str = "Flatbed"


@dataclass
class ScanResult:
    path: Path
    mode: str = "naps2"


class ScannerError(Exception):
    """Raised when a scanner operation fails."""


def _find_naps2() -> Path:
    """Find NAPS2.Console.exe on the system."""
    # 1. Check PATH
    found = shutil.which("NAPS2.Console")
    if found:
        return Path(found)

    # 2. Check common install paths
    for p in _NAPS2_PATHS:
        if p.exists():
            return p

    # 3. WindowsApps (Microsoft Store / winget install)
    win_apps = Path.home() / "AppData" / "Local" / "Microsoft" / "WindowsApps" / "NAPS2.Console.exe"
    if win_apps.exists():
        return win_apps

    raise ScannerError(
        "NAPS2 tidak ditemukan. Silakan install NAPS2 dari https://www.naps2.com/download"
    )


def _run_naps2(args: list[str], timeout: int = 60) -> subprocess.CompletedProcess[str]:
    """Run NAPS2.Console.exe with the given arguments."""
    naps2 = _find_naps2()
    cmd = [str(naps2)] + args
    logger.debug("NAPS2 command: %s", " ".join(cmd))
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
        )
        return result
    except subprocess.TimeoutExpired as exc:
        raise ScannerError(f"NAPS2 timeout setelah {timeout}s") from exc
    except FileNotFoundError as exc:
        raise ScannerError(f"NAPS2 tidak ditemukan: {naps2}") from exc


def _color_mode_to_naps2(color_mode: str) -> str:
    """Map color mode string to NAPS2 --bitdepth value."""
    cm = color_mode.strip().lower()
    if cm in ("color", "berwarna"):
        return "color"
    elif cm in ("grayscale", "skala abu-abu"):
        return "gray"
    elif cm in ("black & white", "bw", "hitam putih"):
        return "bw"
    return "color"


def _source_to_naps2(source: str) -> str:
    """Map scan source to NAPS2 --source value."""
    src = source.strip().lower()
    if "feeder" in src or "adf" in src:
        return "feeder"
    elif "duplex" in src:
        return "duplex"
    return "glass"


def _parse_listdevices(output: str, driver: str) -> list[ScannerDevice]:
    """Parse output of --listdevices into ScannerDevice list.

    NAPS2 --listdevices output format:
        Device Name 1
        Device Name 2
    Each line is a device name (trimmed).
    """
    devices: list[ScannerDevice] = []
    seen_names: set[str] = set()

    for line in output.strip().splitlines():
        name = line.strip()
        if not name or name.startswith("Error") or name.startswith("No"):
            continue
        # Skip lines that look like warnings/errors
        if any(skip in name.lower() for skip in ["warning", "error:", "exception"]):
            continue
        if name in seen_names:
            continue
        seen_names.add(name)

        device_id = f"{driver}:{name}"
        # Default has_adf = True — most modern scanners/MPFs have ADF.
        # Frontend handles "feeder empty" errors gracefully anyway.
        has_adf = True

        devices.append(ScannerDevice(
            id=device_id,
            name=name,
            description=f"via {driver.upper()}",
            has_adf=has_adf,
        ))

    return devices


class Naps2ScannerService:
    """Enumerate scanners and perform scans via NAPS2 Console."""

    def __init__(self) -> None:
        SCAN_DIR.mkdir(parents=True, exist_ok=True)

    def list_devices(self) -> list[ScannerDevice]:
        """List available scanner devices using both WIA and TWAIN drivers."""
        all_devices: list[ScannerDevice] = []

        for driver in ("wia", "twain"):
            try:
                result = _run_naps2(["--listdevices", "--driver", driver], timeout=15)
                if result.returncode == 0 and result.stdout.strip():
                    devices = _parse_listdevices(result.stdout, driver)
                    all_devices.extend(devices)
                    logger.info("NAPS2 %s: found %d device(s)", driver, len(devices))
                else:
                    logger.debug("NAPS2 %s: no devices (returncode=%d)", driver, result.returncode)
            except ScannerError:
                logger.debug("NAPS2 %s driver not available", driver)
            except Exception as exc:
                logger.debug("NAPS2 %s listdevices failed: %s", driver, exc)

        # Deduplicate by name (prefer WIA over TWAIN for same device)
        # TWAIN names often have "TW-" prefix, strip it for comparison
        seen: dict[str, ScannerDevice] = {}
        for device in all_devices:
            key = re.sub(r"^tw-", "", device.name.lower().strip())
            if key not in seen:
                seen[key] = device
            elif device.id.startswith("wia:") and not seen[key].id.startswith("wia:"):
                seen[key] = device  # Prefer WIA

        return list(seen.values())

    def scan_single_page(self, device: ScannerDevice, settings: ScanSettings) -> ScanResult:
        """Scan a single page using NAPS2 Console.

        Args:
            device: Scanner device to use.
            settings: Scan configuration (DPI, color mode, paper size, source).

        Returns:
            ScanResult with path to the saved image.

        Raises:
            ScannerError: On scan failure.
        """
        # Determine driver and device name from device.id
        if ":" in device.id:
            driver, device_name = device.id.split(":", 1)
        else:
            driver = "wia"
            device_name = device.name

        # Generate output filename with source prefix
        is_feeder = _source_to_naps2(settings.source) == "feeder"
        prefix = "feed" if is_feeder else "flat"
        idx = len(list(SCAN_DIR.glob(f"{prefix}_*.jpg"))) + 1
        output_path = SCAN_DIR / f"{prefix}_{idx:04d}.jpg"

        # Build NAPS2 command
        args = [
            "--noprofile",
            "--driver", driver,
            "--device", device_name,
            "--source", _source_to_naps2(settings.source),
            "--dpi", str(settings.dpi),
            "--bitdepth", _color_mode_to_naps2(settings.color_mode),
            "--pagesize", settings.paper_size.lower(),
            "-o", str(output_path),
            "-f",  # Force overwrite
        ]

        # For feeder/ADF: limit to 1 page per call (frontend loops)
        if is_feeder:
            args.extend(["-n", "1"])

        # Use --deskew if source is flatbed (NAPS2 handles deskew natively)
        if settings.source.lower() in ("flatbed", "glass"):
            args.append("--deskew")

        try:
            result = _run_naps2(args, timeout=30)

            if result.returncode != 0:
                stderr = result.stderr.strip() if result.stderr else ""
                stdout = result.stdout.strip() if result.stdout else ""
                error_msg = stderr or stdout or f"NAPS2 exit code {result.returncode}"
                raise ScannerError(f"Scan gagal: {error_msg}")

            # NAPS2 feeder naming: feed_0001.1.jpg, feed_0001.2.jpg, etc.
            # Flatbed naming: flat_0001.jpg
            actual_path = output_path
            if not output_path.exists():
                # Try feeder pattern: scan_XXXX.1.jpg, scan_XXXX.*.jpg
                stem = output_path.stem  # "flat_0001" or "feed_0001"
                ext = output_path.suffix  # ".jpg"
                matches = sorted(SCAN_DIR.glob(f"{stem}.*{ext}"))
                if matches:
                    actual_path = matches[0]
                else:
                    stdout = result.stdout.strip() if result.stdout else ""
                    stderr = result.stderr.strip() if result.stderr else ""
                    detail = stdout or stderr or "file output tidak ditemukan"
                    raise ScannerError(detail)

            # Rename to clean name for consistency
            if actual_path != output_path:
                actual_path.rename(output_path)
                logger.info("NAPS2 ADF file renamed: %s → %s", actual_path.name, output_path.name)

            logger.info("NAPS2 scan complete: %s", output_path)
            return ScanResult(path=output_path, mode="naps2")

        except ScannerError:
            raise
        except Exception as exc:
            logger.error("NAPS2 scan failed: %s", exc)
            raise ScannerError(f"Scan gagal: {exc}") from exc

    def scan_adf_multi(self, device: ScannerDevice, settings: ScanSettings) -> list[ScanResult]:
        """Scan all pages from ADF using NAPS2 Console.

        NAPS2 --source feeder scans ALL pages in the feeder at once.
        With JPG output, NAPS2 creates numbered files:
            feed_0001.1.jpg, feed_0001.2.jpg, feed_0001.3.jpg ...
        This method collects them and renames to:
            feed_0001.jpg, feed_0002.jpg, feed_0003.jpg ...

        Returns:
            List of ScanResult, one per scanned page.

        Raises:
            ScannerError: On scan failure or empty feeder.
        """
        if ":" in device.id:
            driver, device_name = device.id.split(":", 1)
        else:
            driver = "wia"
            device_name = device.name

        # Generate base output path with feed prefix — NAPS2 will create .1, .2, .3 variants
        idx = len(list(SCAN_DIR.glob("feed_*.jpg"))) + 1
        output_base = SCAN_DIR / f"feed_{idx:04d}.jpg"

        args = [
            "--noprofile",
            "--driver", driver,
            "--device", device_name,
            "--source", "feeder",
            "--dpi", str(settings.dpi),
            "--bitdepth", _color_mode_to_naps2(settings.color_mode),
            "--pagesize", settings.paper_size.lower(),
            "-o", str(output_base),
            "-f",
        ]

        # Record existing files so we can detect new ones
        existing_files = set(SCAN_DIR.glob("feed_*.jpg"))

        try:
            result = _run_naps2(args, timeout=120)

            if result.returncode != 0:
                stderr = result.stderr.strip() if result.stderr else ""
                stdout = result.stdout.strip() if result.stdout else ""
                error_msg = stderr or stdout or f"NAPS2 exit code {result.returncode}"
                raise ScannerError(error_msg)

            # Collect new files created by NAPS2
            new_files = sorted(set(SCAN_DIR.glob("feed_*.jpg")) - existing_files)

            # Also check for numbered pattern: feed_XXXX.1.jpg, feed_XXXX.2.jpg
            stem = output_base.stem  # "feed_0001"
            ext = output_base.suffix  # ".jpg"
            numbered_files = sorted(SCAN_DIR.glob(f"{stem}.*{ext}"))
            # Filter out the base file itself
            numbered_files = [f for f in numbered_files if f.name != output_base.name]

            # Merge: new files from either detection method
            all_new = sorted(set(new_files) | set(numbered_files))

            if not all_new:
                # No pages in feeder
                stdout = result.stdout.strip() if result.stdout else ""
                stderr = result.stderr.strip() if result.stderr else ""
                detail = stdout or stderr or "Tidak ada halaman ditemukan di feeder"
                raise ScannerError(detail)

            # Rename to sequential clean names
            results: list[ScanResult] = []
            for page_num, src_file in enumerate(all_new):
                dest = SCAN_DIR / f"feed_{idx + page_num:04d}.jpg"
                if src_file != dest:
                    src_file.rename(dest)
                results.append(ScanResult(path=dest, mode="naps2"))
                logger.info("ADF page %d: %s", page_num + 1, dest.name)

            logger.info("NAPS2 ADF scan complete: %d page(s)", len(results))
            return results

        except ScannerError:
            raise
        except Exception as exc:
            logger.error("NAPS2 ADF scan failed: %s", exc)
            raise ScannerError(f"ADF scan gagal: {exc}") from exc

    def scan_feeder_page(self, device: ScannerDevice, settings: ScanSettings) -> ScanResult | None:
        """Scan a SINGLE page from the ADF/feeder.

        Returns:
            ScanResult for the scanned page, or None if the feeder is empty
            (no more pages — this is the normal way a page-by-page loop ends).

        Raises:
            ScannerError: On a genuine scan failure (NAPS2 missing, driver error).
        """
        if ":" in device.id:
            driver, device_name = device.id.split(":", 1)
        else:
            driver = "wia"
            device_name = device.name

        idx = len(list(SCAN_DIR.glob("feed_*.jpg"))) + 1
        output_path = SCAN_DIR / f"feed_{idx:04d}.jpg"
        existing_files = set(SCAN_DIR.glob("feed_*.jpg"))

        args = [
            "--noprofile",
            "--driver", driver,
            "--device", device_name,
            "--source", "feeder",
            "--dpi", str(settings.dpi),
            "--bitdepth", _color_mode_to_naps2(settings.color_mode),
            "--pagesize", settings.paper_size.lower(),
            "-o", str(output_path),
            "-f",
            "-n", "1",  # exactly one sheet per call
        ]

        result = _run_naps2(args, timeout=60)

        # Locate the produced file (base name or NAPS2 numbered variant).
        produced: Path | None = None
        if output_path.exists():
            produced = output_path
        else:
            stem = output_path.stem
            ext = output_path.suffix
            numbered = [
                f for f in SCAN_DIR.glob(f"{stem}.*{ext}")
                if f.name != output_path.name
            ]
            new_files = set(SCAN_DIR.glob("feed_*.jpg")) - existing_files
            candidates = sorted(set(numbered) | new_files)
            if candidates:
                produced = candidates[0]

        if produced is not None:
            if produced != output_path:
                produced.rename(output_path)
            logger.info("NAPS2 feeder page scanned: %s", output_path.name)
            return ScanResult(path=output_path, mode="naps2")

        # No file produced: distinguish "feeder empty" (normal) from a real error.
        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        combined = f"{stdout}\n{stderr}".lower()
        empty_markers = (
            "no pages",
            "no documents",
            "no more pages",
            "empty feeder",
            "feeder is empty",
            "tidak ada halaman",
        )
        if result.returncode == 0 or any(m in combined for m in empty_markers):
            logger.info(
                "NAPS2 feeder empty — stopping loop (rc=%d)", result.returncode
            )
            return None

        detail = stderr or stdout or f"NAPS2 exit code {result.returncode}"
        raise ScannerError(detail)

    def start_adf_scan(self, device: ScannerDevice, settings: ScanSettings, deskew: bool = False) -> str:
        """Start an ADF scan (all pages) as a background NAPS2 process.

        Returns a job_id. Call poll_adf_scan(job_id) repeatedly to collect the
        pages as NAPS2 writes them. A single NAPS2 session is used so every
        sheet in the feeder is scanned reliably (repeated one-shot feeder calls
        make some drivers report the feeder as empty after the first sheet).
        """
        naps2 = _find_naps2()

        if ":" in device.id:
            driver, device_name = device.id.split(":", 1)
        else:
            driver = "wia"
            device_name = device.name

        idx = len(list(SCAN_DIR.glob("feed_*.jpg"))) + 1
        base = f"feed_{idx:04d}"
        output_path = SCAN_DIR / f"{base}.jpg"

        args = [
            str(naps2),
            "--noprofile",
            "--driver", driver,
            "--device", device_name,
            "--source", "feeder",
            "--dpi", str(settings.dpi),
            "--bitdepth", _color_mode_to_naps2(settings.color_mode),
            "--pagesize", settings.paper_size.lower(),
            "-o", str(output_path),
            "-f",
        ]
        if deskew:
            args.append("--deskew")

        log_path = SCAN_DIR / f".{base}.log"
        log_fh = open(log_path, "w", encoding="utf-8", errors="replace")
        proc = subprocess.Popen(
            args,
            stdout=log_fh,
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
        )

        job_id = uuid.uuid4().hex
        _adf_jobs[job_id] = {
            "proc": proc,
            "base": base,
            "ext": ".jpg",
            "log_path": log_path,
            "log_fh": log_fh,
            "reported": 0,
            "sizes": {},
        }
        logger.info("NAPS2 ADF job %s started (base=%s)", job_id, base)
        return job_id

    def poll_adf_scan(self, job_id: str) -> dict:
        """Collect pages produced so far by an ADF job.

        Returns {"pages": [...], "done": bool, "error": str | None}. A file is
        only reported once it is safe to read (a newer page exists, its size has
        stopped changing, or the process finished) so the frontend never loads a
        half-written image.
        """
        job = _adf_jobs.get(job_id)
        if job is None:
            raise ScannerError("Job scan tidak ditemukan atau sudah selesai")

        base = job["base"]
        ext = job["ext"]

        numbered = sorted(SCAN_DIR.glob(f"{base}.*{ext}"))
        single = SCAN_DIR / f"{base}{ext}"
        files = list(numbered)
        if single.exists() and single not in files:
            files.append(single)
        files = sorted(set(files))

        rc = job["proc"].poll()
        running = rc is None
        sizes: dict[str, int] = job["sizes"]

        def _size(path: Path) -> int:
            try:
                return path.stat().st_size
            except OSError:
                return -1

        if not running:
            complete = files
        elif files:
            last = files[-1]
            last_size = _size(last)
            prev_size = sizes.get(last.name)
            if last_size > 0 and prev_size == last_size:
                complete = files
            else:
                complete = files[:-1]
        else:
            complete = []

        for f in files:
            sizes[f.name] = _size(f)

        pages = [
            {"path": str(f), "filename": f.name, "mode": "naps2", "ocr_text": ""}
            for f in complete
        ]
        job["reported"] = len(complete)

        error: str | None = None
        done = False
        if not running:
            done = True
            if not files:
                detail = ""
                try:
                    detail = job["log_path"].read_text(encoding="utf-8", errors="replace").strip()
                except OSError:
                    detail = ""
                combined = detail.lower()
                empty_markers = (
                    "no pages",
                    "no documents",
                    "no more pages",
                    "empty",
                    "feeder",
                    "tidak ada halaman",
                )
                if rc not in (0, None) and not any(m in combined for m in empty_markers):
                    error = detail or f"NAPS2 exit code {rc}"
            try:
                job["log_fh"].close()
            except Exception:  # noqa: BLE001
                pass
            _adf_jobs.pop(job_id, None)
            logger.info("NAPS2 ADF job %s done (rc=%s, pages=%d)", job_id, rc, len(files))

        return {"pages": pages, "done": done, "error": error}

    def is_available(self) -> bool:
        """Check if NAPS2 is installed and accessible."""
        try:
            _find_naps2()
            return True
        except ScannerError:
            return False


def cleanup_scan_files(filenames: list[str]) -> int:
    """Delete the named files from SCAN_DIR (basename only). Returns count deleted.

    Used by the ephemeral storage mode: once a scanned page has been loaded
    into the app's memory, its temporary file is removed so temp/scans never
    fills up.
    """
    deleted = 0
    for name in filenames:
        safe_name = Path(name).name  # ignore any directory components
        if not safe_name:
            continue
        target = SCAN_DIR / safe_name
        try:
            if target.exists() and target.is_file():
                target.unlink()
                deleted += 1
        except OSError as exc:
            logger.warning("cleanup: gagal menghapus %s: %s", target, exc)
    return deleted


def clear_scan_dir() -> int:
    """Remove every file in SCAN_DIR. Returns count deleted.

    Called on backend startup as a safety net so leftover scans from a previous
    session (e.g. a crash) don't accumulate.
    """
    deleted = 0
    for entry in SCAN_DIR.glob("*"):
        try:
            if entry.is_file():
                entry.unlink()
                deleted += 1
        except OSError as exc:
            logger.warning("clear_scan_dir: gagal menghapus %s: %s", entry, exc)
    return deleted
