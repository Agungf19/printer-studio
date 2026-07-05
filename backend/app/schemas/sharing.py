from __future__ import annotations

from pydantic import BaseModel


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
