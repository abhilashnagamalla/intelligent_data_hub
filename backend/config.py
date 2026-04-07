from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class DataGovAPIKeyNotConfiguredError(RuntimeError):
    """Raised when the backend is asked to call data.gov.in without an API key."""


class Settings(BaseSettings):
    OPENAI_API_KEY: str = ""
    VITE_DATAGOVTAPI: str = ""
    DATA_GOV_BASE_URL: str = "https://api.data.gov.in"

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()


def get_data_gov_api_key() -> str:
    return settings.VITE_DATAGOVTAPI.strip()


def require_data_gov_api_key() -> str:
    api_key = get_data_gov_api_key()
    if not api_key:
        raise DataGovAPIKeyNotConfiguredError("DATA_GOV API key not configured.")
    return api_key


def data_gov_request_params(extra: dict | None = None) -> dict[str, object]:
    params: dict[str, object] = {
        "api-key": require_data_gov_api_key(),
        "format": "json",
    }
    if extra:
        params.update(extra)
    return params
