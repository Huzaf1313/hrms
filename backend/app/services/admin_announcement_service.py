import os
import shutil
import uuid
from datetime import date, datetime, timezone

from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import AppException
from app.repositories.admin_announcement_repository import AdminAnnouncementRepository
from app.schemas.admin_announcement import (
    AdminAnnouncementResponse,
    AnnouncementAudience,
)

ATTACHMENT_SUBDIR = "announcements"


def _clean_ids(values: list[str] | None) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []

    for value in values or []:
        cleaned = str(value).strip()

        if not cleaned or cleaned in seen:
            continue

        seen.add(cleaned)
        result.append(cleaned)

    return result


def _resolve_targets(
    audience: str | None,
    departments: list[str] | None,
    employees: list[str] | None,
) -> tuple[list[str], list[str]]:
    if audience == AnnouncementAudience.DEPARTMENT_WISE.value:
        return _clean_ids(departments), []

    if audience == AnnouncementAudience.CUSTOM.value:
        return [], _clean_ids(employees)

    return [], []


class AdminAnnouncementService:
    def __init__(self):
        self.repository = AdminAnnouncementRepository()

    def _serialize(self, announcement: dict) -> AdminAnnouncementResponse:
        return AdminAnnouncementResponse(
            id=str(announcement["_id"]),
            title=announcement.get("title", ""),
            category=announcement.get("category"),
            priority=announcement.get("priority"),
            publish_date=announcement.get("publish_date"),
            expiry_date=announcement.get("expiry_date"),
            audience=announcement.get("audience"),
            description=announcement.get("description", ""),
            pinned=announcement.get("pinned", False),
            target_departments=announcement.get("target_departments") or [],
            target_employees=announcement.get("target_employees") or [],
            attachment=announcement.get("attachment"),
            author_id=announcement.get("author_id", ""),
            author_name=announcement.get("author_name", ""),
            created_at=announcement.get("created_at"),
            updated_at=announcement.get("updated_at"),
        )

    async def _save_attachment(self, file: UploadFile) -> dict:
        upload_dir = os.path.join(settings.UPLOAD_DIR, ATTACHMENT_SUBDIR)
        os.makedirs(upload_dir, exist_ok=True)

        ext = os.path.splitext(file.filename or "")[1]
        stored_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(upload_dir, stored_name)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        size = os.path.getsize(file_path)

        return {
            "filename": file.filename,
            "url": f"/{settings.UPLOAD_DIR}/{ATTACHMENT_SUBDIR}/{stored_name}",
            "content_type": file.content_type,
            "size": size,
        }

    def _delete_attachment_file(self, attachment: dict | None):
        if not attachment:
            return

        relative_path = (attachment.get("url") or "").lstrip("/")

        if not relative_path:
            return

        file_path = os.path.join(*relative_path.split("/"))

        if os.path.exists(file_path):
            os.remove(file_path)

    async def create_announcement(
        self,
        data: dict,
        author: dict,
        attachment: UploadFile | None = None,
    ):
        now = datetime.now(timezone.utc)

        data["author_id"] = str(author.get("_id") or author.get("id", ""))
        data["author_name"] = (
            author.get("name") or author.get("full_name") or "HR Team"
        )
        data["created_at"] = now
        data["updated_at"] = now
        data["publish_date"] = data["publish_date"].isoformat()
        if data.get("expiry_date") is not None:
            data["expiry_date"] = data["expiry_date"].isoformat()

        (
            data["target_departments"],
            data["target_employees"],
        ) = _resolve_targets(
            data.get("audience"),
            data.get("target_departments"),
            data.get("target_employees"),
        )

        if attachment is not None and attachment.filename:
            data["attachment"] = await self._save_attachment(attachment)
        else:
            data["attachment"] = None

        announcement = await self.repository.create(data)

        return self._serialize(announcement)

    async def get_announcement(self, announcement_id: str):
        announcement = await self.repository.get_by_id(announcement_id)

        if not announcement:
            raise AppException("Announcement not found", 404)

        return self._serialize(announcement)

    async def get_announcements(
        self,
        category: str | None = None,
        search: str | None = None,
        pinned: bool | None = None,
        skip: int = 0,
        limit: int = 20,
    ):
        filters: dict = {}

        if category and category != "All":
            filters["category"] = category

        if pinned is not None:
            filters["pinned"] = pinned

        if search:
            filters["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
            ]

        announcements = await self.repository.get_all(filters, skip, limit)
        total = await self.repository.count(filters)

        return [self._serialize(item) for item in announcements], total

    async def update_announcement(
        self,
        announcement_id: str,
        update_data: dict,
        attachment: UploadFile | None = None,
        clear_expiry: bool = False,
        remove_attachment: bool = False,
    ):
        existing = await self.repository.get_by_id(announcement_id)

        if not existing:
            raise AppException("Announcement not found", 404)

        update_data = {
            key: value
            for key, value in update_data.items()
            if value is not None
        }

        if clear_expiry:
            update_data["expiry_date"] = None

        if isinstance(update_data.get("publish_date"), date):
            update_data["publish_date"] = update_data["publish_date"].isoformat()

        if update_data.get("expiry_date") is not None:
            update_data["expiry_date"] = update_data["expiry_date"].isoformat()

        if "target_departments" in update_data or "target_employees" in update_data:
            effective_audience = update_data.get("audience") or existing.get("audience")
            departments, employees = _resolve_targets(
                effective_audience,
                update_data.get("target_departments"),
                update_data.get("target_employees"),
            )
            update_data["target_departments"] = departments
            update_data["target_employees"] = employees

        if attachment is not None and attachment.filename:
            self._delete_attachment_file(existing.get("attachment"))
            update_data["attachment"] = await self._save_attachment(attachment)
        elif remove_attachment:
            self._delete_attachment_file(existing.get("attachment"))
            update_data["attachment"] = None

        updated = await self.repository.update(announcement_id, update_data)

        return self._serialize(updated)

    async def delete_announcement(self, announcement_id: str):
        existing = await self.repository.get_by_id(announcement_id)

        if not existing:
            raise AppException("Announcement not found", 404)

        self._delete_attachment_file(existing.get("attachment"))

        await self.repository.delete(announcement_id)

        return True
