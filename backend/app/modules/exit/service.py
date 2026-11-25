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
from app.modules.dashboard.activity_service import ActivityService
from app.repositories.department_repository import DepartmentRepository
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.employee_exit_request_repository import ExitRequestRepository
from app.modules.exit.schemas import (
    EXIT_TYPE_ORDER,
    ExitRequestCreate,
    ExitStatusUpdate,
)
from app.core.email_service import EmailService
from app.modules.dashboard.admin_notification_service import AdminNotificationService

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


# Documents the employee submits during exit. Add or rename entries here.
DOCUMENT_TEMPLATES = [
    {"key": "relieving_letter", "label": "Relieving Letter"},
    {"key": "asset_handover", "label": "Handover of Company Assets"},
    {"key": "no_dues_form", "label": "No Dues Form"},
]


class ExitRequestService:
    ACTIVE_STATUSES = ["Pending", "In Progress"]

    # Anything further along has been actioned or settled, so it stays on
    # record as an audit trail. A mis-keyed Pending/Cancelled request can be
    # removed; a completed exit cannot.
    DELETABLE_STATUSES = ["Pending", "Cancelled"]

    TRANSITIONS = {
        "Pending": {"In Progress", "Rejected"},
        "In Progress": {"Completed", "Rejected"},
    }

    def __init__(self):
        self.repository = ExitRequestRepository()
        self.department_repository = DepartmentRepository()
        self.employee_repository = EmployeeRepository()
        self.admin_notification_service = AdminNotificationService()
        self.activity_service = ActivityService()

    async def _department_names(self, department_ids: list[str]) -> dict[str, str]:
        """Resolve department ids to names in one pass.

        The dashboard groups requests by department and renders the name on
        every row, so resolving them one at a time would be an N+1 per page of
        results.
        """

        names: dict[str, str] = {}
        seen = {d for d in department_ids if d}

        for department_id in seen:
            department = await self.department_repository.get_by_id(department_id)
            if department:
                names[department_id] = department.get("name") or department_id

        return names

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

    # -------------------------------------------------------------- documents
    @staticmethod
    def _documents(document: dict) -> list[dict]:
        stored = {d["key"]: d.get("file") for d in document.get("submitted_documents", [])}
        return [
            {"key": t["key"], "label": t["label"], "required": True, "file": stored.get(t["key"])}
            for t in DOCUMENT_TEMPLATES
        ]

    async def upload_document(
        self,
        request_id: str,
        employee_id: str,
        key: str,
        upload: UploadFile,
    ):
        document = await self.get_request(request_id, employee_id)

        if document["status"] not in self.ACTIVE_STATUSES:
            raise AppException(
                "Documents can only be uploaded while the request is active", 400
            )

        if key not in {t["key"] for t in DOCUMENT_TEMPLATES}:
            raise AppException("Unknown document type", 404)

        prepared = await self.read_attachments([upload])
        if not prepared:
            raise AppException("Please select a file", 400)

        saved = self._store_files(prepared)[0]
        old = next(
            (d.get("file") for d in document.get("submitted_documents", []) if d["key"] == key),
            None,
        )

        changed = await self.repository.replace_document_if_active(
            request_id,
            self.ACTIVE_STATUSES,
            key,
            {"key": key, "file": saved},
            datetime.now(timezone.utc),
        )
        if not changed:
            self._remove_files([saved])
            raise AppException("This request was just updated. Please refresh.", 409)

        if old:
            self._remove_files([old])

        return await self.repository.get_by_id(request_id)

    def get_document_file(self, request: dict, key: str):
        entry = next(
            (d.get("file") for d in request.get("submitted_documents", []) if d["key"] == key),
            None,
        )
        if not entry:
            raise AppException("Document not found", 404)

        # Reuses the private-directory path check.
        return self.get_attachment_file({"attachments": [entry]}, entry["id"])

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

        await self.activity_service.record(
            text=f"Exit request submitted by {employee_id}",
            employee_id=employee_id,
            target="/dashboard/exit-requests",
        )

        # Notify the responsible HR/Admin when an employee submits an exit request.
        try:
            await self.admin_notification_service.create_for_employee(
                employee_id=str(employee_id),
                notification_type="resignation_submitted",
                title="New Employee Exit Request",
                message=(
                    f"{name} has submitted an exit request. "
                    f"Notice period: {payload.notice_period_days} days. "
                    f"Last working day: {payload.last_working_day}."
                ),
                target="/dashboard/exit-requests",
                target_id=str(created.get("_id")),
                include_super_admin=True,
            )
        except Exception:
            logger.exception(
                "Failed to create exit request notification for employee %s",
                employee_id,
            )
        return created

    async def list_requests(
        self,
        page: int,
        limit: int,
        employee_id: str | None = None,
        status: str | None = None,
        search: str | None = None,
        exit_type: str | None = None,
        department_id: str | None = None,
        submitted_from: datetime | None = None,
        submitted_to: datetime | None = None,
    ):
        skip = (page - 1) * limit
        records = await self.repository.list(
            skip,
            limit,
            employee_id,
            status,
            search,
            exit_type,
            department_id,
            submitted_from,
            submitted_to,
        )
        total = await self.repository.count(
            employee_id,
            status,
            search,
            exit_type,
            department_id,
            submitted_from,
            submitted_to,
        )

        department_names = await self._department_names(
            [r.get("department_id") for r in records]
        )

        return {
            "items": [
                self._serialize(r, department_names.get(r.get("department_id")))
                for r in records
            ],
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

    async def delete_request(self, request_id: str) -> bool:
        """Permanently remove a request that never progressed past review.

        This is for cleaning up duplicates and mis-keyed entries, so anything
        already in clearance, completed or rejected is refused - those are the
        record of a real offboarding.
        """

        document = await self.get_request(request_id)
        status = document["status"]

        if status not in self.DELETABLE_STATUSES:
            raise AppException(
                f"A request that is '{status}' cannot be deleted. Only pending "
                "or cancelled requests can be removed.",
                400,
            )

        deleted = await self.repository.delete_if_status(
            request_id, self.DELETABLE_STATUSES
        )
        if not deleted:
            raise AppException("This request was just updated. Please refresh.", 409)

        # Only after the document is gone, so a failed delete never orphans the
        # files the surviving record still points at.
        self._remove_files(document.get("attachments", []))

        return True

    # ------------------------------------------------------------------ admin
    async def create_admin_request(self, payload) -> dict:
        """Record a departure HR raised themselves.

        The employee form only ever produces resignations, so without this a
        termination could never exist and the type tabs and donut would be
        permanently empty.
        """

        employee = await self.employee_repository.get_by_employee_id(
            payload.employee_id
        )

        if not employee:
            raise AppException("Employee not found", 404)

        if await self.repository.find_active_for_employee(
            employee["employee_id"], self.ACTIVE_STATUSES
        ):
            raise AppException(
                "This employee already has an active exit request", 409
            )

        now = datetime.now(timezone.utc)

        name = (
            employee.get("full_name")
            or " ".join(
                part
                for part in (
                    employee.get("first_name"),
                    employee.get("last_name"),
                )
                if part
            )
            or employee["employee_id"]
        )

        document = {
            "employee_id": employee["employee_id"],
            "employee_name": name,
            "email": employee.get("email"),
            "designation": employee.get("designation"),
            "department_id": employee.get("department_id"),
            "reporting_manager": employee.get("reporting_manager"),
            "exit_type": payload.exit_type,
            "last_working_day": payload.last_working_day,
            "notice_period_days": payload.notice_period_days,
            "reason": payload.reason.strip(),
            "remarks": (payload.remarks or "").strip() or None,
            "handover_tasks": [t.model_dump() for t in payload.handover_tasks],
            "attachments": [],
            "status": "Pending",
            "submitted_at": now,
            "reviewed_at": None,
            "reviewed_by": None,
            "admin_note": None,
            "created_at": now,
            "updated_at": now,
        }

        return await self.repository.create(document)

    async def summary(self, exit_type: str | None = None):
        """Headline counts for the dashboard cards and donut.

        Status counts respect `exit_type` when one is given so the KPI row on a
        single-type tab (Resignations, Terminations) counts only that type,
        while the type split always reports every type so the overview donut
        keeps all four slices.
        """

        if exit_type:
            counts = await self.repository.count_by_status({"exit_type": exit_type})
        else:
            counts = await self.repository.count_by_status()

        total = sum(counts.values())
        by_type_raw = await self.repository.count_by_type()

        by_department_rows = await self.repository.count_by_department()
        department_names = await self._department_names(
            [row["_id"] for row in by_department_rows]
        )

        return {
            "total": total,
            "pending": counts.get("Pending", 0),
            "in_progress": counts.get("In Progress", 0),
            "completed": counts.get("Completed", 0),
            "rejected": counts.get("Rejected", 0),
            "cancelled": counts.get("Cancelled", 0),
            "by_type": {t: by_type_raw.get(t, 0) for t in EXIT_TYPE_ORDER},
            "by_department": [
                {
                    "department_id": row["_id"],
                    "department_name": department_names.get(
                        row["_id"], "Unassigned"
                    ),
                    "count": row["count"],
                }
                for row in by_department_rows
            ],
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

    async def update_handover_tasks(self, request_id: str, payload) -> dict:
        document = await self.get_request(request_id)

        if document["status"] not in self.ACTIVE_STATUSES:
            raise AppException(
                "Clearance steps can only be updated while the request is active", 400
            )

        changed = await self.repository.replace_handover_tasks_if_active(
            request_id,
            self.ACTIVE_STATUSES,
            [task.model_dump() for task in payload.handover_tasks],
            datetime.now(timezone.utc),
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
    def _serialize(document: dict, department_name: str | None = None):
        if not document:
            return None

        last_day = document["last_working_day"]
        if isinstance(last_day, datetime):
            last_day = last_day.date()

        return {
            "id": str(document["_id"]),
            "request_number": (
                f"EX-{document['submitted_at'].year}-"
                f"{str(document['_id'])[-6:].upper()}"
            ),
            "employee_id": document["employee_id"],
            "employee_name": document.get("employee_name"),
            "email": document.get("email"),
            "designation": document.get("designation"),
            "department_id": document.get("department_id"),
            "department_name": department_name,
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
            "documents": [
                {
                    "key": d["key"],
                    "label": d["label"],
                    "required": d["required"],
                    "status": "Submitted" if d["file"] else "Pending",
                    "file_name": d["file"]["file_name"] if d["file"] else None,
                    "file_size": d["file"]["file_size"] if d["file"] else None,
                    "uploaded_at": d["file"]["uploaded_at"] if d["file"] else None,
                }
                for d in ExitRequestService._documents(document)
            ],
            "status": document["status"],
            "submitted_at": document["submitted_at"],
            "reviewed_at": document.get("reviewed_at"),
            "reviewed_by": document.get("reviewed_by"),
            "admin_note": document.get("admin_note"),
            "created_at": document["created_at"],
            "updated_at": document["updated_at"],
        }
