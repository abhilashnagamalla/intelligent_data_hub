from __future__ import annotations

import os
import time
from threading import RLock
from typing import Any

import requests
from jose import JWTError, jwt

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "intelligent-data-hub-db66a")
FIREBASE_CERTS_URL = os.getenv(
    "FIREBASE_CERTS_URL",
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com",
)
FIREBASE_ISSUER = f"https://securetoken.google.com/{FIREBASE_PROJECT_ID}"
CERT_REQUEST_TIMEOUT = int(os.getenv("FIREBASE_CERT_TIMEOUT_SECONDS", "10"))
DEFAULT_CERT_TTL_SECONDS = 3600

_cert_lock = RLock()
_cert_cache: dict[str, str] = {}
_cert_cache_expires_at = 0


def _parse_max_age(cache_control: str) -> int:
    for part in str(cache_control or "").split(","):
        fragment = part.strip()
        if fragment.startswith("max-age="):
            value = fragment.split("=", 1)[1].strip()
            if value.isdigit():
                return int(value)
    return DEFAULT_CERT_TTL_SECONDS


def _load_firebase_certs(*, force_refresh: bool = False) -> dict[str, str]:
    global _cert_cache, _cert_cache_expires_at

    with _cert_lock:
        if not force_refresh and _cert_cache and time.time() < _cert_cache_expires_at:
            return _cert_cache

        response = requests.get(FIREBASE_CERTS_URL, timeout=CERT_REQUEST_TIMEOUT)
        response.raise_for_status()

        payload = response.json()
        if not isinstance(payload, dict) or not payload:
            raise ValueError("Firebase public certificates are unavailable.")

        ttl_seconds = _parse_max_age(response.headers.get("Cache-Control"))
        _cert_cache = {str(key): str(value) for key, value in payload.items()}
        _cert_cache_expires_at = time.time() + max(ttl_seconds, 60)
        return _cert_cache


def verify_google_identity_token(id_token: str) -> dict[str, Any]:
    token = str(id_token or "").strip()
    if not token:
        raise ValueError("Google identity token is required.")

    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise ValueError("Google identity token is invalid.") from exc

    kid = str(header.get("kid") or "").strip()
    if not kid:
        raise ValueError("Google identity token is missing a signing key.")

    certs = _load_firebase_certs()
    cert = certs.get(kid)
    if cert is None:
        cert = _load_firebase_certs(force_refresh=True).get(kid)
    if cert is None:
        raise ValueError("Unable to verify Google identity token.")

    try:
        claims = jwt.decode(
            token,
            cert,
            algorithms=["RS256"],
            audience=FIREBASE_PROJECT_ID,
            issuer=FIREBASE_ISSUER,
        )
    except JWTError as exc:
        raise ValueError("Google identity token could not be verified.") from exc

    provider = str(((claims.get("firebase") or {}).get("sign_in_provider")) or "")
    if provider not in {"google.com", "google"}:
        raise ValueError("Google sign-in is required for this application.")

    email = str(claims.get("email") or "").strip().lower()
    if not email:
        raise ValueError("Google account email is missing.")

    if claims.get("email_verified") is False:
        raise ValueError("Google account email must be verified.")

    subject = str(claims.get("sub") or "").strip()
    if not subject:
        raise ValueError("Google account identifier is missing.")

    return {
        "uid": subject,
        "email": email,
        "name": str(claims.get("name") or email.split("@", 1)[0]).strip(),
        "picture": str(claims.get("picture") or "").strip(),
        "provider": provider,
        "claims": claims,
    }
