from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    OPENAI_API_KEY: str = ""
    DATA_GOV_API_KEY: str = ""
    VITE_DATAGOVTAPI: str = ""
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SENDER_EMAIL: str = ""
    SENDER_PASSWORD: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
