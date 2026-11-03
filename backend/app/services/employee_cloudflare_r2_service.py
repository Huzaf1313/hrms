import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings


class CloudflareR2Service:
    """Handles private file storage using Cloudflare R2."""

    def __init__(self):
        required_settings = {
            "R2_ACCOUNT_ID": settings.R2_ACCOUNT_ID,
            "R2_ACCESS_KEY_ID": settings.R2_ACCESS_KEY_ID,
            "R2_SECRET_ACCESS_KEY": settings.R2_SECRET_ACCESS_KEY,
            "R2_BUCKET_NAME": settings.R2_BUCKET_NAME,
            "R2_ENDPOINT_URL": settings.R2_ENDPOINT_URL,
        }

        missing_settings = [
            name for name, value in required_settings.items() if not value
        ]

        if missing_settings:
            raise RuntimeError(
                f"Missing Cloudflare R2 configuration: {', '.join(missing_settings)}"
            )

        self.bucket_name = settings.R2_BUCKET_NAME

        self.client = boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT_URL,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
            config=Config(
                signature_version="s3v4",
                retries={
                    "max_attempts": 3,
                    "mode": "standard",
                },
            ),
        )

    def check_connection(self) -> bool:
        """Verify that the configured R2 bucket is accessible."""
        self.client.head_bucket(Bucket=self.bucket_name)
        return True

    def upload_file(
        self,
        object_key: str,
        file_content: bytes,
        content_type: str,
    ) -> None:
        """Upload a file to the private R2 bucket."""
        self.client.put_object(
            Bucket=self.bucket_name,
            Key=object_key,
            Body=file_content,
            ContentType=content_type,
        )

    def get_file(self, object_key: str) -> dict:
        """Retrieve a file from R2."""
        return self.client.get_object(
            Bucket=self.bucket_name,
            Key=object_key,
        )

    def delete_file(self, object_key: str) -> None:
        """Delete a file from R2."""
        self.client.delete_object(
            Bucket=self.bucket_name,
            Key=object_key,
        )