import re
from datetime import datetime, timezone

from pymongo.errors import DuplicateKeyError

from app.core.exceptions import AppException
from app.repositories.asset_repository import AssetRepository
from app.repositories.asset_request_repository import AssetRequestRepository
from app.schemas.asset import AssetRequestStatus, AssetRequestType, AssetStatus
from app.services.asset_service import AssetService
from app.services.admin_notification_service import AdminNotificationService
from app.utils.pagination import PaginationParams


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AssetRequestService:
    def __init__(self):
        self.repository = AssetRequestRepository()
        self.asset_repository = AssetRepository()
        self.asset_service = AssetService()
        self.admin_notification_service = AdminNotificationService()

    async def create_request(self, data: dict):
        asset = await self.asset_service.get_asset(data["asset_id"])
        employee = await self.asset_service._resolve_employee(data["employee_id"])

        request_type = data["request_type"]
        request_type_value = (
            request_type.value
            if isinstance(request_type, AssetRequestType)
            else request_type
        )

        # One open request per asset per employee: the second copy is almost
        # always a double click rather than a genuine second ask.
        existing = await self.repository.count(
            {
                "asset_id": str(asset["_id"]),
                "employee_id": employee["employee_id"],
                "request_type": request_type_value,
                "status": AssetRequestStatus.PENDING.value,
            }
        )

        if existing:
            raise AppException(
                "This employee already has a pending request for this asset",
                409,
            )

        if request_type_value == AssetRequestType.RETURN.value:
            await self._flag_for_return(asset, employee)

        sequence = await self.asset_repository.next_sequence("asset_request")

        request_data = {
            "request_tag": f"REQ-{sequence:03d}",
            "request_type": request_type_value,
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
                f"Request tag {request_data['request_tag']} already exists",
                409,
            ) from exc

        # Routed to the admin who onboarded this employee. Wrapped so a
        # notification failure can never lose the asset request itself.
        try:
            await self.admin_notification_service.create_for_employee(
                employee_id=request_data["employee_id"],
                notification_type="asset_requested",
                title=(
                    "Asset return request"
                    if request_type_value == "return"
                    else "Asset issue request"
                ),
                message=f"{request_data['asset_name']} ({request_data['asset_tag']}).",
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
    ):
        filters: dict = {}

        if request_type:
            filters["request_type"] = request_type

        if status:
            filters["status"] = status

        if search and search.strip():
            pattern = {"$regex": re.escape(search.strip()), "$options": "i"}
            filters["$or"] = [
                {"request_tag": pattern},
                {"asset_name": pattern},
                {"employee_name": pattern},
            ]

        total = await self.repository.count(filters)

        if not pagination:
            requests = await self.repository.get_all(filters, 0, 0)
        else:
            requests = await self.repository.get_all(
                filters,
                pagination.skip,
                pagination.limit,
            )

        # One batch lookup for the live asset status behind every request, so
        # the UI can decide whether "Mark Returned" is offered.
        assets = await self.asset_repository.get_by_ids(
            [request["asset_id"] for request in requests if request.get("asset_id")]
        )

        for request in requests:
            request["_asset_status"] = assets.get(
                request.get("asset_id"), {}
            ).get("status")

        return requests, total

    async def get_request(self, request_id: str):
        request = await self.repository.get_by_id(request_id)

        if not request:
            raise AppException("Asset request not found", 404)

        return request

    async def review_request(
        self,
        request_id: str,
        status: AssetRequestStatus | str,
        admin_note: str | None,
        reviewed_by: str | None,
    ):
        request = await self.get_request(request_id)

        if request["status"] != AssetRequestStatus.PENDING.value:
            raise AppException(
                "This request has already been reviewed",
                409,
            )

        # The schema hands over an enum, but a plain string is just as valid to
        # any other caller, so normalise rather than trusting one shape.
        decision = (
            status if isinstance(status, AssetRequestStatus) else AssetRequestStatus(status)
        )

        approved = decision == AssetRequestStatus.APPROVED

        if approved:
            await self._apply_to_asset(request)

        update_data = {
            "status": decision.value,
            "admin_note": admin_note,
            "reviewed_by": reviewed_by,
            "reviewed_at": _now(),
            "updated_at": _now(),
        }

        return await self.repository.update(request_id, update_data)

    async def complete_return(self, request_id: str, reviewed_by: str | None):
        """Confirm receipt of an asset and close the request in one step.

        Raising a return request only flags the asset as pending_return; it
        stays with the employee on purpose. This is where the admin says "yes,
        I have the laptop back", which is the only event that both frees the
        asset and takes the request off pending.

        The asset is released before the request is marked approved because
        `return_asset` is the step that can legitimately fail - it rejects an
        asset nobody is holding, and that rejection should leave the request
        pending so the admin still sees an actionable row rather than one
        already reviewed with the kit still out.
        """

        request = await self.get_request(request_id)

        if request["request_type"] != AssetRequestType.RETURN.value:
            raise AppException(
                "Only a return request can be completed this way",
                400,
            )

        if request["status"] != AssetRequestStatus.PENDING.value:
            raise AppException(
                "This request has already been reviewed",
                409,
            )

        if not request.get("asset_id"):
            raise AppException(
                "This request is not linked to an asset",
                400,
            )

        await self.asset_service.return_asset(request["asset_id"])

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
        """Move the asset to match an approved request.

        Approving an *issue* hands the asset over. Approving a *return* only
        records the decision: the asset was already flagged pending_return when
        the request was raised, and it stays with the employee until someone
        confirms they have physically received it.
        """

        if request["request_type"] != AssetRequestType.ISSUE.value:
            return

        await self.asset_service.assign_asset(
            request["asset_id"],
            request["employee_id"],
            issue_date=datetime.now(timezone.utc).date(),
        )

    async def _flag_for_return(self, asset: dict, employee: dict):
        """Mark an asset as on its way back the moment a return is requested.

        The asset is deliberately NOT freed here. It stays assigned until the
        admin confirms receipt via return_asset, otherwise an employee could
        keep using a laptop the moment they asked to give it back.
        """

        if not asset.get("assigned_to_employee_id"):
            raise AppException(
                "This asset is not currently assigned to anyone",
                400,
            )

        await self.asset_repository.update(
            str(asset["_id"]),
            {
                "status": AssetStatus.PENDING_RETURN.value,
                "updated_at": _now(),
            },
        )