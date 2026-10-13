import logging
import mimetypes
import os
import uuid
from datetime import date, datetime, timedelta, timezone
from math import ceil
from pathlib import Path
 
from fastapi import UploadFile
 
from app.core.config import settings
from app.core.exceptions import AppException
from app.repositories.employee_exit_request_repository import ExitRequestRepository
from app.schemas.employee_exit_request import ExitRequestCreate, ExitStatusUpdate
from app.services.email_service import EmailService
 
logger = logging.getLogger(__name__)
 
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_ATTACHMENTS = 5
 
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"}
 
# The extension and the client content-type are both user controlled, so the
# file's leading bytes are checked as well.
FILE_SIGNATURES = {
    ".pdf": [b"%PDF"],
    ".png": [b"\x89PNG\r\n\x1a\n"],
    ".jpg": [b"\xff\xd8\xff"],
    ".jpeg": [b"\xff\xd8\xff"],
    ".docx": [b"PK\x03\x04"],
    ".doc": [b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"],
}
 
 
class ExitRequestService:
    ACTIVE_STATUSES = ["Pending", "In Progress"]
 
    TRANSITIONS = {
        "Pending": {"In Progress", "Rejected"},
        "In Progress": {"Completed", "Rejected"},
    }
 
    def __init__(self):
        self.repository = ExitRequestRepository()
 
    # ------------------------------------------------------------------ files
    @staticmethod
    async def read_attachments(files: list[UploadFile]) -> list[dict]:
        files = [f for f in files if f and f.filename]
 
        if len(files) > MAX_ATTACHMENTS:
            raise AppException(
                f"You can attach at most {MAX_ATTACHMENTS} files", 400
            )
 
        prepared = []
        for upload in files:
            name = Path(upload.filename or "").name
            extension = Path(name).suffix.lower()
 
            if extension not in ALLOWED_EXTENSIONS:
                raise AppException(
                    "Unsupported file type. Allowed formats: PDF, DOC, DOCX, JPG, PNG",
                    400,
                )
 
            contents = await upload.read(MAX_FILE_SIZE + 1)
            await upload.close()
 
            if not contents:
                raise AppException(f"{name} is empty", 400)
 
            if len(contents) > MAX_FILE_SIZE:
                raise AppException(f"{name} exceeds the 10 MB limit", 413)
 
            if not any(contents.startswith(sig) for sig in FILE_SIGNATURES[extension]):
                raise AppException(
                    f"{name} does not look like a valid {extension} file", 400
                )
 
            prepared.append({"name": name, "extension": extension, "contents": contents})
 
        return prepared
 
    @staticmethod
    def _store_files(prepared: list[dict]) -> list[dict]:
        private_dir = os.path.abspath(settings.PRIVATE_UPLOAD_DIR)
        os.makedirs(private_dir, exist_ok=True)
 
        saved: list[dict] = []
        try:
            for item in prepared:
                stored_name = f"{uuid.uuid4().hex}{item['extension']}"
                path = os.path.join(private_dir, stored_name)
 
                with open(path, "wb") as output:
                    output.write(item["contents"])
 
                saved.append(
                    {
                        "id": uuid.uuid4().hex,
                        "file_name": item["name"],
                        "file_size": len(item["contents"]),
                        "mime_type": mimetypes.guess_type(item["name"])[0]
                        or "application/octet-stream",
                        "storage_path": path,
                        "uploaded_at": datetime.now(timezone.utc),
                    }
                )
        except Exception:
            ExitRequestService._remove_files(saved)
            raise
 
        return saved
 
    @staticmethod
    def _remove_files(attachments: list[dict]) -> None:
        for attachment in attachments:
            path = attachment.get("storage_path")
            if path and os.path.isfile(path):
                os.remove(path)
 
    def get_attachment_file(self, request: dict, attachment_id: str):
        attachment = next(
            (a for a in request.get("attachments", []) if a["id"] == attachment_id),
            None,
        )
        if not attachment:
            raise AppException("Attachment not found", 404)
 
        private_dir = os.path.abspath(settings.PRIVATE_UPLOAD_DIR)
        file_path = os.path.abspath(attachment.get("storage_path", ""))
 
        try:
            inside = os.path.commonpath([private_dir, file_path]) == private_dir
        except ValueError:
            inside = False
 
        if not inside or not os.path.isfile(file_path):
            raise AppException("Attachment file not found", 404)
 
        return file_path, attachment["file_name"], attachment["mime_type"]
 
    # --------------------------------------------------------------- employee
    async def create_request(
        self,
        current_user: dict,
        payload: ExitRequestCreate,
        prepared_files: list[dict],
    ):
        employee_id = current_user["employee_id"]
 
        if not payload.confirmed:
            raise AppException(
                "Please confirm that the information provided is correct", 400
            )
 
        if payload.reason == "Other" and not (payload.remarks or "").strip():
            raise AppException("Please add remarks when the reason is 'Other'", 400)
 
        earliest = date.today() + timedelta(days=payload.notice_period_days)
        if payload.last_working_day < earliest:
            raise AppException(
                f"With a {payload.notice_period_days}-day notice period, your last "
                f"working day must be on or after {earliest.strftime('%d %b %Y')}",
                400,
            )
 
        if await self.repository.find_active_for_employee(
            employee_id, self.ACTIVE_STATUSES
        ):
            raise AppException(
                "You already have an active resignation request", 409
            )
 
        attachments = self._store_files(prepared_files)
        now = datetime.now(timezone.utc)
 
        name = (
            f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}"
        ).strip() or current_user.get("full_name") or current_user.get("email")
 
        document = {
            "employee_id": employee_id,
            "employee_name": name,
            "email": current_user.get("email"),
            "designation": current_user.get("designation"),
            "department_id": current_user.get("department_id"),
            "reporting_manager": current_user.get("reporting_manager"),
            "exit_type": "Resignation",
            "last_working_day": payload.last_working_day,
            "notice_period_days": payload.notice_period_days,
            "reason": payload.reason,
            "remarks": (payload.remarks or "").strip() or None,
            "handover_tasks": [t.model_dump() for t in payload.handover_tasks],
            "attachments": attachments,
            "status": "Pending",
            "submitted_at": now,
            "reviewed_at": None,
            "reviewed_by": None,
            "admin_note": None,
            "created_at": now,
            "updated_at": now,
        }
 
        try:
            created = await self.repository.create(document)
        except Exception:
            self._remove_files(attachments)
            raise
 
        return created
 
    async def list_requests(
        self,
        page: int,
        limit: int,
        employee_id: str | None = None,
        status: str | None = None,
        search: str | None = None,
    ):
        skip = (page - 1) * limit
        records = await self.repository.list(skip, limit, employee_id, status, search)
        total = await self.repository.count(employee_id, status, search)
 
        return {
            "items": [self._serialize(r) for r in records],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": ceil(total / limit) if total else 1,
        }
 
    async def get_request(self, request_id: str, employee_id: str | None = None):
        document = await self.repository.get_by_id(request_id)
 
        # 404 (not 403) so another employee's request ID is not confirmed to exist.
        if not document or (employee_id and document["employee_id"] != employee_id):
            raise AppException("Exit request not found", 404)
 
        return document
 
    async def cancel_request(self, request_id: str, employee_id: str):
        document = await self.get_request(request_id, employee_id)
 
        if document["status"] != "Pending":
            raise AppException("Only pending requests can be cancelled", 400)
 
        changed = await self.repository.update_if_status(
            request_id,
            "Pending",
            {"status": "Cancelled", "updated_at": datetime.now(timezone.utc)},
        )
        if not changed:
            raise AppException("This request was just updated. Please refresh.", 409)
 
        return await self.repository.get_by_id(request_id)
 
    # ------------------------------------------------------------------ admin
    async def summary(self):
        counts = await self.repository.count_by_status()
        return {
            "total": sum(counts.values()),
            "pending": counts.get("Pending", 0),
            "in_progress": counts.get("In Progress", 0),
            "completed": counts.get("Completed", 0),
            "rejected": counts.get("Rejected", 0),
            "cancelled": counts.get("Cancelled", 0),
        }
 
    async def update_status(
        self, request_id: str, payload: ExitStatusUpdate, reviewer: str
    ):
        document = await self.get_request(request_id)
        current = document["status"]
        target = payload.status
 
        if target not in self.TRANSITIONS.get(current, set()):
            raise AppException(
                f"A request that is '{current}' cannot be moved to '{target}'", 400
            )
 
        note = (payload.admin_note or "").strip() or None
        if target == "Rejected" and not note:
            raise AppException("Please provide a reason for rejecting", 400)
 
        now = datetime.now(timezone.utc)
        changed = await self.repository.update_if_status(
            request_id,
            current,
            {
                "status": target,
                "admin_note": note,
                "reviewed_by": reviewer,
                "reviewed_at": now,
                "updated_at": now,
            },
        )
        if not changed:
            raise AppException("This request was just updated. Please refresh.", 409)
 
        return await self.repository.get_by_id(request_id)
 
    async def get_hr_emails(self) -> list[str]:
        return await self.repository.get_hr_emails()
 
    # ----------------------------------------------------------------- emails
    # These are synchronous (SMTP) and meant to run via BackgroundTasks.
    # A mail failure is logged and never fails the request.
    @staticmethod
    def _date_text(value) -> str:
        if isinstance(value, datetime):
            value = value.date()
        return value.strftime("%d %b %Y")
 
    def send_submitted_email(self, request: dict, hr_emails: list[str]) -> None:
        email_service = EmailService()
        data = {
            "employee_name": request.get("employee_name"),
            "employee_id": request["employee_id"],
            "designation": request.get("designation") or "—",
            "last_working_day": self._date_text(request["last_working_day"]),
            "notice_period_days": request["notice_period_days"],
            "reason": request["reason"],
            "remarks": request.get("remarks"),
        }
        for recipient in hr_emails:
            try:
                email_service.send_html_email(
                    recipient,
                    f"New resignation request: {request.get('employee_name')}",
                    "emails/exit_request_submitted.html",
                    data,
                )
            except Exception:
                logger.exception("Could not send resignation email to %s", recipient)
 
    def send_status_email(self, request: dict) -> None:
        recipient = request.get("email")
        if not recipient:
            return
        try:
            EmailService().send_html_email(
                recipient,
                f"Your resignation request is now {request['status']}",
                "emails/exit_request_status_update.html",
                {
                    "employee_name": request.get("employee_name"),
                    "status": request["status"],
                    "admin_note": request.get("admin_note"),
                    "last_working_day": self._date_text(request["last_working_day"]),
                },
            )
        except Exception:
            logger.exception("Could not send status email to %s", recipient)
 
    # -------------------------------------------------------------- serialize
    @staticmethod
    def _serialize(document: dict):
        if not document:
            return None
 
        last_day = document["last_working_day"]
        if isinstance(last_day, datetime):
            last_day = last_day.date()
 
        return {
            "id": str(document["_id"]),
            "employee_id": document["employee_id"],
            "employee_name": document.get("employee_name"),
            "email": document.get("email"),
            "designation": document.get("designation"),
            "department_id": document.get("department_id"),
            "reporting_manager": document.get("reporting_manager"),
            "exit_type": document.get("exit_type", "Resignation"),
            "last_working_day": last_day,
            "notice_period_days": document["notice_period_days"],
            "reason": document["reason"],
            "remarks": document.get("remarks"),
            "handover_tasks": document.get("handover_tasks", []),
            # storage_path is deliberately not exposed.
            "attachments": [
                {
                    "id": a["id"],
                    "file_name": a["file_name"],
                    "file_size": a["file_size"],
                    "mime_type": a["mime_type"],
                    "uploaded_at": a["uploaded_at"],
                }
                for a in document.get("attachments", [])
            ],
            "status": document["status"],
            "submitted_at": document["submitted_at"],
            "reviewed_at": document.get("reviewed_at"),
            "reviewed_by": document.get("reviewed_by"),
            "admin_note": document.get("admin_note"),
            "created_at": document["created_at"],
            "updated_at": document["updated_at"],
        }