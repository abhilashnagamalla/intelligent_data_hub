from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from jose import JWTError, jwt

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_ROOT / "data"
DB_PATH = Path(os.getenv("IDH_DB_PATH", DATA_DIR / "idh.sqlite3"))
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


@contextmanager
def get_connection():
    ensure_data_dir()
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def _column_names(connection: sqlite3.Connection, table_name: str) -> set[str]:
    rows = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {str(row["name"]) for row in rows}


def initialize_user_store() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                picture TEXT,
                provider TEXT NOT NULL DEFAULT 'local',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_login_at TEXT
            );

            CREATE TABLE IF NOT EXISTS wishlist (
                user_id INTEGER NOT NULL,
                dataset_id TEXT NOT NULL,
                sector TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                organization TEXT,
                published_date TEXT,
                updated_date TEXT,
                added_at TEXT NOT NULL,
                PRIMARY KEY (user_id, dataset_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS user_dataset_stats (
                user_id INTEGER NOT NULL,
                dataset_id TEXT NOT NULL,
                sector TEXT NOT NULL,
                views INTEGER NOT NULL DEFAULT 0,
                downloads INTEGER NOT NULL DEFAULT 0,
                first_viewed_at TEXT,
                last_viewed_at TEXT,
                last_downloaded_at TEXT,
                PRIMARY KEY (user_id, dataset_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_wishlist_user_id
            ON wishlist(user_id);

            CREATE INDEX IF NOT EXISTS idx_user_dataset_stats_user_id
            ON user_dataset_stats(user_id);
            """
        )

        user_columns = _column_names(connection, "users")
        if "picture" not in user_columns:
            connection.execute("ALTER TABLE users ADD COLUMN picture TEXT")
        if "provider" not in user_columns:
            connection.execute("ALTER TABLE users ADD COLUMN provider TEXT NOT NULL DEFAULT 'local'")
        if "updated_at" not in user_columns:
            connection.execute("ALTER TABLE users ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''")
        if "last_login_at" not in user_columns:
            connection.execute("ALTER TABLE users ADD COLUMN last_login_at TEXT")


def normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def normalize_username(username: str) -> str:
    return str(username or "").strip()


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


def user_to_dict(user: sqlite3.Row | dict[str, Any] | None) -> dict[str, Any] | None:
    if user is None:
        return None
    data = dict(user)
    return {
        "id": data["id"],
        "email": data["email"],
        "username": data["username"],
        "name": data["username"],
        "picture": data.get("picture") or "",
        "provider": data.get("provider") or "local",
        "createdAt": data.get("created_at"),
        "lastLoginAt": data.get("last_login_at"),
    }


def create_access_token(user: sqlite3.Row | dict[str, Any]) -> str:
    user_data = dict(user)
    payload = {
        "sub": str(user_data["id"]),
        "user_id": user_data["id"],
        "email": user_data["email"],
        "username": user_data["username"],
        "exp": utc_now() + timedelta(hours=ACCESS_TOKEN_TTL_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


def get_user_by_id(user_id: int | str) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM users WHERE id = ?",
            (int(user_id),),
        ).fetchone()
    return user_to_dict(row)


def get_user_row_by_login(login_value: str) -> sqlite3.Row | None:
    normalized_login = normalize_email(login_value)
    raw_login = str(login_value or "").strip()
    with get_connection() as connection:
        return connection.execute(
            """
            SELECT *
            FROM users
            WHERE lower(email) = ? OR lower(username) = ?
            LIMIT 1
            """,
            (normalized_login, raw_login.lower()),
        ).fetchone()


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

    with get_connection() as connection:
        existing = connection.execute(
            """
            SELECT id
            FROM users
            WHERE lower(email) = ? OR lower(username) = ?
            LIMIT 1
            """,
            (normalized_email, normalized_username.lower()),
        ).fetchone()
        if existing:
            raise ValueError("An account with this email or username already exists.")

        cursor = connection.execute(
            """
            INSERT INTO users (email, username, password_hash, provider, created_at, updated_at)
            VALUES (?, ?, ?, 'local', ?, ?)
            """,
            (normalized_email, normalized_username, password_hash, now, now),
        )
        user_id = cursor.lastrowid
        row = connection.execute(
            "SELECT * FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

    return user_to_dict(row)


def authenticate_user(*, login_value: str, password: str) -> dict[str, Any] | None:
    row = get_user_row_by_login(login_value)
    if row is None or not verify_password(password, row["password_hash"]):
        return None

    now = utc_now_iso()
    with get_connection() as connection:
        connection.execute(
            """
            UPDATE users
            SET last_login_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (now, now, row["id"]),
        )
        updated = connection.execute(
            "SELECT * FROM users WHERE id = ?",
            (row["id"],),
        ).fetchone()

    return user_to_dict(updated)


def record_dataset_view(*, user_id: int, dataset_id: str, sector: str) -> None:
    now = utc_now_iso()
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO user_dataset_stats (
                user_id, dataset_id, sector, views, downloads, first_viewed_at, last_viewed_at
            )
            VALUES (?, ?, ?, 1, 0, ?, ?)
            ON CONFLICT(user_id, dataset_id) DO UPDATE SET
                sector = excluded.sector,
                views = user_dataset_stats.views + 1,
                first_viewed_at = COALESCE(user_dataset_stats.first_viewed_at, excluded.first_viewed_at),
                last_viewed_at = excluded.last_viewed_at
            """,
            (user_id, dataset_id, sector, now, now),
        )


def record_dataset_download(*, user_id: int, dataset_id: str, sector: str) -> None:
    now = utc_now_iso()
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO user_dataset_stats (
                user_id, dataset_id, sector, views, downloads, last_downloaded_at
            )
            VALUES (?, ?, ?, 0, 1, ?)
            ON CONFLICT(user_id, dataset_id) DO UPDATE SET
                sector = excluded.sector,
                downloads = user_dataset_stats.downloads + 1,
                last_downloaded_at = excluded.last_downloaded_at
            """,
            (user_id, dataset_id, sector, now),
        )


def get_user_analytics(user_id: int) -> dict[str, int]:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT
                COALESCE(SUM(CASE WHEN views > 0 THEN 1 ELSE 0 END), 0) AS datasets_explored,
                COALESCE(SUM(downloads), 0) AS total_downloads,
                COALESCE(SUM(views), 0) AS total_views
            FROM user_dataset_stats
            WHERE user_id = ?
            """,
            (user_id,),
        ).fetchone()

    return {
        "datasetsExplored": int(row["datasets_explored"] if row else 0),
        "totalDownloads": int(row["total_downloads"] if row else 0),
        "totalViews": int(row["total_views"] if row else 0),
    }


def add_wishlist_item(*, user_id: int, dataset: dict[str, Any]) -> None:
    now = utc_now_iso()
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO wishlist (
                user_id, dataset_id, sector, title, description, organization, published_date, updated_date, added_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, dataset_id) DO UPDATE SET
                sector = excluded.sector,
                title = excluded.title,
                description = excluded.description,
                organization = excluded.organization,
                published_date = excluded.published_date,
                updated_date = excluded.updated_date
            """,
            (
                user_id,
                str(dataset.get("id") or dataset.get("datasetId") or ""),
                str(dataset.get("sector") or dataset.get("sectorKey") or ""),
                str(dataset.get("title") or "Untitled Dataset"),
                str(dataset.get("description") or ""),
                str(dataset.get("organization") or "Government of India"),
                dataset.get("publishedDate"),
                dataset.get("updatedDate"),
                now,
            ),
        )


def remove_wishlist_item(*, user_id: int, dataset_id: str) -> None:
    with get_connection() as connection:
        connection.execute(
            "DELETE FROM wishlist WHERE user_id = ? AND dataset_id = ?",
            (user_id, dataset_id),
        )


def list_wishlist(user_id: int) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT dataset_id, sector, title, description, organization, published_date, updated_date, added_at
            FROM wishlist
            WHERE user_id = ?
            ORDER BY added_at DESC
            """,
            (user_id,),
        ).fetchall()

    return [
        {
            "id": row["dataset_id"],
            "datasetId": row["dataset_id"],
            "sector": row["sector"],
            "sectorKey": row["sector"],
            "title": row["title"],
            "description": row["description"] or "",
            "organization": row["organization"] or "Government of India",
            "publishedDate": row["published_date"],
            "updatedDate": row["updated_date"],
            "addedAt": row["added_at"],
            "detailPath": f"/dataset/{row['dataset_id']}",
        }
        for row in rows
    ]


def get_wishlist_ids(user_id: int) -> list[str]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT dataset_id FROM wishlist WHERE user_id = ? ORDER BY added_at DESC",
            (user_id,),
        ).fetchall()
    return [str(row["dataset_id"]) for row in rows]


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
