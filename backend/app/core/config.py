from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    MONGODB_URI: str
    DATABASE_NAME: str
    CORS_ORIGINS: str = "http://localhost:5173"

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    EMAIL_HOST: str
    EMAIL_PORT: int = 465
    EMAIL_USER: str
    EMAIL_PASSWORD: str
    EMAIL_FROM: str

    # Local directory (relative to the backend working directory) where
    # uploaded files (e.g. announcement attachments) are stored, and served
    # from at /{UPLOAD_DIR}/... — see the StaticFiles mount in main.py.
    UPLOAD_DIR: str = "uploads"
    PRIVATE_UPLOAD_DIR: str = "private_uploads"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.CORS_ORIGINS.split(",")
            if origin.strip()
        ]


try:
    settings = Settings()
except Exception as exc:
    raise RuntimeError(
        "Missing or invalid environment configuration. "
        "Check your .env file against .env.example. "
        f"Details: {exc}"
    ) from exc