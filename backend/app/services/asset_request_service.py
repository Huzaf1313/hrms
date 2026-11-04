
import re
from datetime import datetime, timezone

from pymongo.errors import DuplicateKeyError

from app.core.exceptions import AppException
from app.repositories.asset_repository import AssetRepository
from app.repositories.asset_request_repository import AssetRequestRepository
from app.schemas.asset import (
    AssetRequestStatus,
    AssetRequestType,
    AssetStatus,
)
from app.services.asset_service import AssetService
from app.services.admin_notification_service import AdminNotificationService
from app.utils.pagination import PaginationParams


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _enum_value(value):
    return value.value if hasattr(value, "value") else value


class AssetRequestService:
    def __init__(self):
        self.repository = AssetRequestRepository()
        self.asset_repository = AssetRepository()
        self.asset_service = AssetService()
        self.admin_notification_service = AdminNotificationService()

    async def create_request(
        self,
        data: dict,
        current_user: dict | None = None,
    ):
        role = _enum_value(current_user.get("role")) if current_user else None

        request_type = _enum_value(data.get("request_type"))

        if request_type not in {
            AssetRequestType.ISSUE.value,
            AssetRequestType.RETURN.value,
        }:
            raise AppException("Invalid asset request type.", 400)

        asset_id = data.get("asset_id")
        if not asset_id:
            raise AppException("An asset must be selected.", 400)

        is_employee = role == "employee"

        # Employees may request available assets, but return requests must
        # be initiated by HR/Admin/Manager. Enforce this here, not just in UI.
        if is_employee and request_type == AssetRequestType.RETURN.value:
            raise AppException(
                "Employees cannot initiate asset return requests. "
                "Please contact HR/Admin/Manager.",
                403,
            )

        if is_employee:
            employee_id = current_user.get("employee_id")

            if not employee_id:
                raise AppException("Employee ID is missing.", 403)

            # Ignore any employee_id submitted by the client.
            data["employee_id"] = employee_id

            if request_type == AssetRequestType.ISSUE.value:
                asset = await self.asset_repository.get_by_id(asset_id)

                if (
                    not asset
                    or asset.get("status") != AssetStatus.AVAILABLE.value
                    or asset.get("assigned_to_employee_id")
                ):
                    raise AppException(
                        "This asset is not available to request.",
                        404,
                    )
            else:
                # Defensive guard; employee return requests were rejected above.
                raise AppException(
                    "Employees cannot initiate asset return requests.",
                    403,
                )
        else:
            # Preserve the existing admin visibility checks.
            asset = await self.asset_service.get_asset(
                asset_id,
                current_user,
            )

            if request_type == AssetRequestType.RETURN.value:
                assigned_employee_id = asset.get("assigned_to_employee_id")

                if not assigned_employee_id:
                    raise AppException(
                        "This asset is not currently assigned to an employee.",
                        400,
                    )

                # The return request must refer to the employee who actually
                # holds the asset, rather than an employee chosen by the caller.
                submitted_employee_id = data.get("employee_id")
                if (
                    submitted_employee_id
                    and submitted_employee_id != assigned_employee_id
                ):
                    raise AppException(
                        "The selected employee is not assigned this asset.",
                        400,
                    )

                data["employee_id"] = assigned_employee_id

            elif request_type == AssetRequestType.ISSUE.value:
                if (
                    asset.get("status") != AssetStatus.AVAILABLE.value
                    or asset.get("assigned_to_employee_id")
                ):
                    raise AppException(
                        "This asset is not available to request.",
                        400,
                    )

        employee_id = data.get("employee_id")
        if not employee_id:
            raise AppException("An employee must be selected.", 400)

        employee = await self.asset_service._resolve_employee(employee_id)

        await self.asset_service._assert_assignable(
            employee["employee_id"],
            current_user,
        )

        # Ensure the selected/derived employee matches the current assignment
        # for every return request.
        if request_type == AssetRequestType.RETURN.value:
            assigned_employee_id = asset.get("assigned_to_employee_id")
            if assigned_employee_id != employee["employee_id"]:
                raise AppException(
                    "A return request must belong to the employee currently "
                    "assigned this asset.",
                    400,
                )

        # Prevent duplicate pending requests for the same asset, employee,
        # and request type.
        existing = await self.repository.count(
            {
                "asset_id": str(asset["_id"]),
                "employee_id": employee["employee_id"],
                "request_type": request_type,
                "status": AssetRequestStatus.PENDING.value,
            }
        )

        if existing:
            raise AppException(
                "This employee already has a pending request for this asset.",
                409,
            )

        # A return request changes the asset to pending_return, but it does not
        # clear its assignment. The asset remains with the employee until an
        # administrator confirms that it has physically been received.
        if request_type == AssetRequestType.RETURN.value:
            await self._flag_for_return(asset, employee)

        sequence = await self.asset_repository.next_sequence("asset_request")

        request_data = {
            "request_tag": f"REQ-{sequence:03d}",
            "request_type": request_type,
            "asset_id": str(asset["_id"]),
            "asset_tag": asset["asset_tag"],
            "asset_name": asset["name"],
            "employee_id": employee["employee_id"],
            "employee_name": employee["full_name"],
            "detail": data.get("detail"),
            "reason": data.get("reason"),
            "status": AssetRequestStatus.PENDING.value,
            "requested_at": _now(),
            "reviewed_at": None,
            "reviewed_by": None,
            "admin_note": None,
            "created_at": _now(),
            "updated_at": _now(),
        }

        try:
            created = await self.repository.create(request_data)
        except DuplicateKeyError as exc:
            raise AppException(
                f"Request tag {request_data['request_tag']} already exists.",
                409,
            ) from exc

        # Notify the appropriate admin after saving the request. A notification
        # failure must not cause a successfully created request to be lost.
        try:
            await self.admin_notification_service.create_for_employee(
                employee_id=request_data["employee_id"],
                notification_type="asset_requested",
                title=(
                    "Asset return request"
                    if request_type == AssetRequestType.RETURN.value
                    else "Asset issue request"
                ),
                message=(
                    f"{request_data['asset_name']} "
                    f"({request_data['asset_tag']})."
                ),
                target="/dashboard/assets",
                target_id=str(created.get("_id")),
            )
        except Exception:
            pass

        return created

    async def get_requests(
        self,
        request_type: str | None = None,
        status: str | None = None,
        search: str | None = None,
        pagination: PaginationParams | None = None,
        current_user: dict | None = None,
    ):
        filters = {}

        role = _enum_value(current_user.get("role")) if current_user else None

        if role == "employee":
            employee_id = current_user.get("employee_id") if current_user else None

            if not employee_id:
                # Deliberately return no records for an incomplete employee account.
                filters["_id"] = {"$exists": False}
            else:
                # This also includes return requests initiated by an admin for
                # this employee, since the request belongs to the asset holder.
                filters["employee_id"] = employee_id

        else:
            scope = await self.asset_service._scope_filter(current_user)

            if scope:
                assigned_scope = scope.get("assigned_to_employee_id")

                if assigned_scope is not None:
                    filters["employee_id"] = assigned_scope

        # Apply request filters consistently for employees and administrators.
        if request_type is not None:
            filters["request_type"] = _enum_value(request_type)

        if status is not None:
            filters["status"] = _enum_value(status)

        if search and search.strip():
            pattern = {
                "$regex": re.escape(search.strip()),
                "$options": "i",
            }

            search_filter = {
                "$or": [
                    {"request_tag": pattern},
                    {"asset_name": pattern},
                    {"asset_tag": pattern},
                    {"employee_name": pattern},
                    {"employee_id": pattern},
                ]
            }

            # Combine search with the existing ownership/scope filters.
            if filters:
                filters = {"$and": [filters, search_filter]}
            else:
                filters = search_filter

        total = await self.repository.count(filters)

        if not pagination:
            requests = await self.repository.get_all(filters, 0, 0)
        else:
            requests = await self.repository.get_all(
                filters,
                pagination.skip,
                pagination.limit,
            )

        # One batch lookup supplies the live asset status used by the UI.
        asset_ids = [
            request["asset_id"]
            for request in requests
            if request.get("asset_id")
        ]

        assets = await self.asset_repository.get_by_ids(asset_ids)

        for request in requests:
            request["_asset_status"] = assets.get(
                request.get("asset_id"),
                {},
            ).get("status")

        return requests, total

    async def get_request(
        self,
        request_id: str,
        current_user: dict | None = None,
    ):
        request = await self.repository.get_by_id(request_id)

        if not request:
            raise AppException("Asset request not found.", 404)

        if not current_user:
            return request

        role = _enum_value(current_user.get("role"))

        if role == "employee":
            employee_id = current_user.get("employee_id")

            if (
                not employee_id
                or request.get("employee_id") != employee_id
            ):
                # Avoid disclosing another employee's request.
                raise AppException("Asset request not found.", 404)

            return request

        scope = await self.asset_service._scope_filter(current_user)

        if scope:
            assigned_scope = scope.get("assigned_to_employee_id")

            if assigned_scope is not None:
                if isinstance(assigned_scope, dict):
                    allowed_employee_ids = assigned_scope.get("$in")

                    if (
                        allowed_employee_ids is not None
                        and request.get("employee_id") not in allowed_employee_ids
                    ):
                        raise AppException("Asset request not found.", 404)

                    exact_employee_id = assigned_scope.get("$eq")
                    if (
                        exact_employee_id is not None
                        and request.get("employee_id") != exact_employee_id
                    ):
                        raise AppException("Asset request not found.", 404)

                elif request.get("employee_id") != assigned_scope:
                    raise AppException("Asset request not found.", 404)

        return request

    async def review_request(
        self,
        request_id: str,
        status: AssetRequestStatus | str,
        admin_note: str | None,
        reviewed_by: str | None,
        current_user: dict | None = None,
    ):
        request = await self.get_request(request_id, current_user)

        if request["status"] != AssetRequestStatus.PENDING.value:
            raise AppException(
                "This request has already been reviewed.",
                409,
            )

        decision = (
            status
            if isinstance(status, AssetRequestStatus)
            else AssetRequestStatus(status)
        )

        is_return_request = (
            request["request_type"] == AssetRequestType.RETURN.value
        )

        # Approving a return through the regular review endpoint must not release
        # an asset that has not been physically handed back. Use complete_return
        # for that operation.
        if is_return_request and decision == AssetRequestStatus.APPROVED:
            raise AppException(
                "To approve a return, first receive the asset and use the "
                "complete-return action.",
                400,
            )

        if decision == AssetRequestStatus.APPROVED:
            await self._apply_to_asset(request)

        if (
            is_return_request
            and decision == AssetRequestStatus.REJECTED
        ):
            await self._restore_after_rejected_return(request)

        update_data = {
            "status": decision.value,
            "admin_note": admin_note,
            "reviewed_by": reviewed_by,
            "reviewed_at": _now(),
            "updated_at": _now(),
        }

        return await self.repository.update(request_id, update_data)

    async def complete_return(
        self,
        request_id: str,
        reviewed_by: str | None,
        current_user: dict | None = None,
    ):
        """Complete a return only after HR/Admin/Manager receives the asset."""

        request = await self.get_request(request_id, current_user)

        if request["request_type"] != AssetRequestType.RETURN.value:
            raise AppException(
                "Only a return request can be completed this way.",
                400,
            )

        if request["status"] != AssetRequestStatus.PENDING.value:
            raise AppException(
                "This request has already been reviewed.",
                409,
            )

        if not request.get("asset_id"):
            raise AppException(
                "This request is not linked to an asset.",
                400,
            )

        asset = await self.asset_service.get_asset(
            request["asset_id"],
            current_user,
        )

        # Guard against a stale or mismatched return request.
        if (
            asset.get("assigned_to_employee_id")
            != request.get("employee_id")
        ):
            raise AppException(
                "The asset is no longer assigned to the employee on this request.",
                409,
            )

        # Do not mark the request approved unless releasing the asset succeeds.
        await self.asset_service.return_asset(
            request["asset_id"],
            current_user,
        )

        return await self.repository.update(
            request_id,
            {
                "status": AssetRequestStatus.APPROVED.value,
                "reviewed_by": reviewed_by,
                "reviewed_at": _now(),
                "updated_at": _now(),
            },
        )

    async def _apply_to_asset(self, request: dict):
        """Apply an approved issue request to the asset inventory."""

        if request["request_type"] != AssetRequestType.ISSUE.value:
            return

        await self.asset_service.assign_asset(
            request["asset_id"],
            request["employee_id"],
            issue_date=datetime.now(timezone.utc).date(),
        )

    async def _flag_for_return(self, asset: dict, employee: dict):
        """Flag a return without freeing the asset or removing its assignment."""

        if not asset.get("assigned_to_employee_id"):
            raise AppException(
                "This asset is not currently assigned to an employee.",
                400,
            )

        if (
            asset.get("assigned_to_employee_id")
            != employee.get("employee_id")
        ):
            raise AppException(
                "A return request must be initiated for the employee "
                "currently assigned this asset.",
                403,
            )

        if asset.get("status") == AssetStatus.PENDING_RETURN.value:
            raise AppException(
                "This asset already has a return in progress.",
                409,
            )

        await self.asset_repository.update(
            str(asset["_id"]),
            {
                "status": AssetStatus.PENDING_RETURN.value,
                "updated_at": _now(),
            },
        )

    async def _restore_after_rejected_return(self, request: dict):
        """Restore the asset's in-use status when its return request is rejected."""

        asset_id = request.get("asset_id")
        if not asset_id:
            return

        asset = await self.asset_repository.get_by_id(asset_id)
        if not asset:
            return

        # Only restore assets that are still held by the same employee and are
        # still flagged for return. Do not overwrite unrelated later changes.
        if (
            asset.get("assigned_to_employee_id") == request.get("employee_id")
            and asset.get("status") == AssetStatus.PENDING_RETURN.value
        ):
            await self.asset_repository.update(
                str(asset["_id"]),
                {
                    "status": AssetStatus.IN_USE.value,
                    "updated_at": _now(),
                },
            )
