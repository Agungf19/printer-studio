from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.core.naps2_service import Naps2ScannerService, ScannerDevice, ScannerError, ScanSettings
from app.schemas.scanner import ScanRequest, ScanResponse, ScanBatchResponse, ScannerItem, ScannerListResponse

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
