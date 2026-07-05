from __future__ import annotations

from pydantic import BaseModel, Field


class OutputProfilePayload(BaseModel):
    name: str = Field(min_length=1)
    target_size_kb: int = Field(default=1000, ge=1)
    output_format: str = "PNG"
    quality: str = "Auto"
    dpi: int = 300
    color_mode: str = "Color"
    paper_size: str = "A4"
    ocr_language: str = "ind+eng"


class ProfileListResponse(BaseModel):
    items: list[OutputProfilePayload]
