from __future__ import annotations

import base64
import binascii
import logging
import mimetypes
import re
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from app.core.sharing_service import SharingService
from app.core.naps2_service import cleanup_scan_files
from app.api.printers import _detect_printers
from app.api.scanners import list_scanners, scan_batch, scan_single_page
from app.core.paths import shared_print_dir
from app.schemas.sharing import (
    PairRequest,
    PairResponse,
    PermissionRequest,
    PermissionResponse,
    PermissionsListResponse,
    PinRequest,
    PinResponse,
    RemoteDeviceResponse,
    RemotePrintRequest,
    RemotePrintResponse,
    RemoteScanPage,
    RemoteScanRequest,
    RemoteScanResponse,
    SharingClientsResponse,
    SharingClientResponse,
    SharingStatusResponse,
)

router = APIRouter(tags=["sharing"])
sharing_service = SharingService()
logger = logging.getLogger(__name__)
PRINT_SPOOL_DIR = shared_print_dir()


@router.get("/sharing/status", response_model=SharingStatusResponse)
def sharing_status() -> SharingStatusResponse:
    status = sharing_service.build_host_status()
    return SharingStatusResponse(**status.__dict__)


@router.post("/sharing/start", response_model=SharingStatusResponse)
def sharing_start() -> SharingStatusResponse:
    status = sharing_service.start()
    return SharingStatusResponse(**status.__dict__)


@router.post("/sharing/stop", response_model=SharingStatusResponse)
def sharing_stop() -> SharingStatusResponse:
    status = sharing_service.stop()
    return SharingStatusResponse(**status.__dict__)


@router.post("/sharing/pair", response_model=PairResponse)
def sharing_pair(payload: PairRequest) -> PairResponse:
    try:
        client = sharing_service.pair_client(
            payload.client_name,
            payload.pairing_code,
            payload.pin,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PairResponse(status="paired", client_name=client.name, token=client.token)


@router.get("/sharing/clients", response_model=SharingClientsResponse)
def sharing_clients() -> SharingClientsResponse:
    return SharingClientsResponse(
        items=[
            SharingClientResponse(name=client.name, paired_at=client.paired_at)
            for client in sharing_service.list_clients()
        ]
    )


@router.post("/sharing/permissions", response_model=PermissionResponse)
def set_permission(payload: PermissionRequest) -> PermissionResponse:
    client_name = payload.client_name.strip()
    try:
        sharing_service.set_permission(client_name, payload.level)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PermissionResponse(client_name=client_name, level=payload.level)


@router.get("/sharing/permissions", response_model=PermissionsListResponse)
def list_permissions() -> PermissionsListResponse:
    perms = sharing_service.list_permissions()
    return PermissionsListResponse(
        items=[PermissionResponse(client_name=name, level=level) for name, level in perms.items()]
    )


@router.delete("/sharing/permissions/{client_name}")
def remove_permission(client_name: str) -> dict:
    removed = sharing_service.remove_permission(client_name)
    return {"status": "removed" if removed else "not_found", "client_name": client_name}


@router.post("/sharing/clients/{token}/revoke")
def revoke_client(token: str) -> dict:
    revoked = sharing_service.revoke_client(token)
    return {"status": "revoked" if revoked else "not_found"}


@router.get("/sharing/pin", response_model=PinResponse)
def get_pin() -> PinResponse:
    pin = sharing_service.get_pin()
    return PinResponse(has_pin=bool(pin), pin=pin)


@router.post("/sharing/pin", response_model=PinResponse)
def set_pin(payload: PinRequest) -> PinResponse:
    try:
        sharing_service.set_pin(payload.pin)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PinResponse(has_pin=True, pin=payload.pin)


@router.delete("/sharing/pin")
def clear_pin() -> PinResponse:
    sharing_service.clear_pin()
    return PinResponse(has_pin=False, pin="")


@router.get("/sharing/client", response_class=HTMLResponse)
def sharing_client_page() -> HTMLResponse:
    return HTMLResponse(_CLIENT_HTML)


@router.get("/sharing/remote/scanners", response_model=RemoteDeviceResponse)
def remote_scanners(token: str) -> RemoteDeviceResponse:
    try:
        sharing_service.ensure_allowed(token, "scan")
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return RemoteDeviceResponse(items=[item.model_dump() for item in list_scanners().items])


@router.get("/sharing/remote/printers", response_model=RemoteDeviceResponse)
def remote_printers(token: str) -> RemoteDeviceResponse:
    try:
        sharing_service.ensure_allowed(token, "print")
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    printers = [item for item in _detect_printers() if item.status == "online"]
    return RemoteDeviceResponse(items=[item.model_dump() for item in printers])


@router.post("/sharing/remote/scan", response_model=RemoteScanResponse)
def remote_scan(payload: RemoteScanRequest) -> RemoteScanResponse:
    try:
        sharing_service.ensure_allowed(payload.token, "scan")
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    pages = []
    filenames: list[str] = []
    try:
        source = (payload.source or "").lower()
        if "feeder" in source or "adf" in source:
            result = scan_batch(payload)
            pages = result.pages
        else:
            pages = [scan_single_page(payload)]

        filenames = [page.filename for page in pages if page.filename]
        remote_pages = [_scan_page_to_remote(page, index + 1) for index, page in enumerate(pages)]
        return RemoteScanResponse(pages=remote_pages, page_count=len(remote_pages))
    finally:
        if filenames:
            cleanup_scan_files(filenames)


@router.post("/sharing/remote/print", response_model=RemotePrintResponse)
def remote_print(payload: RemotePrintRequest) -> RemotePrintResponse:
    try:
        sharing_service.ensure_allowed(payload.token, "print")
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    raw = _decode_file_base64(payload.file_base64)
    filename = _safe_filename(payload.filename)
    if not filename:
        raise HTTPException(status_code=400, detail="Nama file tidak valid")
    if len(raw) > 75 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 75 MB")

    spool_path = PRINT_SPOOL_DIR / f"{int(time.time())}-{filename}"
    spool_path.write_bytes(raw)

    try:
        printer_name = _print_file(spool_path, payload.printer_name.strip())
    except Exception as exc:  # noqa: BLE001 - surface printer errors to client
        logger.exception("Remote print failed")
        raise HTTPException(status_code=500, detail=f"Gagal mencetak: {exc}") from exc

    return RemotePrintResponse(
        status="queued",
        message="Dokumen sudah dikirim ke printer host.",
        printer_name=printer_name,
    )


def _decode_file_base64(data: str) -> bytes:
    cleaned = (data or "").strip()
    if cleaned.startswith("data:") and "," in cleaned:
        cleaned = cleaned.split(",", 1)[1]
    cleaned = "".join(cleaned.split())
    if not cleaned:
        raise HTTPException(status_code=400, detail="File kosong")
    try:
        return base64.b64decode(cleaned, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="File bukan base64 yang valid") from exc


def _safe_filename(filename: str) -> str:
    name = Path(filename or "dokumen").name
    return re.sub(r"[^A-Za-z0-9._ -]+", "_", name).strip(" .")


def _scan_page_to_remote(page, page_number: int) -> RemoteScanPage:
    path = Path(page.path)
    if not path.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Hasil scan halaman {page_number} tidak ditemukan",
        )
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return RemoteScanPage(
        filename=page.filename or f"scan-{page_number}.png",
        mime=mime,
        data_base64=data,
        ocr_text=getattr(page, "ocr_text", "") or "",
    )


def _print_file(file_path: Path, printer_name: str = "") -> str:
    ext = file_path.suffix.lower()
    target_printer = printer_name or _get_default_printer()
    if ext in {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff"}:
        try:
            _print_image_file(file_path, target_printer)
            return target_printer
        except Exception:
            logger.warning("Direct image print failed, falling back to shell print", exc_info=True)
    _shell_print_file(file_path, target_printer)
    return target_printer


def _get_default_printer() -> str:
    try:
        import win32print

        return win32print.GetDefaultPrinter()
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError("Printer default Windows tidak ditemukan") from exc


def _print_image_file(file_path: Path, printer_name: str) -> None:
    import win32con
    import win32ui
    from PIL import Image, ImageOps, ImageWin

    image = ImageOps.exif_transpose(Image.open(file_path)).convert("RGB")
    hdc = win32ui.CreateDC()
    try:
        hdc.CreatePrinterDC(printer_name)
        printable_width = hdc.GetDeviceCaps(win32con.HORZRES)
        printable_height = hdc.GetDeviceCaps(win32con.VERTRES)
        scale = min(printable_width / image.width, printable_height / image.height)
        width = int(image.width * scale)
        height = int(image.height * scale)
        left = int((printable_width - width) / 2)
        top = int((printable_height - height) / 2)

        hdc.StartDoc(file_path.name)
        hdc.StartPage()
        dib = ImageWin.Dib(image)
        dib.draw(hdc.GetHandleOutput(), (left, top, left + width, top + height))
        hdc.EndPage()
        hdc.EndDoc()
    finally:
        image.close()
        hdc.DeleteDC()


def _shell_print_file(file_path: Path, printer_name: str) -> None:
    try:
        import win32api

        verb = "printto" if printer_name else "print"
        params = f'"{printer_name}"' if printer_name else None
        result = win32api.ShellExecute(0, verb, str(file_path), params, None, 0)
        if result <= 32:
            raise RuntimeError(f"Shell print gagal dengan kode {result}")
    except ImportError as exc:
        raise RuntimeError("pywin32 tidak tersedia untuk mencetak") from exc


_CLIENT_HTML = r"""<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PrintStudio Client</title>
  <style>
    :root {
      color-scheme: light;
      --text: #243042;
      --muted: #6b7280;
      --line: #d7dde8;
      --blue: #2563eb;
      --green: #178557;
      --red: #dc2626;
      --bg: #eef2f8;
      --panel: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    main {
      width: min(980px, calc(100vw - 28px));
      margin: 28px auto;
      display: grid;
      gap: 14px;
    }
    header, section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 18px;
      box-shadow: 0 8px 24px rgba(31, 41, 55, 0.08);
    }
    h1, h2 { margin: 0; }
    h1 { font-size: 22px; }
    h2 { font-size: 16px; margin-bottom: 12px; }
    p { margin: 6px 0 0; color: var(--muted); line-height: 1.5; }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    label {
      display: grid;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
    }
    input, select, button {
      height: 38px;
      border-radius: 7px;
      border: 1px solid var(--line);
      padding: 0 10px;
      font: inherit;
      background: #fff;
      color: var(--text);
    }
    input[type="file"] {
      height: auto;
      padding: 9px;
    }
    button {
      border-color: var(--blue);
      background: var(--blue);
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    }
    button.secondary {
      border-color: var(--line);
      background: #fff;
      color: var(--text);
    }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    .actions { display: flex; gap: 8px; align-items: center; margin-top: 14px; }
    .status {
      min-height: 38px;
      display: flex;
      align-items: center;
      padding: 9px 11px;
      border-radius: 7px;
      background: #f8fafc;
      border: 1px solid var(--line);
      color: var(--muted);
      font-size: 13px;
    }
    .ok { color: var(--green); }
    .err { color: var(--red); }
    .hide { display: none; }
    @media (max-width: 720px) {
      .grid { grid-template-columns: 1fr; }
      main { margin: 14px auto; width: calc(100vw - 20px); }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>PrintStudio Client</h1>
      <p>Terhubung ke host: <strong id="host"></strong></p>
    </header>

    <section id="pairSection">
      <h2>Hubungkan ke PrintStudio Host</h2>
      <div class="grid">
        <label>Nama PC Client
          <input id="clientName" placeholder="PC Client" />
        </label>
        <label>Kode Pairing
          <input id="pairingCode" inputmode="numeric" placeholder="6 digit" />
        </label>
        <label>PIN
          <input id="pin" type="password" placeholder="Kosongkan jika host tidak memakai PIN" />
        </label>
      </div>
      <div class="actions">
        <button id="pairBtn">Hubungkan</button>
        <button id="forgetBtn" class="secondary">Putuskan</button>
      </div>
      <p id="pairStatus" class="status">Masukkan kode dari modal Berbagi di PC host.</p>
    </section>

    <section id="workSection" class="hide">
      <h2>Scan dari PC Host</h2>
      <div class="grid">
        <label>Scanner
          <select id="scanner"></select>
        </label>
        <label>Sumber
          <select id="source">
            <option value="Flatbed">Flatbed</option>
            <option value="Document Feeder">Document Feeder</option>
          </select>
        </label>
        <label>DPI
          <select id="dpi">
            <option>150</option>
            <option selected>300</option>
            <option>600</option>
          </select>
        </label>
        <label>Mode Warna
          <select id="colorMode">
            <option selected>Color</option>
            <option>Grayscale</option>
            <option>Black & White</option>
          </select>
        </label>
      </div>
      <div class="actions">
        <button id="scanBtn">Mulai Scan</button>
      </div>
      <p id="scanStatus" class="status">Hasil scan akan otomatis diunduh ke PC client.</p>
    </section>

    <section id="printSection" class="hide">
      <h2>Cetak di Printer Host</h2>
      <div class="grid">
        <label>Printer
          <select id="printer"></select>
        </label>
        <label>File
          <input id="printFile" type="file" accept=".pdf,.png,.jpg,.jpeg,.bmp,.tif,.tiff,.txt,.doc,.docx" />
        </label>
      </div>
      <div class="actions">
        <button id="printBtn">Kirim ke Printer</button>
      </div>
      <p id="printStatus" class="status">File akan dikirim ke PC host lalu dicetak dari printer host.</p>
    </section>
  </main>

  <script>
    const $ = (id) => document.getElementById(id);
    const state = { token: localStorage.getItem("printstudio-token") || "" };
    $("host").textContent = location.host;
    $("clientName").value = localStorage.getItem("printstudio-client-name") || "";

    function setStatus(el, text, tone) {
      el.textContent = text;
      el.className = "status" + (tone ? " " + tone : "");
    }

    async function request(path, options = {}) {
      const response = await fetch(path, options);
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.detail || "Request gagal");
      return data;
    }

    function setConnected(connected) {
      $("workSection").classList.toggle("hide", !connected);
      $("printSection").classList.toggle("hide", !connected);
      if (connected) loadDevices();
    }

    function fillSelect(select, items, valueKey, labelKey) {
      select.replaceChildren();
      items.forEach((item) => {
        const option = document.createElement("option");
        option.value = item[valueKey] || "";
        option.textContent = item[labelKey] || item[valueKey] || "";
        select.appendChild(option);
      });
    }

    async function loadDevices() {
      try {
        const [scanners, printers] = await Promise.all([
          request(`/sharing/remote/scanners?token=${encodeURIComponent(state.token)}`),
          request(`/sharing/remote/printers?token=${encodeURIComponent(state.token)}`),
        ]);
        fillSelect($("scanner"), scanners.items, "id", "name");
        fillSelect($("printer"), printers.items, "name", "name");
        if (!scanners.items.length) setStatus($("scanStatus"), "Tidak ada scanner yang terdeteksi di host.", "err");
        if (!printers.items.length) setStatus($("printStatus"), "Tidak ada printer online yang terdeteksi di host.", "err");
      } catch (err) {
        setConnected(false);
        setStatus($("pairStatus"), err.message, "err");
      }
    }

    $("pairBtn").onclick = async () => {
      $("pairBtn").disabled = true;
      try {
        const payload = {
          client_name: $("clientName").value || "Client",
          pairing_code: $("pairingCode").value,
          pin: $("pin").value,
        };
        const result = await request("/sharing/pair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        state.token = result.token;
        localStorage.setItem("printstudio-token", state.token);
        localStorage.setItem("printstudio-client-name", payload.client_name);
        setStatus($("pairStatus"), `Terhubung sebagai ${result.client_name}.`, "ok");
        setConnected(true);
      } catch (err) {
        setStatus($("pairStatus"), err.message, "err");
      } finally {
        $("pairBtn").disabled = false;
      }
    };

    $("forgetBtn").onclick = () => {
      state.token = "";
      localStorage.removeItem("printstudio-token");
      setConnected(false);
      setStatus($("pairStatus"), "Koneksi client diputus dari browser ini.", "");
    };

    $("scanBtn").onclick = async () => {
      $("scanBtn").disabled = true;
      setStatus($("scanStatus"), "Memindai di PC host...", "");
      try {
        const result = await request("/sharing/remote/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: state.token,
            scanner_id: $("scanner").value,
            source: $("source").value,
            dpi: Number($("dpi").value),
            color_mode: $("colorMode").value,
            paper_size: "A4",
            deskew: true,
            ocr: false,
          }),
        });
        result.pages.forEach((page, index) => {
          const bytes = atob(page.data_base64);
          const data = new Uint8Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) data[i] = bytes.charCodeAt(i);
          const blob = new Blob([data], { type: page.mime });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = page.filename || `scan-${index + 1}.png`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        });
        setStatus($("scanStatus"), `${result.page_count} halaman selesai dan dikirim ke Downloads client.`, "ok");
      } catch (err) {
        setStatus($("scanStatus"), err.message, "err");
      } finally {
        $("scanBtn").disabled = false;
      }
    };

    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Gagal membaca file"));
        reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
        reader.readAsDataURL(file);
      });
    }

    $("printBtn").onclick = async () => {
      const file = $("printFile").files[0];
      if (!file) {
        setStatus($("printStatus"), "Pilih file dulu.", "err");
        return;
      }
      $("printBtn").disabled = true;
      setStatus($("printStatus"), "Mengirim file ke PC host...", "");
      try {
        const file_base64 = await fileToBase64(file);
        const result = await request("/sharing/remote/print", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: state.token,
            filename: file.name,
            file_base64,
            printer_name: $("printer").value,
          }),
        });
        setStatus($("printStatus"), `${result.message} (${result.printer_name})`, "ok");
      } catch (err) {
        setStatus($("printStatus"), err.message, "err");
      } finally {
        $("printBtn").disabled = false;
      }
    };

    if (state.token) {
      setStatus($("pairStatus"), "Token tersimpan. Mengecek akses...", "");
      setConnected(true);
    }
  </script>
</body>
</html>
"""
