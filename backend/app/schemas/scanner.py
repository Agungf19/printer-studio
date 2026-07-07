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


class ScanFeederPageResponse(BaseModel):
    page: ScanResponse | None = None
    done: bool = False


class ScanAdfStartResponse(BaseModel):
    job_id: str


class ScanAdfPollResponse(BaseModel):
    pages: list[ScanResponse]
    done: bool = False
    error: str | None = None


class ScanCleanupRequest(BaseModel):
    filenames: list[str] = Field(default_factory=list)


class ScanCleanupResponse(BaseModel):
    deleted: int = 0


class SavePdfRequest(BaseModel):
    pages: list[str] = Field(default_factory=list)


class SavePdfResponse(BaseModel):
    pdfBase64: str


class DeskewRequest(BaseModel):
    image: str


class DeskewResponse(BaseModel):
    image: str
