from datetime import datetime

from app.repositories.session_repository import SessionRepository


class SessionService:
    def __init__(self):
        self.repository = SessionRepository()

    async def create_session(
        self,
        user_id: str,
        refresh_token: str,
    ):
        now = datetime.utcnow()

        session_data = {
            "user_id": user_id,
            "refresh_token": refresh_token,
            "is_active": True,
            "created_at": now,
            "last_used_at": now,
            "revoked_at": None,
        }

        return await self.repository.create(session_data)

    async def get_session_by_refresh_token(
        self,
        refresh_token: str,
    ):
        return await self.repository.get_by_refresh_token(
            refresh_token
        )

    async def is_session_active(
        self,
        refresh_token: str,
    ):
        session = await self.repository.get_by_refresh_token(
            refresh_token
        )

        if not session:
            return False

        return session.get("is_active", False)

    async def revoke_session(
        self,
        refresh_token: str,
    ):
        return await self.repository.revoke_by_refresh_token(
            refresh_token
        )

    async def update_last_used(
        self,
        session_id: str,
    ):
        return await self.repository.update_last_used(
            session_id
        )

    async def logout(
        self,
        refresh_token: str,
    ):
        session = await self.repository.get_by_refresh_token(
            refresh_token
        )

        if not session:
            return False

        if not session.get("is_active", False):
            return False

        await self.repository.revoke_by_refresh_token(
            refresh_token
        )

        return True