from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.scanner import ScanRequest


class SharingStatusResponse(BaseModel):
    hostname: str
    local_ip: str
    port: int
    pairing_code: str
    is_ready: bool
    is_active: bool
    client_count: int
    message: str


class PairRequest(BaseModel):
    client_name: str = "Client"
    pairing_code: str
    pin: str = ""


class PairResponse(BaseModel):
    status: str
    client_name: str
    token: str


class SharingClientResponse(BaseModel):
    name: str
    paired_at: float


class SharingClientsResponse(BaseModel):
    items: list[SharingClientResponse]


class PermissionRequest(BaseModel):
    client_name: str
    level: str = "scan+print"


class PermissionResponse(BaseModel):
    client_name: str
    level: str


class PermissionsListResponse(BaseModel):
    items: list[PermissionResponse]


class PinRequest(BaseModel):
    pin: str


class PinResponse(BaseModel):
    has_pin: bool
    pin: str = ""


class RemoteScanRequest(ScanRequest):
    token: str


class RemoteScanPage(BaseModel):
    filename: str
    mime: str
    data_base64: str
    ocr_text: str = ""


class RemoteScanResponse(BaseModel):
    pages: list[RemoteScanPage]
    page_count: int


class RemotePrintRequest(BaseModel):
    token: str
    filename: str
    file_base64: str
    printer_name: str = ""


class RemotePrintResponse(BaseModel):
    status: str
    message: str
    printer_name: str = ""


class RemoteDeviceResponse(BaseModel):
    items: list[dict] = Field(default_factory=list)
