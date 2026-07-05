from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.core.sharing_service import SharingService
from app.schemas.sharing import (
    PairRequest,
    PairResponse,
    PermissionRequest,
    PermissionResponse,
    PermissionsListResponse,
    PinRequest,
    PinResponse,
    SharingClientsResponse,
    SharingClientResponse,
    SharingStatusResponse,
)

router = APIRouter(tags=["sharing"])
sharing_service = SharingService()


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
        client = sharing_service.pair_client(payload.client_name, payload.pairing_code)
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
    try:
        sharing_service.set_permission(payload.client_name, payload.level)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PermissionResponse(client_name=payload.client_name, level=payload.level)


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
