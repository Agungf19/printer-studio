from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter

from app.schemas.printer import PrinterItem, PrinterListResponse

router = APIRouter(tags=["printers"])
logger = logging.getLogger(__name__)

# Try importing win32print (Windows only)
_win32print: Optional[object] = None
try:
    import win32print as _wp
    _win32print = _wp
except ImportError:
    logger.warning("win32print not available — printer detection disabled")


def _detect_printers() -> list[PrinterItem]:
    """Detect real Windows printers using win32print."""
    if _win32print is None:
        return []

    wp = _win32print  # type: ignore[assignment]
    printers: list[PrinterItem] = []

    try:
        # Enumerate local and network printers
        flags = wp.PRINTER_ENUM_LOCAL | wp.PRINTER_ENUM_CONNECTIONS
        raw_printers = wp.EnumPrinters(flags, None, 2)

        default_printer_name = ""
        try:
            default_printer_name = wp.GetDefaultPrinter()
        except Exception:
            pass

        # Filter: skip virtual printers (PDF, XPS, Fax, OneNote, etc.)
        virtual_keywords = [
            "pdf", "xps", "fax", "onenote", "onenote for windows",
            "document writer", "nitro", "send to", "microsoft print to",
            "microsoft xps", "portprompt", "shrfax",
        ]

        for printer_info in raw_printers:
            name = printer_info.get("pPrinterName", "")
            port = printer_info.get("pPortName", "")
            status_flags = printer_info.get("Status", 0)
            attributes = printer_info.get("Attributes", 0)

            # Skip virtual printers — only show physical/network printers
            name_lower = name.lower()
            port_lower = port.lower()
            if any(kw in name_lower or kw in port_lower for kw in virtual_keywords):
                continue

            # Determine status
            # Check PRINTER_ATTRIBUTE_WORK_OFFLINE (0x400) — set when Windows
            # detects the printer is unreachable (powered off, disconnected)
            work_offline = bool(attributes & 0x00000400)

            if status_flags & 0x00000002:  # PRINTER_STATUS_ERROR
                status = "offline"
            elif status_flags & 0x00000100:  # PRINTER_STATUS_OFFLINE
                status = "offline"
            elif work_offline:  # Printer unreachable (powered off / disconnected)
                status = "offline"
            elif status_flags & 0x00000200:  # PRINTER_STATUS_BUSY
                status = "busy"
            elif status_flags & 0x00001000:  # PRINTER_STATUS_PRINTING
                status = "busy"
            else:
                status = "online"

            # Determine connection type
            is_network = bool(attributes & 0x00000004)  # PRINTER_ATTRIBUTE_NETWORK
            is_shared = bool(attributes & 0x00000008)    # PRINTER_ATTRIBUTE_SHARED
            connection = f"Network ({port})" if is_network else f"USB ({port})"

            # Get queue count via job info
            queue_count = 0
            try:
                handle = wp.OpenPrinter(name)
                jobs = wp.EnumJobs(handle, 0, -1, 1)
                queue_count = len(jobs) if jobs else 0
                wp.ClosePrinter(handle)
            except Exception:
                pass

            printer_id = name.lower().replace(" ", "-").replace("(", "").replace(")", "")
            printers.append(PrinterItem(
                id=printer_id,
                name=name,
                connection=connection,
                status=status,
                shared=is_shared,
                queue_count=queue_count,
            ))

    except Exception as exc:
        logger.error("Printer detection failed: %s", exc)
        return []

    return printers


@router.get("/printers", response_model=PrinterListResponse)
def list_printers() -> PrinterListResponse:
    printers = _detect_printers()
    return PrinterListResponse(items=printers)


@router.get("/paper-sizes")
def list_paper_sizes(printer_name: str = "") -> dict:
    """Return paper sizes supported by a specific printer (from Windows driver)."""
    if _win32print is None:
        return {"items": []}

    wp = _win32print  # type: ignore[assignment]

    try:
        # Use provided printer name or fall back to default
        target_printer = printer_name
        if not target_printer:
            try:
                target_printer = wp.GetDefaultPrinter()
            except Exception:
                return {"items": []}

        try:
            import win32con  # type: ignore[import-not-found]
            names = wp.DeviceCapabilities(target_printer, "", win32con.DC_PAPERNAMES)
            ids = wp.DeviceCapabilities(target_printer, "", win32con.DC_PAPERS)
        except Exception:
            names = []
            ids = []

        items = []
        if names and ids:
            for name, paper_id in zip(names, ids):
                items.append({"id": int(paper_id), "name": str(name).strip()})

        return {"items": items, "printer": target_printer}
    except Exception as exc:
        logger.error("Paper size detection failed: %s", exc)
        return {"items": []}
