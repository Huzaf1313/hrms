from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from app.repositories.employee_attendance_repository import (
    EmployeeAttendanceRepository,
)
from app.repositories.employee_attendance_regularization_repository import (
    EmployeeAttendanceRegularizationRepository,
)
from app.services.employee_notification_service import (
    EmployeeNotificationService,
)

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
        self.regularization_repository = (
            EmployeeAttendanceRegularizationRepository()
        )
        self.notification_service = EmployeeNotificationService()

    async def create_request(
        self,
        employee_id: str,
        attendance_id: str,
        attendance_date,
        issue_type: str,
        requested_check_in: datetime | None,
        requested_check_out: datetime | None,
        reason: str,
    ):
        requested_check_in = normalize_requested_time(requested_check_in)
        requested_check_out = normalize_requested_time(requested_check_out)

        # 1. Validate attendance ID and get attendance record
        attendance = await self.attendance_repository.get_by_id(
            attendance_id
        )

        if not attendance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attendance record not found",
            )

        # 2. Make sure attendance belongs to the employee
        if attendance["employee_id"] != employee_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Attendance record does not belong to this employee",
            )

        # 3. Validate the attendance date
        attendance_db_date = attendance.get("date")

        if hasattr(attendance_db_date, "date"):
            attendance_db_date = attendance_db_date.date()

        if attendance_db_date != attendance_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Attendance date does not match the selected date",
            )

        # 4. Determine the actual missing attendance field
        check_in_missing = (
            attendance.get("check_in") or attendance.get("in_time")
        ) is None
        check_out_missing = (
            attendance.get("check_out") or attendance.get("out_time")
        ) is None

        # Both are missing
        if check_in_missing and check_out_missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Regularization is allowed only when either "
                    "check-in or check-out is missing"
                ),
            )

        # Neither is missing
        if not check_in_missing and not check_out_missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Regularization is not required because "
                    "both check-in and check-out are already recorded"
                ),
            )

        # 5. Validate issue type against the actual attendance situation
        if check_in_missing:
            expected_issue_type = "Missing Check-In"

            if issue_type != expected_issue_type:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Issue type must be 'Missing Check-In' "
                        "for this attendance record"
                    ),
                )

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

        elif check_out_missing:
            expected_issue_type = "Missing Check-Out"

            if issue_type != expected_issue_type:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Issue type must be 'Missing Check-Out' "
                        "for this attendance record"
                    ),
                )

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

        # 6. Prevent duplicate pending requests
        existing_request = (
            await self.regularization_repository
            .get_pending_by_employee_and_attendance(
                employee_id=employee_id,
                attendance_id=attendance_id,
            )
        )

        if existing_request:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "A pending regularization request already "
                    "exists for this attendance record"
                ),
            )

        # 7. Create regularization document
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

        return await self.regularization_repository.create(
            regularization_data
        )

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

        # Get linked attendance record so we can use its date
        # in the employee notification.
        attendance = await self.attendance_repository.get_by_id(
            request["attendance_id"]
        )

        if not attendance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Linked attendance record not found",
            )

        if normalized_status == "Approved":
            attendance_update = {}

            if request.get("requested_check_in") is not None:
                attendance_update["check_in"] = request["requested_check_in"]
                attendance_update["in_time"] = request["requested_check_in"]

            if request.get("requested_check_out") is not None:
                attendance_update["check_out"] = request["requested_check_out"]
                attendance_update["out_time"] = request["requested_check_out"]

            attendance_update["is_regularized"] = True
            attendance_update["updated_at"] = now

            await self.attendance_repository.update(
                request["attendance_id"],
                attendance_update,
            )

        updated_request = await self.regularization_repository.update(
            regularization_id,
            update_data,
        )

        # Create employee notification after successful review.
        notification_type = (
            "regularization_approved"
            if normalized_status == "Approved"
            else "regularization_rejected"
        )

        attendance_date = attendance.get("date")

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