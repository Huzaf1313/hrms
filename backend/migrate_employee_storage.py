"""Move employee files into the canonical per-employee R2 structure.

Dry run by default:

    python migrate_employee_storage.py
    python migrate_employee_storage.py --apply

The migration uses the employee record referenced by each file, so HR uploads
are placed under the target employee rather than the uploader.
"""

import asyncio
import base64
import sys
from pathlib import Path

from app.db.database import close_database_connection, connect_to_database, database
from app.services.object_storage_service import ObjectStorageService, content_type_for
from app.utils.employee_storage import employee_document_key, employee_profile_key


async def build_moves() -> list[dict]:
    users = {
        employee["employee_id"]: employee
        async for employee in database["users"].find(
            {"employee_id": {"$exists": True}}
        )
    }
    moves = []

    async for employee in database["users"].find(
        {
            "employee_id": {"$exists": True},
            "$or": [
                {"avatar_key": {"$exists": True}},
                {"avatar_url": {"$regex": r"^data:image/"}},
            ],
        }
    ):
        old_key = employee.get("avatar_key")
        legacy_avatar = employee.get("avatar_url") if not old_key else None
        if not old_key and not legacy_avatar:
            continue

        if legacy_avatar:
            mime_type, encoded = legacy_avatar.split(",", 1)
            mime_type = mime_type.removeprefix("data:").split(";", 1)[0]
            extension = "." + mime_type.split("/", 1)[-1].lower()
            if extension == ".jpeg":
                extension = ".jpg"
        else:
            mime_type = None
            encoded = None
            extension = Path(old_key).suffix or ".jpg"

        new_key = employee_profile_key(
            employee,
            extension,
        )
        moves.append(
            {
                "kind": "avatar",
                "old_key": old_key,
                "legacy_body": (
                    base64.b64decode(encoded)
                    if encoded
                    else None
                ),
                "content_type": mime_type or content_type_for(new_key),
                "new_key": new_key,
                "filter": {"_id": employee["_id"]},
                "update": {"avatar_key": new_key, "avatar_url": None},
            }
        )

    used_keys: set[str] = set()
    async for document in database["employee_documents"].find(
        {
            "$or": [
                {"storage_key": {"$exists": True}},
                {"storage_path": {"$exists": True}},
            ]
        }
    ):
        employee = users.get(document.get("employee_id"))
        old_key = document.get("storage_key")
        old_path = document.get("storage_path")
        if not employee or (not old_key and not old_path):
            continue

        extension = Path(document.get("file_name") or old_key).suffix
        suffix = None
        new_key = employee_document_key(
            employee,
            document.get("document_name") or "document",
            extension,
        )
        while new_key in used_keys:
            suffix = (suffix or 0) + 1
            new_key = employee_document_key(
                employee,
                document.get("document_name") or "document",
                extension,
                suffix=suffix,
            )
        used_keys.add(new_key)

        moves.append(
            {
                "kind": "document",
                "old_key": old_key,
                "old_path": old_path,
                "new_key": new_key,
                "filter": {"_id": document["_id"]},
                "update": {
                    "storage_key": new_key,
                    "file_name": new_key.rsplit("/", 1)[-1],
                },
                "unset": {"storage_path": ""} if old_path else {},
            }
        )

    return moves


async def apply_moves(moves: list[dict]) -> None:
    storage = ObjectStorageService()
    for move in moves:
        if move["old_key"] == move["new_key"]:
            continue

        if move.get("old_key"):
            await storage.copy(move["old_key"], move["new_key"])
        elif move.get("legacy_body") is not None:
            await storage.upload(
                key=move["new_key"],
                body=move["legacy_body"],
                content_type=move["content_type"],
                content_length=len(move["legacy_body"]),
            )
        else:
            source_path = Path(move["old_path"])
            if not source_path.is_file():
                raise FileNotFoundError(f"Legacy file not found: {source_path}")
            contents = source_path.read_bytes()
            await storage.upload(
                key=move["new_key"],
                body=contents,
                content_type=content_type_for(move["new_key"]),
                content_length=len(contents),
            )
        collection = database["users"] if move["kind"] == "avatar" else database["employee_documents"]
        update = {"$set": move["update"]}
        if move.get("unset"):
            update["$unset"] = move["unset"]
        await collection.update_one(move["filter"], update)
        if move.get("old_key"):
            await storage.delete(move["old_key"])
        elif move.get("old_path"):
            Path(move["old_path"]).unlink(missing_ok=True)


async def main(apply: bool) -> None:
    await connect_to_database()
    try:
        moves = await build_moves()
        changed = [move for move in moves if move["old_key"] != move["new_key"]]
        print(f"Found {len(moves)} stored employee file(s)")
        print(f"Files requiring migration: {len(changed)}")
        for move in changed:
            print(f"  {move.get('old_key') or move.get('old_path')} -> {move['new_key']}")

        if not apply:
            print("\nDry run only. Re-run with --apply to make changes.")
            return

        await apply_moves(moves)
        print("\nEmployee storage migration applied successfully.")
    finally:
        await close_database_connection()


if __name__ == "__main__":
    asyncio.run(main(apply="--apply" in sys.argv))
