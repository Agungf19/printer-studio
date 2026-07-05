from __future__ import annotations

from pydantic import BaseModel, Field


class ScannerItem(BaseModel):
    id: str
    name: str
    description: str = ""
    has_adf: bool = False


class ScannerListResponse(BaseModel):
    items: list[ScannerItem]


class ScanRequest(BaseModel):
    scanner_id: str
    source: str = "Flatbed"
    dpi: int = Field(default=300, ge=75, le=1200)
    color_mode: str = "Color"
    paper_size: str = "A4"
    deskew: bool = False
    ocr: bool = False


class ScanResponse(BaseModel):
    path: str
    filename: str
    mode: str = "naps2"
    ocr_text: str = ""


class ScanBatchResponse(BaseModel):
    pages: list[ScanResponse]
    page_count: int
