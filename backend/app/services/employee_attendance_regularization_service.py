from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from app.repositories.employee_attendance_repository import (
    EmployeeAttendanceRepository,
)
from app.repositories.employee_attendance_regularization_repository import (
    EmployeeAttendanceRegularizationRepository,
)
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.shift_repository import ShiftRepository
from app.services.employee_notification_service import (
    EmployeeNotificationService,
)
from app.services.admin_notification_service import AdminNotificationService
from app.services.activity_service import ActivityService
from app.services.attendance_calculation import (
    compute_work_metrics,
    shift_duration_minutes,
)
from app.services.attendance_service import AttendanceService

IST = timezone(timedelta(hours=5, minutes=30))


def normalize_requested_time(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    # A datetime-local form sends a naive wall-clock time. Treat it as IST,
    # rather than UTC, so 03:00 PM remains 03:00 PM after approval.
    return value.replace(tzinfo=IST) if value.tzinfo is None else value


class EmployeeAttendanceRegularizationService:

    def __init__(self):
        self.attendance_repository = EmployeeAttendanceRepository()
        self.employee_repository = EmployeeRepository()
        self.regularization_repository = (
            EmployeeAttendanceRegularizationRepository()
        )
        self.notification_service = EmployeeNotificationService()
        # Separate instance: this one targets the admins who own the employee,
        # while the above targets the employee when a request is decided.
        self.admin_notification_service = AdminNotificationService()
        self.attendance_service = AttendanceService()
        self.activity_service = ActivityService()

    async def _recompute_metrics(
        self,
        attendance: dict,
        attendance_update: dict,
    ) -> dict:
        """Re-measure a day against its shift once the times are corrected.

        Uses the shift already snapshotted on the record, and only falls back
        to the employee's currently assigned shift when the record never had
        one, so approving a correction never rewrites which shift applied.
        """
        employee = await self.employee_repository.get_by_employee_id(
            attendance["employee_id"]
        )

        if not employee:
            employee = await self.employee_repository.get_by_id(
                attendance["employee_id"]
            )

        shift_start = attendance_update.get(
            "shift_start"
        ) or attendance.get("shift_start")
        shift_end = attendance_update.get(
            "shift_end"
        ) or attendance.get("shift_end")
        shift_id = attendance_update.get(
            "shift_id"
        ) or attendance.get("shift_id")

        shift = {}

        if not shift_start or not shift_end:
            shift = await self._shift_for_employee(employee, shift_id)

            shift_start = shift_start or shift.get("shift_start")
            shift_end = shift_end or shift.get("shift_end")
            shift_id = shift_id or shift.get("shift_id")

        duration = shift_duration_minutes(shift_start, shift_end)

        in_time = attendance_update.get("check_in") or attendance.get(
            "in_time"
        ) or attendance.get("check_in")
        out_time = attendance_update.get("check_out") or attendance.get(
            "out_time"
        ) or attendance.get("check_out")

        metrics = compute_work_metrics(
            in_time,
            out_time,
            shift_duration=duration,
            shift_start=shift_start,
        )

        computed = {
            "shift_id": str(shift_id) if shift_id else None,
            "shift": (
                shift.get("shift")
                or attendance.get("shift")
                or "General"
            ),
            "shift_start": shift_start,
            "shift_end": shift_end,
            "shift_duration_minutes": duration,
            "worked_minutes": metrics.worked_minutes,
            "overtime_minutes": metrics.overtime_minutes,
            "late_minutes": metrics.late_minutes,
            "is_overnight": metrics.is_overnight,
        }

        if metrics.worked_minutes is not None:
            computed["total_hours"] = round(
                metrics.worked_minutes / 60,
                2,
            )

        return computed

    async def _shift_for_employee(
        self,
        employee: dict | None,
        shift_id: str | None,
    ) -> dict:
        """Resolve the shift a record should be measured against.

        Deliberately does not fall back to a shift named "General": an
        employee with no assigned shift has no known shift length, and
        guessing one would invent overtime out of nothing.
        """
        if not shift_id and employee:
            shift_id = employee.get("shift_id")

        if not shift_id:
            return {}

        shift_repository = ShiftRepository()
        shift = await shift_repository.get_by_id(shift_id)

        if not shift:
            return {}

        start_time = shift.get("start_time")
        end_time = shift.get("end_time")

        return {
            "shift_id": str(shift["_id"]),
            "shift": shift.get("name") or "General",
            "shift_start": start_time,
            "shift_end": end_time,
        }

    
    async def create_request(
        self,
        employee_id: str,
        attendance_id: str | None,
        attendance_date,
        issue_type: str,
        requested_check_in: datetime | None,
        requested_check_out: datetime | None,
        reason: str,
    ):
        requested_check_in = normalize_requested_time(requested_check_in)
        requested_check_out = normalize_requested_time(requested_check_out)

        # Normalize attendance date
        if isinstance(attendance_date, datetime):
            attendance_date = attendance_date.date()

        # 1. Get attendance record if an attendance ID was provided
        attendance = None

        if attendance_id:
            attendance = await self.attendance_repository.get_by_id(
                attendance_id
            )

            if not attendance:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Attendance record not found",
                )

            # 2. Verify attendance belongs to the employee
            if attendance["employee_id"] != employee_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Attendance record does not belong to this employee",
                )

            # 3. Validate attendance date
            attendance_db_date = attendance.get("date")

            if isinstance(attendance_db_date, datetime):
                attendance_db_date = attendance_db_date.date()

            if attendance_db_date != attendance_date:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Attendance date does not match the selected date",
                )

            # 4. Determine missing attendance fields
            check_in_missing = (
                attendance.get("check_in") or attendance.get("in_time")
            ) is None

            check_out_missing = (
                attendance.get("check_out") or attendance.get("out_time")
            ) is None

            if check_in_missing and check_out_missing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Regularization is allowed only when either "
                        "check-in or check-out is missing"
                    ),
                )

            if not check_in_missing and not check_out_missing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Regularization is not required because "
                        "both check-in and check-out are already recorded"
                    ),
                )

            if check_in_missing:
                expected_issue_type = "Missing Check-In"
            else:
                expected_issue_type = "Missing Check-Out"

        else:
            # 5. No attendance document exists.
            # Only a Missing Check-In request is allowed in this situation.
            expected_issue_type = "Missing Check-In"

            if issue_type != expected_issue_type:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Only Missing Check-In regularization is allowed "
                        "when no attendance record exists"
                    ),
                )

        # 6. Validate issue type and requested times
        if issue_type != expected_issue_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Issue type must be '{expected_issue_type}' "
                    "for this attendance situation"
                ),
            )

        if issue_type == "Missing Check-In":
            if requested_check_in is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Requested check-in time is required",
                )

            if requested_check_out is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Requested check-out time should not be "
                        "provided for a missing check-in request"
                    ),
                )

        elif issue_type == "Missing Check-Out":
            if requested_check_out is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Requested check-out time is required",
                )

            if requested_check_in is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Requested check-in time should not be "
                        "provided for a missing check-out request"
                    ),
                )

        # 7. Prevent duplicate pending requests for the same employee/date
        existing_request = (
            await self.regularization_repository
            .get_pending_by_employee_and_date(
                employee_id=employee_id,
                attendance_date=attendance_date,
            )
        )

        if existing_request:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "A pending regularization request already "
                    "exists for this attendance date"
                ),
            )

        # 8. Create regularization document
        regularization_data = {
            "employee_id": employee_id,
            "attendance_id": attendance_id,
            "date": attendance_date,
            "issue_type": issue_type,
            "requested_check_in": requested_check_in,
            "requested_check_out": requested_check_out,
            "reason": reason,
            "status": "Pending",
            "requested_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }

        created = await self.regularization_repository.create(
            regularization_data
        )

        # Feed the admin dashboard's Recent Activities card. Uses the
        # employee's name like the admin leave flow does, rather than the
        # bare code. Wrapped so a logging failure can never lose the request.
        try:
            employee = await self.employee_repository.get_by_employee_id(
                employee_id
            )
            employee_name = (
                (employee or {}).get("full_name") or employee_id
            )
            await self.activity_service.record(
                text=(
                    f"{employee_name} requested attendance "
                    f"regularization ({issue_type})"
                ),
                employee_id=employee_id,
                target="/dashboard/regularization",
            )
        except Exception:
            pass

        # 9. Notify the admin who onboarded this employee
        try:
            await self.admin_notification_service.create_for_employee(
                employee_id=employee_id,
                notification_type="regularization_requested",
                title="Attendance regularization request",
                message=(
                    f"{issue_type} on {attendance_date.isoformat()}."
                ),
                target="/dashboard/regularization",
                target_id=str(created.get("_id")),
            )
        except Exception:
            pass

        return created

    async def get_employee_requests(
        self,
        employee_id: str,
        skip: int = 0,
        limit: int = 100,
    ):
        return await self.regularization_repository.get_by_employee(
            employee_id=employee_id,
            skip=skip,
            limit=limit,
        )

    async def get_request(
        self,
        regularization_id: str,
    ):
        request = await self.regularization_repository.get_by_id(
            regularization_id
        )

        if not request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Regularization request not found",
            )

        return request

    async def get_all_requests(
        self,
        status: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ):
        return await self.regularization_repository.get_all(
            status=status,
            skip=skip,
            limit=limit,
        )

async def review_request(
    self,
    regularization_id: str,
    decision: str,
    reviewed_by: str,
    comment: str | None = None,
):
    request = await self.regularization_repository.get_by_id(
        regularization_id
    )

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Regularization request not found",
        )

    normalized_status = decision.strip().capitalize()

    if normalized_status not in {"Approved", "Rejected"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be Approved or Rejected",
        )

    if request.get("status") != "Pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending requests can be reviewed",
        )

    now = datetime.utcnow()

    update_data = {
        "status": normalized_status,
        "reviewed_at": now,
        "reviewed_by": reviewed_by,
        "updated_at": now,
    }

    if comment is not None:
        update_data["review_comment"] = comment

    # 1. Process attendance only when the request is approved.
    # Rejected requests must not create or modify attendance.
    if normalized_status == "Approved":

        attendance_id = request.get("attendance_id")
        attendance = None
        attendance_created = False

        # 2. Retrieve an existing linked attendance record.
        if attendance_id:
            attendance = await self.attendance_repository.get_by_id(
                attendance_id
            )

            if not attendance:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Linked attendance record not found",
                )
            if not attendance:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Linked attendance record not found",
                )

        else:
            # 3. No attendance ID exists.
            # This is expected for a Missing Check-In request.
            if request.get("issue_type") != "Missing Check-In":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "An attendance record is required "
                        "for this regularization request"
                    ),
                )

            # Find the employee.
            employee_id = str(request["employee_id"])

            employee = await self.employee_repository.get_by_id(
                employee_id
            )

            if not employee:
                employee = (
                    await self.employee_repository.get_by_employee_id(
                        employee_id
                    )
                )

            if not employee:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Employee not found",
                )

            # Check whether attendance was created after the request
            # was submitted.
            attendance_date = request["date"]

            attendance = (
                await self.attendance_service.repository
                .get_by_employee_and_date(
                    employee_id=employee["employee_id"],
                    attendance_date=attendance_date,
                )
            )

            # Support attendance records stored using MongoDB employee ID.
            if not attendance and "_id" in employee:
                attendance = (
                    await self.attendance_service.repository
                    .get_by_employee_and_date(
                        employee_id=str(employee["_id"]),
                        attendance_date=attendance_date,
                    )
                )

            # 4. If attendance does not exist, create it using
            # the existing attendance creation logic.
            if not attendance:
                await self.attendance_service._mark_single_employee(
                    employee=employee,
                    data={
                        "employee_id": employee["employee_id"],
                        "date": attendance_date,
                        "in_time": request.get("requested_check_in"),
                        "out_time": None,
                        "status": "present",
                        "notes": "Attendance regularized after approval",
                    },
                    marked_by=reviewed_by,
                    regularize=True,
                )

                # Retrieve the newly created attendance document.
                attendance = (
                    await self.attendance_service.repository
                    .get_by_employee_and_date(
                        employee_id=employee["employee_id"],
                        attendance_date=attendance_date,
                    )
                )

                if not attendance and "_id" in employee:
                    attendance = (
                        await self.attendance_service.repository
                        .get_by_employee_and_date(
                            employee_id=str(employee["_id"]),
                            attendance_date=attendance_date,
                        )
                    )

                if not attendance:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to create attendance record",
                    )

                attendance_created = True

                # New attendance records are initially marked
                # is_regularized=False by _mark_single_employee().
                await self.attendance_service.repository.update(
                    str(attendance["_id"]),
                    {
                        "is_regularized": True,
                        "updated_at": now,
                    },
                )

            update_data["attendance_id"] = str(attendance["_id"])

        # 5. If attendance already existed, apply the correction.
        if not attendance_created:

            attendance_update = {}

            if request.get("issue_type") == "Missing Check-In":

                existing_check_in = (
                    attendance.get("check_in")
                    or attendance.get("in_time")
                )

                if existing_check_in is not None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            "Check-in has already been recorded. "
                            "This request can no longer be approved."
                        ),
                    )

                attendance_update["check_in"] = (
                    request["requested_check_in"]
                )
                attendance_update["in_time"] = (
                    request["requested_check_in"]
                )

            elif request.get("issue_type") == "Missing Check-Out":

                existing_check_out = (
                    attendance.get("check_out")
                    or attendance.get("out_time")
                )

                if existing_check_out is not None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            "Check-out has already been recorded. "
                            "This request can no longer be approved."
                        ),
                    )

                attendance_update["check_out"] = (
                    request["requested_check_out"]
                )
                attendance_update["out_time"] = (
                    request["requested_check_out"]
                )

            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid regularization issue type",
                )

            # Recalculate all attendance metrics.
            attendance_update.update(
                await self._recompute_metrics(
                    attendance,
                    attendance_update,
                )
            )

            attendance_update["is_regularized"] = True
            attendance_update["updated_at"] = now

            await self.attendance_repository.update(
                str(attendance["_id"]),
                attendance_update,
            )

    # 6. Update the regularization request.
    updated_request = await self.regularization_repository.update(
        regularization_id,
        update_data,
    )

    # 7. Notify the employee after review.
    notification_type = (
        "regularization_approved"
        if normalized_status == "Approved"
        else "regularization_rejected"
    )

    attendance_date = request.get("date")

    if hasattr(attendance_date, "strftime"):
        formatted_attendance_date = attendance_date.strftime("%d/%m/%Y")
    else:
        formatted_attendance_date = str(attendance_date)

    message = (
        f"Your attendance regularization request for "
        f"{formatted_attendance_date} has been "
        f"{normalized_status.lower()}."
    )

    if comment:
        message += f" Note: {comment}"

    await self.notification_service.create(
        employee_id=str(request["employee_id"]),
        notification_type=notification_type,
        title=f"Attendance Regularization {normalized_status}",
        message=message,
        target="/employee/attendance",
        target_id=str(
            request.get("_id", regularization_id)
        ),
    )

    return updated_request