import io
import logging
import re
import unicodedata
from pathlib import Path

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user
from app.core.cache import invalidate_employees_cache
from app.core.roles import UserRole
from app.repositories.employee_repository import EmployeeRepository
from app.services.employee_cloudflare_r2_service import CloudflareR2Service
from app.services.employee_service import EmployeeService
from datetime import datetime

router = APIRouter(prefix="/employee-profile-photo", tags=["Employee Profile Photos"])

logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 5 * 1024 * 1024

ALLOWED_TYPES = {
    ".jpg": ("image/jpeg", b"\xff\xd8\xff"),
    ".jpeg": ("image/jpeg", b"\xff\xd8\xff"),
    ".png": ("image/png", b"\x89PNG\r\n\x1a\n"),
}


def normalize_name(value: str) -> str:
    """Convert employee name into a safe R2 folder component."""
    normalized = unicodedata.normalize("NFKD", value)
    normalized = normalized.encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-zA-Z0-9]+", "_", normalized)
    return normalized.strip("_")


def get_employee_folder(employee: dict) -> str:
    employee_code = str(employee.get("employee_id", "")).strip()
    full_name = (
        f"{employee.get('first_name', '')} "
        f"{employee.get('last_name', '')}"
    ).strip()

    if not employee_code or not full_name:
        raise HTTPException(
            status_code=400,
            detail="Employee code or name is missing.",
        )

    safe_code = normalize_name(employee_code)
    safe_name = normalize_name(full_name)

    if not safe_code or not safe_name:
        raise HTTPException(
            status_code=400,
            detail="Invalid employee code or name.",
        )

    return f"{safe_code}_{safe_name}"


def validate_image(filename: str, content: bytes) -> tuple[str, str]:
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, JPEG, and PNG images are allowed.",
        )

    if not content:
        raise HTTPException(
            status_code=400,
            detail="The uploaded image is empty.",
        )

    expected_type, signature = ALLOWED_TYPES[extension]

    if not content.startswith(signature):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file does not match its image format.",
        )

    return extension, expected_type


def get_r2_service() -> CloudflareR2Service:
    try:
        return CloudflareR2Service()
    except Exception as exc:
        logger.exception("Cloudflare R2 configuration error")
        raise HTTPException(
            status_code=503,
            detail="Profile photo storage is currently unavailable.",
        ) from exc


@router.post("/me")
async def upload_my_profile_photo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") != UserRole.EMPLOYEE:
        raise HTTPException(
            status_code=403,
            detail="Only employees can upload their own profile photo.",
        )

    if not current_user.get("employee_id"):
        raise HTTPException(
            status_code=403,
            detail="Employee account not found.",
        )

    content = await file.read(MAX_FILE_SIZE + 1)

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Profile photo must not exceed 5 MB.",
        )

    extension, content_type = validate_image(
        file.filename or "",
        content,
    )

    employee_folder = get_employee_folder(current_user)

    object_key = (
        f"employees/{employee_folder}/profile/"
        f"{employee_folder}_Profile{extension}"
    )

    employee_id = str(current_user["_id"])

    repository = EmployeeRepository()
    storage = get_r2_service()

    old_key = current_user.get("profile_photo_key")

    try:
        # Upload the new photo first so the existing photo remains
        # available if the upload fails.
        await run_in_threadpool(
            storage.upload_file,
            object_key,
            content,
            content_type,
        )

        updated_employee = await repository.update(
            employee_id,
            {
                "profile_photo_key": object_key,
                "profile_photo_content_type": content_type,
                "avatar_url": (
                    f"/api/v1/employee-profile-photo/"
                    f"{employee_id}/image"
                ),
                "updated_at": datetime.utcnow(),
            },
            scope=None,
        )

        if not updated_employee:
            raise RuntimeError("Employee profile update failed.")

        await invalidate_employees_cache(employee_id=employee_id)

        # Remove the previous object only after MongoDB is updated.
        if old_key and old_key != object_key:
            try:
                await run_in_threadpool(storage.delete_file, old_key)
            except Exception:
                logger.exception("Failed to delete previous profile photo")

        return {
            "success": True,
            "message": "Profile photo uploaded successfully.",
            "data": {
                "avatar_url": (
                    f"/api/v1/employee-profile-photo/"
                    f"{employee_id}/image"
                )
            },
        }

    except HTTPException:
        raise
    except Exception as exc:
        # Clean up the newly uploaded object if the database update fails.
        if object_key != old_key:
            try:
                await run_in_threadpool(storage.delete_file, object_key)
            except Exception:
                logger.exception("Failed to clean up uploaded profile photo")

        logger.exception("Profile photo upload failed")

        raise HTTPException(
            status_code=500,
            detail="Failed to upload profile photo.",
        ) from exc


@router.get("/{employee_id}/image")
async def get_employee_profile_photo(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(employee_id):
        raise HTTPException(
            status_code=404,
            detail="Employee profile photo not found.",
        )

    # EmployeeService applies the existing employee visibility scope.
    try:
        employee = await EmployeeService().get_employee(
            employee_id,
            current_user,
        )
    except Exception:
        raise HTTPException(
            status_code=404,
            detail="Employee profile photo not found.",
        )

    object_key = employee.get("profile_photo_key")
    content_type = employee.get("profile_photo_content_type")

    if not object_key or not content_type:
        raise HTTPException(
            status_code=404,
            detail="Profile photo not found.",
        )

    storage = get_r2_service()

    try:
        result = await run_in_threadpool(storage.get_file, object_key)
        body = result["Body"]

        return StreamingResponse(
            body,
            media_type=content_type,
            headers={
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        )

    except Exception as exc:
        logger.exception("Profile photo retrieval failed")

        raise HTTPException(
            status_code=404,
            detail="Profile photo could not be retrieved.",
        ) from exc
