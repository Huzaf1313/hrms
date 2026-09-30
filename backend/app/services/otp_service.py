import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from app.core.exceptions import AppException
from app.core.security import hash_password
from app.repositories.otp_repository import OTPRepository
from app.services.email_service import EmailService


class OTPService:
    OTP_EXPIRY_MINUTES = 5
    MAX_ATTEMPTS = 5

    def __init__(self):
        self.repository = OTPRepository()
        self.email_service = EmailService()

    @staticmethod
    def _hash_otp(otp: str) -> str:
        return hashlib.sha256(
            otp.encode("utf-8")
        ).hexdigest()

    @staticmethod
    def _generate_otp() -> str:
        return str(secrets.randbelow(900000) + 100000)

    async def create_registration_otp(
        self,
        full_name: str,
        email: str,
        phone_number: str,
        password: str,
        role: str,
        company_name: str = "",
        company_address: str = "",
        reference: str = "",
    ):
        email = email.lower().strip()

        otp = self._generate_otp()
        otp_hash = self._hash_otp(otp)

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(
            minutes=self.OTP_EXPIRY_MINUTES
        )

        # Store only the hashed password, never the plaintext password.
        registration_data = {
            "email": email,
            "otp_hash": otp_hash,
            "full_name": full_name.strip(),
            "phone_number": phone_number.strip(),
            "password_hash": hash_password(password),
            "role": role,
            "company_name": company_name.strip(),
            "company_address": company_address.strip(),
            "reference": reference.strip(),
            "attempts": 0,
            "created_at": now,
            "expires_at": expires_at,
        }

        # Replace any previous OTP for this email.
        await self.repository.delete_by_email(email)
        await self.repository.create(registration_data)

        self.email_service.send_email(
            to_email=email,
            subject="HRMS Email Verification OTP",
            body=(
                f"Hello {full_name.strip()},\n\n"
                f"Your HRMS email verification OTP is: {otp}\n\n"
                f"This OTP is valid for "
                f"{self.OTP_EXPIRY_MINUTES} minutes.\n\n"
                "If you did not request this registration, "
                "please ignore this email.\n\n"
                "Regards,\n"
                "HRMS Team"
            ),
        )

        return {
            "message": "OTP sent successfully",
            "expires_in_minutes": self.OTP_EXPIRY_MINUTES,
        }

    async def verify_registration_otp(
        self,
        email: str,
        otp: str,
    ):
        email = email.lower().strip()

        otp_record = await self.repository.get_by_email(email)

        if not otp_record:
            raise AppException(
                "OTP not found or expired. Please request a new OTP.",
                400,
            )

        now = datetime.now(timezone.utc)

        if now >= otp_record["expires_at"]:
            await self.repository.delete_by_email(email)

            raise AppException(
                "OTP has expired. Please request a new OTP.",
                400,
            )

        attempts = otp_record.get("attempts", 0)

        if attempts >= self.MAX_ATTEMPTS:
            await self.repository.delete_by_email(email)

            raise AppException(
                "Too many incorrect OTP attempts. Please request a new OTP.",
                400,
            )

        submitted_hash = self._hash_otp(otp)

        if not secrets.compare_digest(
            submitted_hash,
            otp_record["otp_hash"],
        ):
            await self.repository.update(
                email,
                {
                    "attempts": attempts + 1,
                },
            )

            remaining_attempts = self.MAX_ATTEMPTS - (
                attempts + 1
            )

            if remaining_attempts <= 0:
                await self.repository.delete_by_email(email)

                raise AppException(
                    "Too many incorrect OTP attempts. Please request a new OTP.",
                    400,
                )

            raise AppException(
                f"Invalid OTP. {remaining_attempts} attempts remaining.",
                400,
            )

        await self.repository.delete_by_email(email)

        return otp_record