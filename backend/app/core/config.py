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

    # Cloudflare R2 is S3-compatible. These values must remain backend-only.
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_SIGNED_URL_EXPIRY: int = 900

    @property
    def r2_endpoint_url(self) -> str:
        return f"https://{self.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

    # First HR account, created on startup if no user with this email exists.
    # This is the only way an admin account comes into existence without HR
    # already existing - every other account is created by an existing one.
    # Leave empty to skip bootstrapping entirely.
    BOOTSTRAP_HR_EMAIL: str = ""
    BOOTSTRAP_HR_PASSWORD: str = ""
    BOOTSTRAP_HR_NAME: str = "HR Admin"

    # Redis Cache Configuration
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_ENABLED: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    FRONTEND_URL: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.CORS_ORIGINS.split(",")
            if origin.strip()
        ]

    @property
    def login_url(self) -> str:
        base = self.FRONTEND_URL or (self.cors_origins_list[0] if self.cors_origins_list else "http://localhost:5173")
        return f"{base.rstrip('/')}/login"


try:
    settings = Settings()
except Exception as exc:
    raise RuntimeError(
        "Missing or invalid environment configuration. "
        "Check your .env file against .env.example. "
        f"Details: {exc}"
    ) from exc
