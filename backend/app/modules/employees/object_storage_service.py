import asyncio
import mimetypes
from typing import BinaryIO

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings
from app.core.exceptions import AppException


class ObjectStorageService:
    """Private Cloudflare R2 storage through its S3-compatible API."""

    def __init__(self):
        self._client = None

    def _get_client(self):
        if not all(
            (
                settings.R2_ACCOUNT_ID,
                settings.R2_ACCESS_KEY_ID,
                settings.R2_SECRET_ACCESS_KEY,
                settings.R2_BUCKET_NAME,
            )
        ):
            raise AppException("Cloudflare R2 storage is not configured", 503)

        if self._client is None:
            self._client = boto3.client(
                "s3",
                endpoint_url=settings.r2_endpoint_url,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                region_name="auto",
            )

        return self._client

    async def upload(
        self,
        *,
        key: str,
        body: bytes | BinaryIO,
        content_type: str,
        content_length: int | None = None,
    ) -> None:
        def put():
            extra = {"ContentType": content_type}
            if content_length is not None:
                extra["ContentLength"] = content_length

            self._get_client().put_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=key,
                Body=body,
                **extra,
            )

        try:
            await asyncio.to_thread(put)
        except (BotoCoreError, ClientError) as exc:
            raise AppException("Could not upload file to Cloudflare storage", 502) from exc

    async def delete(self, key: str | None) -> None:
        if not key:
            return

        try:
            await asyncio.to_thread(
                lambda: self._get_client().delete_object(
                    Bucket=settings.R2_BUCKET_NAME,
                    Key=key,
                )
            )
        except (BotoCoreError, ClientError) as exc:
            raise AppException("Could not delete file from Cloudflare storage", 502) from exc

    async def copy(self, source_key: str, destination_key: str) -> None:
        def copy_object():
            self._get_client().copy_object(
                Bucket=settings.R2_BUCKET_NAME,
                CopySource={
                    "Bucket": settings.R2_BUCKET_NAME,
                    "Key": source_key,
                },
                Key=destination_key,
            )

        try:
            await asyncio.to_thread(copy_object)
        except (BotoCoreError, ClientError) as exc:
            raise AppException("Could not move file in Cloudflare storage", 502) from exc

    async def signed_url(self, key: str) -> str:
        try:
            return await asyncio.to_thread(
                lambda: self._get_client().generate_presigned_url(
                    "get_object",
                    Params={
                        "Bucket": settings.R2_BUCKET_NAME,
                        "Key": key,
                    },
                    ExpiresIn=settings.R2_SIGNED_URL_EXPIRY,
                )
            )
        except (BotoCoreError, ClientError) as exc:
            raise AppException("Could not create a secure file URL", 502) from exc


def content_type_for(filename: str, provided: str | None = None) -> str:
    return provided or mimetypes.guess_type(filename)[0] or "application/octet-stream"
