from __future__ import annotations

import base64
import binascii
import logging
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.core.naps2_service import (
    Naps2ScannerService,
    ScannerDevice,
    ScannerError,
    ScanSettings,
    cleanup_scan_files,
)
from app.schemas.scanner import (
    ScanRequest,
    ScanResponse,
    ScanBatchResponse,
    ScanFeederPageResponse,
    ScanAdfStartResponse,
    ScanAdfPollResponse,
    ScannerItem,
    ScannerListResponse,
    ScanCleanupRequest,
    ScanCleanupResponse,
    SavePdfRequest,
    SavePdfResponse,
    DeskewRequest,
    DeskewResponse,
)

router = APIRouter(tags=["scanners"])
logger = logging.getLogger(__name__)
scanner_service = Naps2ScannerService()


def _post_process(image_path: Path, deskew: bool, ocr: bool) -> tuple[Path, str]:
    """Apply post-processing to scanned image. Returns (processed_path, ocr_text)."""
    ocr_text = ""
    try:
        import cv2
        import numpy as np

        img = cv2.imread(str(image_path))
        if img is None:
            return image_path, ocr_text

        processed = img

        # --- Deskew: straighten rotated image ---
        if deskew:
            try:
                gray = cv2.cvtColor(processed, cv2.COLOR_BGR2GRAY)
                gray = cv2.bitwise_not(gray)
                coords = np.column_stack(np.where(gray > 0))
                if len(coords) > 100:
                    angle = cv2.minAreaRect(coords)[-1]
                    if angle < -45:
                        angle = -(90 + angle)
                    else:
                        angle = -angle
                    # Only correct if rotation is meaningful (>0.5 deg)
                    if abs(angle) > 0.5:
                        h, w = processed.shape[:2]
                        center = (w // 2, h // 2)
                        matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
                        processed = cv2.warpAffine(
                            processed, matrix, (w, h),
                            flags=cv2.INTER_CUBIC,
                            borderMode=cv2.BORDER_REPLICATE,
                        )
                        logger.info("Deskew: rotated %.1f degrees", angle)
            except Exception as exc:
                logger.warning("Deskew failed: %s", exc)

        # Save processed image (overwrite original)
        if processed is not img:
            cv2.imwrite(str(image_path), processed)

    except ImportError:
        logger.warning("cv2/numpy not available — skipping post-processing")

    # --- OCR: extract text ---
    if ocr:
        try:
            import pytesseract
            from PIL import Image

            pil_img = Image.open(image_path)
            ocr_text = pytesseract.image_to_string(pil_img, lang="ind+eng")
            ocr_text = ocr_text.strip()
            logger.info("OCR: extracted %d characters", len(ocr_text))
        except ImportError:
            logger.warning("pytesseract/PIL not available — skipping OCR")
        except Exception as exc:
            logger.warning("OCR failed: %s", exc)

    return image_path, ocr_text


@router.get("/scanners", response_model=ScannerListResponse)
def list_scanners() -> ScannerListResponse:
    devices = scanner_service.list_devices()
    return ScannerListResponse(
        items=[ScannerItem(id=device.id, name=device.name, description=device.description, has_adf=device.has_adf) for device in devices]
    )


@router.post("/scan", response_model=ScanResponse)
def scan_single_page(payload: ScanRequest) -> ScanResponse:
    devices = scanner_service.list_devices()
    selected_device = next((device for device in devices if device.id == payload.scanner_id), None)
    if selected_device is None:
        raise HTTPException(status_code=404, detail="Scanner tidak ditemukan")

    settings = ScanSettings(
        dpi=payload.dpi,
        color_mode=payload.color_mode,
        paper_size=payload.paper_size,
        source=payload.source,
    )
    try:
        result = scanner_service.scan_single_page(
            ScannerDevice(
                id=selected_device.id,
                name=selected_device.name,
                description=selected_device.description,
            ),
            settings,
        )
    except ScannerError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Post-processing: deskew, OCR
    _, ocr_text = _post_process(
        result.path,
        deskew=payload.deskew,
        ocr=payload.ocr,
    )

    return ScanResponse(
        path=str(result.path),
        filename=result.path.name,
        mode=result.mode,
        ocr_text=ocr_text,
    )


@router.post("/scan/batch", response_model=ScanBatchResponse)
def scan_batch(payload: ScanRequest) -> ScanBatchResponse:
    """Scan all pages from ADF in one call. Returns all scanned pages."""
    devices = scanner_service.list_devices()
    selected_device = next((device for device in devices if device.id == payload.scanner_id), None)
    if selected_device is None:
        raise HTTPException(status_code=404, detail="Scanner tidak ditemukan")

    settings = ScanSettings(
        dpi=payload.dpi,
        color_mode=payload.color_mode,
        paper_size=payload.paper_size,
        source=payload.source,
    )
    try:
        results = scanner_service.scan_adf_multi(
            ScannerDevice(
                id=selected_device.id,
                name=selected_device.name,
                description=selected_device.description,
            ),
            settings,
        )
    except ScannerError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    pages: list[ScanResponse] = []
    for result in results:
        _, ocr_text = _post_process(result.path, deskew=payload.deskew, ocr=payload.ocr)
        pages.append(ScanResponse(
            path=str(result.path),
            filename=result.path.name,
            mode=result.mode,
            ocr_text=ocr_text,
        ))

    return ScanBatchResponse(pages=pages, page_count=len(pages))


@router.post("/scan/feeder-page", response_model=ScanFeederPageResponse)
def scan_feeder_page(payload: ScanRequest) -> ScanFeederPageResponse:
    """Scan ONE page from the ADF feeder.

    Returns done=True when the feeder is empty (normal end of a batch loop).
    The frontend calls this repeatedly so it can show real per-page progress
    and render each page the moment the scanner produces it.
    """
    devices = scanner_service.list_devices()
    selected_device = next((device for device in devices if device.id == payload.scanner_id), None)
    if selected_device is None:
        raise HTTPException(status_code=404, detail="Scanner tidak ditemukan")

    settings = ScanSettings(
        dpi=payload.dpi,
        color_mode=payload.color_mode,
        paper_size=payload.paper_size,
        source="feeder",
    )
    try:
        result = scanner_service.scan_feeder_page(
            ScannerDevice(
                id=selected_device.id,
                name=selected_device.name,
                description=selected_device.description,
            ),
            settings,
        )
    except ScannerError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if result is None:
        return ScanFeederPageResponse(page=None, done=True)

    _, ocr_text = _post_process(result.path, deskew=payload.deskew, ocr=payload.ocr)
    return ScanFeederPageResponse(
        page=ScanResponse(
            path=str(result.path),
            filename=result.path.name,
            mode=result.mode,
            ocr_text=ocr_text,
        ),
        done=False,
    )


def _device_from_id(scanner_id: str) -> ScannerDevice:
    """Build a minimal ScannerDevice from a 'driver:name' scanner id.

    Avoids a slow --listdevices enumeration on every scan/poll call.
    """
    if ":" in scanner_id:
        _, name = scanner_id.split(":", 1)
    else:
        name = scanner_id
    return ScannerDevice(id=scanner_id, name=name)


@router.post("/scan/adf/start", response_model=ScanAdfStartResponse)
def scan_adf_start(payload: ScanRequest) -> ScanAdfStartResponse:
    """Start an ADF batch scan in the background.

    Uses ONE NAPS2 feeder session (so every sheet is scanned reliably) while
    writing pages to disk one-by-one. Poll /scan/adf/poll/{job_id} to collect
    pages as they appear, enabling real per-page progress.
    """
    settings = ScanSettings(
        dpi=payload.dpi,
        color_mode=payload.color_mode,
        paper_size=payload.paper_size,
        source="feeder",
    )
    try:
        job_id = scanner_service.start_adf_scan(
            _device_from_id(payload.scanner_id),
            settings,
            deskew=payload.deskew,
        )
    except ScannerError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return ScanAdfStartResponse(job_id=job_id)


@router.get("/scan/adf/poll/{job_id}", response_model=ScanAdfPollResponse)
def scan_adf_poll(job_id: str) -> ScanAdfPollResponse:
    """Return pages produced so far by an ADF job, plus done/error state."""
    try:
        state = scanner_service.poll_adf_scan(job_id)
    except ScannerError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    pages = [ScanResponse(**page) for page in state["pages"]]
    return ScanAdfPollResponse(
        pages=pages,
        done=bool(state["done"]),
        error=state["error"],
    )


@router.post("/scan/cleanup", response_model=ScanCleanupResponse)
def scan_cleanup(payload: ScanCleanupRequest) -> ScanCleanupResponse:
    """Delete temporary scan files from temp/scans (ephemeral storage mode).

    The frontend keeps scanned images in memory and calls this immediately
    after each page is loaded, so nothing lingers on disk.
    """
    deleted = cleanup_scan_files(payload.filenames)
    return ScanCleanupResponse(deleted=deleted)


def _decode_page_image(chunk: str, page_number: int) -> bytes:
    data = (chunk or "").strip()
    if data.startswith("data:") and "," in data:
        data = data.split(",", 1)[1]
    data = "".join(data.split())
    if not data:
        raise HTTPException(
            status_code=400,
            detail=f"Halaman {page_number} kosong",
        )
    try:
        return base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Halaman {page_number} bukan base64 yang valid",
        ) from exc


def _images_to_pdf_bytes(images_b64: list[str]) -> bytes:
    """Build a single PDF (bytes) from base64-encoded page images."""
    from PIL import Image, ImageOps, UnidentifiedImageError

    pdf_pages: list[Image.Image] = []
    try:
        for page_number, chunk in enumerate(images_b64, start=1):
            raw = _decode_page_image(chunk, page_number)
            try:
                with Image.open(BytesIO(raw)) as img:
                    img = ImageOps.exif_transpose(img)
                    has_alpha = img.mode in ("RGBA", "LA") or (
                        img.mode == "P" and "transparency" in img.info
                    )
                    if has_alpha:
                        rgba = img.convert("RGBA")
                        normalized = Image.new("RGB", rgba.size, (255, 255, 255))
                        normalized.paste(rgba, mask=rgba.getchannel("A"))
                    else:
                        normalized = img.convert("RGB")
                    pdf_pages.append(normalized)
            except UnidentifiedImageError as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Halaman {page_number} bukan gambar yang valid",
                ) from exc

        if not pdf_pages:
            raise HTTPException(status_code=400, detail="Tidak ada halaman untuk PDF")

        output = BytesIO()
        first, rest = pdf_pages[0], pdf_pages[1:]
        first.save(
            output,
            format="PDF",
            save_all=True,
            append_images=rest,
            resolution=300.0,
        )
        return output.getvalue()
    finally:
        for page in pdf_pages:
            page.close()


@router.post("/save/pdf", response_model=SavePdfResponse)
def save_pdf(payload: SavePdfRequest) -> SavePdfResponse:
    """Combine all in-memory page images into ONE PDF and return it as base64.

    The desktop app then writes the bytes to the user-chosen path. No scan
    files are persisted on the server (ephemeral mode).
    """
    if not payload.pages:
        raise HTTPException(status_code=400, detail="Tidak ada halaman untuk disimpan")
    try:
        pdf_bytes = _images_to_pdf_bytes(payload.pages)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - surface a friendly message
        logger.exception("save_pdf failed")
        raise HTTPException(status_code=500, detail=f"Gagal membuat PDF: {exc}") from exc
    return SavePdfResponse(pdfBase64=base64.b64encode(pdf_bytes).decode("ascii"))


def _deskew_image_b64(image_b64: str) -> str:
    """Straighten a base64-encoded image using OpenCV and return base64 PNG."""
    import cv2
    import numpy as np

    raw = base64.b64decode(image_b64)
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Gambar tidak valid")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.bitwise_not(gray)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(thresh > 0))

    angle = 0.0
    if len(coords) > 100:
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle

    if abs(angle) > 0.1:
        h, w = img.shape[:2]
        center = (w // 2, h // 2)
        matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
        img = cv2.warpAffine(
            img,
            matrix,
            (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(255, 255, 255),
        )
        logger.info("Deskew endpoint: rotated %.2f degrees", angle)

    ok, buf = cv2.imencode(".png", img)
    if not ok:
        raise HTTPException(status_code=500, detail="Gagal meng-encode gambar")
    return base64.b64encode(buf.tobytes()).decode("ascii")


@router.post("/image/deskew", response_model=DeskewResponse)
def deskew_image(payload: DeskewRequest) -> DeskewResponse:
    """Luruskan (deskew) satu gambar halaman yang dikirim sebagai base64.

    Menerima base64 mentah atau data URL. Mengembalikan PNG base64.
    """
    data = payload.image or ""
    if data.startswith("data:") and "," in data:
        data = data.split(",", 1)[1]
    if not data:
        raise HTTPException(status_code=400, detail="Gambar kosong")
    try:
        result = _deskew_image_b64(data)
    except HTTPException:
        raise
    except ImportError as exc:
        raise HTTPException(
            status_code=500, detail="OpenCV tidak tersedia di server"
        ) from exc
    except Exception as exc:  # noqa: BLE001
        logger.warning("Deskew endpoint gagal: %s", exc)
        raise HTTPException(
            status_code=500, detail="Gagal meluruskan gambar"
        ) from exc
    return DeskewResponse(image=result)
