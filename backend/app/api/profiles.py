from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException

from app.core.profile_service import OutputProfile, ProfileService
from app.schemas.profile import OutputProfilePayload, ProfileListResponse

router = APIRouter(tags=["profiles"])
profile_service = ProfileService()


@router.get("/profiles", response_model=ProfileListResponse)
def list_profiles() -> ProfileListResponse:
    profiles = profile_service.list_profiles()
    return ProfileListResponse(
        items=[OutputProfilePayload(**asdict(profile)) for profile in profiles]
    )


@router.post("/profiles", response_model=OutputProfilePayload)
def save_profile(payload: OutputProfilePayload) -> OutputProfilePayload:
    profile_service.save_profile(OutputProfile(**payload.model_dump()))
    return payload


@router.put("/profiles/{name}", response_model=OutputProfilePayload)
def update_profile(name: str, payload: OutputProfilePayload) -> OutputProfilePayload:
    # Guard against silent rename and updating a non-existent profile.
    if name != payload.name:
        raise HTTPException(
            status_code=400,
            detail="Nama profil tidak boleh diubah lewat endpoint ini",
        )
    if profile_service.get_profile(name) is None:
        raise HTTPException(status_code=404, detail="Profil tidak ditemukan")
    profile_service.save_profile(OutputProfile(**payload.model_dump()))
    return payload


@router.delete("/profiles/{name}")
def delete_profile(name: str) -> dict[str, str]:
    if profile_service.get_profile(name) is None:
        raise HTTPException(status_code=404, detail="Profil tidak ditemukan")
    profile_service.delete_profile(name)
    return {"status": "deleted", "name": name}
