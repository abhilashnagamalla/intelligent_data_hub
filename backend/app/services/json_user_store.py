from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from jose import JWTError, jwt

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_ROOT / "data"
STORE_PATH = Path(os.getenv("IDH_USER_STORE_PATH", DATA_DIR / "user_store.json"))
STORE_LOCK = threading.RLock()
JWT_SECRET = os.getenv("JWT_SECRET", "idh-local-development-secret")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TTL_HOURS = int(os.getenv("ACCESS_TOKEN_TTL_HOURS", "24"))
PBKDF2_ROUNDS = 200_000


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().replace(microsecond=0).isoformat()


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _default_store() -> dict[str, Any]:
    return {
        "nextUserId": 1,
        "users": [],
        "wishlist": {},
        "datasetStats": {},
    }


def _normalize_store(store: dict[str, Any] | None) -> dict[str, Any]:
    normalized = dict(store or {})
    normalized.setdefault("nextUserId", 1)
    normalized.setdefault("users", [])
    normalized.setdefault("wishlist", {})
    normalized.setdefault("datasetStats", {})
    return normalized


def _load_store() -> dict[str, Any]:
    ensure_data_dir()
    if not STORE_PATH.exists():
        return _default_store()

    try:
        content = STORE_PATH.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return _default_store()

    if not content:
        return _default_store()

    return _normalize_store(json.loads(content))


def _write_store(store: dict[str, Any]) -> None:
    ensure_data_dir()
    STORE_PATH.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding="utf-8")


@contextmanager
def store_transaction():
    with STORE_LOCK:
        store = _load_store()
        yield store
        _write_store(store)


def initialize_user_store() -> None:
    with STORE_LOCK:
        store = _normalize_store(_load_store())
        _write_store(store)


def normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def normalize_username(username: str) -> str:
    return str(username or "").strip()


def username_slug(value: str, fallback: str = "user") -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", str(value or "").strip().lower()).strip("_")
    return (slug or fallback)[:40]


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        PBKDF2_ROUNDS,
    ).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, expected_digest = stored_hash.split("$", 1)
    except ValueError:
        return False

    actual_digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        PBKDF2_ROUNDS,
    ).hex()
    return hmac.compare_digest(actual_digest, expected_digest)


def user_to_dict(user: dict[str, Any] | None) -> dict[str, Any] | None:
    if user is None:
        return None

    return {
        "id": int(user["id"]),
        "email": user["email"],
        "username": user["username"],
        "name": user.get("name") or user["username"],
        "picture": user.get("picture") or "",
        "provider": user.get("provider") or "local",
        "providerUserId": user.get("providerUserId") or "",
        "createdAt": user.get("createdAt"),
        "lastLoginAt": user.get("lastLoginAt"),
    }


def create_access_token(user: dict[str, Any]) -> str:
    payload = {
        "sub": str(user["id"]),
        "user_id": int(user["id"]),
        "email": user["email"],
        "username": user["username"],
        "provider": user.get("provider") or "local",
        "exp": utc_now() + timedelta(hours=ACCESS_TOKEN_TTL_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


def _find_user(store: dict[str, Any], predicate) -> dict[str, Any] | None:
    return next((user for user in store["users"] if predicate(user)), None)


def _username_exists(store: dict[str, Any], username: str, *, exclude_user_id: int | None = None) -> bool:
    normalized = normalize_username(username).lower()
    return any(
        normalize_username(user.get("username", "")).lower() == normalized
        and int(user.get("id", 0)) != int(exclude_user_id or 0)
        for user in store["users"]
    )


def _build_unique_username(
    store: dict[str, Any],
    *,
    preferred: str,
    email: str,
    exclude_user_id: int | None = None,
) -> str:
    base = username_slug(preferred or email.split("@", 1)[0] or "user")
    candidate = base
    suffix = 2
    while _username_exists(store, candidate, exclude_user_id=exclude_user_id):
        suffix_text = f"_{suffix}"
        candidate = f"{base[: max(1, 40 - len(suffix_text))]}{suffix_text}"
        suffix += 1
    return candidate


def get_user_by_id(user_id: int | str) -> dict[str, Any] | None:
    with STORE_LOCK:
        store = _load_store()
        user = _find_user(store, lambda item: int(item["id"]) == int(user_id))
        return user_to_dict(user)


def get_user_row_by_login(login_value: str) -> dict[str, Any] | None:
    normalized_login = normalize_email(login_value)
    raw_login = str(login_value or "").strip().lower()
    with STORE_LOCK:
        store = _load_store()
        return _find_user(
            store,
            lambda item: item["email"] == normalized_login or item["username"].lower() == raw_login,
        )


def create_user(*, email: str, username: str, password: str) -> dict[str, Any]:
    normalized_email = normalize_email(email)
    normalized_username = normalize_username(username)

    if not normalized_email:
        raise ValueError("Email is required.")
    if not normalized_username:
        raise ValueError("Username is required.")
    if len(password or "") < 8:
        raise ValueError("Password must be at least 8 characters long.")

    now = utc_now_iso()
    password_hash = hash_password(password)

    with store_transaction() as store:
        existing = _find_user(
            store,
            lambda item: item["email"] == normalized_email or item["username"].lower() == normalized_username.lower(),
        )
        if existing:
            raise ValueError("An account with this email or username already exists.")

        user = {
            "id": int(store["nextUserId"]),
            "email": normalized_email,
            "username": normalized_username,
            "name": normalized_username,
            "passwordHash": password_hash,
            "picture": "",
            "provider": "local",
            "providerUserId": "",
            "createdAt": now,
            "updatedAt": now,
            "lastLoginAt": None,
        }
        store["nextUserId"] = int(store["nextUserId"]) + 1
        store["users"].append(user)
        return user_to_dict(user)


def authenticate_user(*, login_value: str, password: str) -> dict[str, Any] | None:
    with store_transaction() as store:
        normalized_login = normalize_email(login_value)
        raw_login = str(login_value or "").strip().lower()
        user = _find_user(
            store,
            lambda item: item["email"] == normalized_login or item["username"].lower() == raw_login,
        )
        if user is None or not verify_password(password, user.get("passwordHash", "")):
            return None

        now = utc_now_iso()
        user["lastLoginAt"] = now
        user["updatedAt"] = now
        return user_to_dict(user)


def create_or_update_google_user(
    *,
    email: str,
    name: str,
    picture: str,
    provider_user_id: str,
) -> dict[str, Any]:
    normalized_email = normalize_email(email)
    normalized_name = normalize_username(name)
    normalized_provider_user_id = str(provider_user_id or "").strip()

    if not normalized_email:
        raise ValueError("Google account email is required.")
    if not normalized_provider_user_id:
        raise ValueError("Google account identifier is required.")

    now = utc_now_iso()

    with store_transaction() as store:
        user = _find_user(
            store,
            lambda item: item.get("providerUserId") == normalized_provider_user_id
            or item.get("email") == normalized_email,
        )

        if user is None:
            username = _build_unique_username(
                store,
                preferred=normalized_name or normalized_email.split("@", 1)[0],
                email=normalized_email,
            )
            user = {
                "id": int(store["nextUserId"]),
                "email": normalized_email,
                "username": username,
                "name": normalized_name or username,
                "passwordHash": "",
                "picture": picture or "",
                "provider": "google",
                "providerUserId": normalized_provider_user_id,
                "createdAt": now,
                "updatedAt": now,
                "lastLoginAt": now,
            }
            store["nextUserId"] = int(store["nextUserId"]) + 1
            store["users"].append(user)
            return user_to_dict(user)

        user["email"] = normalized_email
        user["name"] = normalized_name or user.get("name") or user.get("username") or "user"
        user["picture"] = picture or user.get("picture") or ""
        user["provider"] = "google"
        user["providerUserId"] = normalized_provider_user_id
        user["username"] = _build_unique_username(
            store,
            preferred=user.get("username") or user["name"],
            email=normalized_email,
            exclude_user_id=int(user["id"]),
        )
        user["updatedAt"] = now
        user["lastLoginAt"] = now
        return user_to_dict(user)


def record_dataset_view(*, user_id: int, dataset_id: str, sector: str) -> None:
    now = utc_now_iso()
    user_key = str(user_id)

    with store_transaction() as store:
        user_stats = store["datasetStats"].setdefault(user_key, {})
        entry = user_stats.get(dataset_id) or {
            "datasetId": dataset_id,
            "sector": sector,
            "views": 0,
            "downloads": 0,
            "firstViewedAt": None,
            "lastViewedAt": None,
            "lastDownloadedAt": None,
        }
        entry["sector"] = sector
        entry["views"] = int(entry.get("views", 0)) + 1
        entry["firstViewedAt"] = entry.get("firstViewedAt") or now
        entry["lastViewedAt"] = now
        user_stats[dataset_id] = entry


def record_dataset_download(*, user_id: int, dataset_id: str, sector: str) -> None:
    now = utc_now_iso()
    user_key = str(user_id)

    with store_transaction() as store:
        user_stats = store["datasetStats"].setdefault(user_key, {})
        entry = user_stats.get(dataset_id) or {
            "datasetId": dataset_id,
            "sector": sector,
            "views": 0,
            "downloads": 0,
            "firstViewedAt": None,
            "lastViewedAt": None,
            "lastDownloadedAt": None,
        }
        entry["sector"] = sector
        entry["downloads"] = int(entry.get("downloads", 0)) + 1
        entry["lastDownloadedAt"] = now
        user_stats[dataset_id] = entry


def get_user_analytics(user_id: int) -> dict[str, int]:
    with STORE_LOCK:
        store = _load_store()
        stats = list(store["datasetStats"].get(str(user_id), {}).values())

    return {
        "datasetsExplored": sum(1 for item in stats if int(item.get("views", 0)) > 0),
        "totalDownloads": sum(int(item.get("downloads", 0)) for item in stats),
        "totalViews": sum(int(item.get("views", 0)) for item in stats),
    }


def add_wishlist_item(*, user_id: int, dataset: dict[str, Any]) -> None:
    now = utc_now_iso()
    user_key = str(user_id)
    dataset_id = str(dataset.get("id") or dataset.get("datasetId") or "")

    with store_transaction() as store:
        items = store["wishlist"].setdefault(user_key, [])
        existing = next((item for item in items if item["datasetId"] == dataset_id), None)
        normalized_item = {
            "id": dataset_id,
            "datasetId": dataset_id,
            "sector": str(dataset.get("sector") or dataset.get("sectorKey") or ""),
            "sectorKey": str(dataset.get("sector") or dataset.get("sectorKey") or ""),
            "title": str(dataset.get("title") or "Untitled Dataset"),
            "description": str(dataset.get("description") or ""),
            "organization": str(dataset.get("organization") or "Government of India"),
            "publishedDate": dataset.get("publishedDate"),
            "updatedDate": dataset.get("updatedDate"),
            "addedAt": now,
            "detailPath": f"/dataset/{dataset_id}",
        }

        if existing:
            normalized_item["addedAt"] = existing.get("addedAt") or now
            items[items.index(existing)] = normalized_item
        else:
            items.append(normalized_item)


def remove_wishlist_item(*, user_id: int, dataset_id: str) -> None:
    user_key = str(user_id)
    with store_transaction() as store:
        items = store["wishlist"].get(user_key, [])
        store["wishlist"][user_key] = [item for item in items if item.get("datasetId") != dataset_id]


def list_wishlist(user_id: int) -> list[dict[str, Any]]:
    with STORE_LOCK:
        store = _load_store()
        items = list(store["wishlist"].get(str(user_id), []))

    return sorted(items, key=lambda item: item.get("addedAt") or "", reverse=True)


def get_wishlist_ids(user_id: int) -> list[str]:
    return [str(item["datasetId"]) for item in list_wishlist(user_id)]


def get_profile_payload(user_id: int) -> dict[str, Any] | None:
    user = get_user_by_id(user_id)
    if user is None:
        return None

    return {
        "user": user,
        "analytics": get_user_analytics(user_id),
        "wishlist": list_wishlist(user_id),
        "wishlistIds": get_wishlist_ids(user_id),
    }
