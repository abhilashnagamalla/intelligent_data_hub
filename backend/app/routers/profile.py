from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.services.dataset_catalog import enrich_dataset, get_catalog_dataset, get_dataset_by_id
from app.services.json_user_store import (
    add_wishlist_item,
    get_profile_payload,
    remove_wishlist_item,
)

router = APIRouter(prefix="/profile", tags=["profile"])


class WishlistRequest(BaseModel):
    datasetId: str
    sector: str
    title: str | None = None
    description: str | None = None
    organization: str | None = None
    publishedDate: str | None = None
    updatedDate: str | None = None


def _resolve_dataset_snapshot(payload: WishlistRequest) -> dict[str, Any]:
    dataset = get_catalog_dataset(payload.sector, payload.datasetId)
    if dataset is None:
        _, dataset = get_dataset_by_id(payload.datasetId)

    enriched = enrich_dataset(dataset, include_remote_metadata=False) if dataset else {}
    return {
        "id": payload.datasetId,
        "sector": payload.sector or enriched.get("sectorKey") or "",
        "sectorKey": payload.sector or enriched.get("sectorKey") or "",
        "title": payload.title or enriched.get("title") or "Untitled Dataset",
        "description": payload.description or enriched.get("description") or "",
        "organization": payload.organization or enriched.get("organization") or "Government of India",
        "publishedDate": payload.publishedDate or enriched.get("publishedDate"),
        "updatedDate": payload.updatedDate or enriched.get("updatedDate"),
    }


@router.get("/me")
def get_profile(current_user=Depends(get_current_user)):
    payload = get_profile_payload(int(current_user["id"]))
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return payload


@router.get("/wishlist")
def get_wishlist(current_user=Depends(get_current_user)):
    payload = get_profile_payload(int(current_user["id"]))
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return {"wishlist": payload["wishlist"], "wishlistIds": payload["wishlistIds"]}


@router.post("/wishlist")
def add_to_wishlist(payload: WishlistRequest, current_user=Depends(get_current_user)):
    dataset = _resolve_dataset_snapshot(payload)
    add_wishlist_item(user_id=int(current_user["id"]), dataset=dataset)
    profile_payload = get_profile_payload(int(current_user["id"]))
    return {
        "success": True,
        "wishlist": profile_payload["wishlist"] if profile_payload else [],
        "wishlistIds": profile_payload["wishlistIds"] if profile_payload else [],
    }


@router.delete("/wishlist/{dataset_id}")
def delete_wishlist_item(dataset_id: str, current_user=Depends(get_current_user)):
    remove_wishlist_item(user_id=int(current_user["id"]), dataset_id=dataset_id)
    profile_payload = get_profile_payload(int(current_user["id"]))
    return {
        "success": True,
        "wishlist": profile_payload["wishlist"] if profile_payload else [],
        "wishlistIds": profile_payload["wishlistIds"] if profile_payload else [],
    }
