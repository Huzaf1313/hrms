import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.security import hash_password
from app.repositories.otp_repository import OTPRepository
from app.repositories.user_repository import UserRepository
from app.services.email_service import EmailService


class OTPService:
    OTP_EXPIRY_MINUTES = 5
    MAX_ATTEMPTS = 5
    RESEND_COOLDOWN_SECONDS = 60
    TOKEN_EXPIRY_MINUTES = 15
    RATE_LIMIT_WINDOW_MINUTES = 15
    MAX_REQUESTS_PER_EMAIL = 5
    MAX_REQUESTS_PER_ADMIN = 20

    REGISTRATION_PURPOSE = "registration"
    PASSWORD_RESET_PURPOSE = "password_reset"
    EMPLOYEE_VERIFICATION_PURPOSE = "employee_email_verification"
    EMPLOYEE_TOKEN_PURPOSE = "employee_email_verified"

    def __init__(self):
        self.repository = OTPRepository()
        self.user_repository = UserRepository()
        self.email_service = EmailService()

    @staticmethod
    def _hash_otp(otp: str) -> str:
        return hashlib.sha256(otp.encode("utf-8")).hexdigest()

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
        expires_at = now + timedelta(minutes=self.OTP_EXPIRY_MINUTES)

        registration_data = {
            "email": email,
            "otp_hash": otp_hash,
            "purpose": self.REGISTRATION_PURPOSE,
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

        await self.repository.delete_by_email(email)
        await self.repository.create(registration_data)

        self.email_service.send_email(
            to_email=email,
            subject="HRMS Email Verification OTP",
            body=(
                f"Hello {full_name.strip()},\n\n"
                f"Your HRMS email verification OTP is: {otp}\n\n"
                f"This OTP is valid for {self.OTP_EXPIRY_MINUTES} minutes.\n\n"
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

    async def create_password_reset_otp(self, email: str):
        email = email.lower().strip()

        user = await self.user_repository.get_by_email(email)

        # Do not reveal whether an email address exists.
        if not user:
            return {
                "message": "If an account with this email exists, "
                "a password reset OTP has been sent.",
                "expires_in_minutes": self.OTP_EXPIRY_MINUTES,
            }

        otp = self._generate_otp()
        otp_hash = self._hash_otp(otp)

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=self.OTP_EXPIRY_MINUTES)

        reset_data = {
            "email": email,
            "otp_hash": otp_hash,
            "purpose": self.PASSWORD_RESET_PURPOSE,
            "attempts": 0,
            "created_at": now,
            "expires_at": expires_at,
        }

        await self.repository.delete_by_email(email)
        await self.repository.create(reset_data)

        self.email_service.send_html_email(
            to_email=email,
            subject="HRMS Password Reset OTP",
            template_name="emails/password_reset_otp.html",
            template_data={
                "full_name": user.get("full_name", "User"),
                "otp": otp,
                "expiry_minutes": self.OTP_EXPIRY_MINUTES,
            },
        )

        return {
            "message": "If an account with this email exists, "
            "a password reset OTP has been sent.",
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

        if otp_record.get("purpose") != self.REGISTRATION_PURPOSE:
            raise AppException(
                "Invalid OTP request. Please request a new OTP.",
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
                "Too many incorrect OTP attempts. "
                "Please request a new OTP.",
                400,
            )

        submitted_hash = self._hash_otp(otp)

        if not secrets.compare_digest(
            submitted_hash,
            otp_record["otp_hash"],
        ):
            await self.repository.update(
                email,
                {"attempts": attempts + 1},
            )

            remaining_attempts = self.MAX_ATTEMPTS - (attempts + 1)

            if remaining_attempts <= 0:
                await self.repository.delete_by_email(email)

                raise AppException(
                    "Too many incorrect OTP attempts. "
                    "Please request a new OTP.",
                    400,
                )

            raise AppException(
                f"Invalid OTP. {remaining_attempts} attempts remaining.",
                400,
            )

        await self.repository.delete_by_email(email)

        return otp_record

    async def verify_password_reset_otp(
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

        if otp_record.get("purpose") != self.PASSWORD_RESET_PURPOSE:
            raise AppException(
                "Invalid password reset OTP. "
                "Please request a new OTP.",
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
                "Too many incorrect OTP attempts. "
                "Please request a new OTP.",
                400,
            )

        submitted_hash = self._hash_otp(otp)

        if not secrets.compare_digest(
            submitted_hash,
            otp_record["otp_hash"],
        ):
            await self.repository.update(
                email,
                {"attempts": attempts + 1},
            )

            remaining_attempts = self.MAX_ATTEMPTS - (attempts + 1)

            if remaining_attempts <= 0:
                await self.repository.delete_by_email(email)

                raise AppException(
                    "Too many incorrect OTP attempts. "
                    "Please request a new OTP.",
                    400,
                )

            raise AppException(
                f"Invalid OTP. {remaining_attempts} attempts remaining.",
                400,
            )

        await self.repository.delete_by_email(email)

        reset_token = secrets.token_urlsafe(32)

        now = datetime.now(timezone.utc)
        reset_token_expires_at = now + timedelta(minutes=10)

        await self.repository.create(
            {
                "email": email,
                "purpose": "password_reset_authorized",
                "reset_token": reset_token,
                "created_at": now,
                "expires_at": reset_token_expires_at,
            }
        )

        return {
            "email": email,
            "verified": True,
            "reset_token": reset_token,
            "expires_in_minutes": 10,
        }

    async def create_employee_verification_otp(
        self,
        email: str,
        admin_id: str,
    ):
        email = email.lower().strip()

        # Reject if an account with this email already exists
        existing_user = await self.user_repository.get_by_email(email)
        if existing_user:
            raise AppException(
                "An account with this email address already exists.",
                400,
            )

        now = datetime.now(timezone.utc)
        since = now - timedelta(minutes=self.RATE_LIMIT_WINDOW_MINUTES)

        # Rate limit per target email
        email_recent_count = await self.repository.count_recent_requests(
            email=email,
            purpose=self.EMPLOYEE_VERIFICATION_PURPOSE,
            since=since,
        )
        if email_recent_count >= self.MAX_REQUESTS_PER_EMAIL:
            raise AppException(
                "Too many OTP requests for this email address. Please try again later.",
                429,
            )

        # Rate limit per administrator
        admin_recent_count = await self.repository.count_recent_admin_requests(
            admin_id=str(admin_id),
            purpose=self.EMPLOYEE_VERIFICATION_PURPOSE,
            since=since,
        )
        if admin_recent_count >= self.MAX_REQUESTS_PER_ADMIN:
            raise AppException(
                "Too many OTP requests from your account. Please wait before requesting more.",
                429,
            )

        # Enforce resend cooldown
        existing_otp = await self.repository.get_by_email_and_purpose(
            email,
            self.EMPLOYEE_VERIFICATION_PURPOSE,
        )
        if existing_otp:
            created_at = existing_otp.get("created_at")
            if created_at:
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                elapsed = (now - created_at).total_seconds()
                if elapsed < self.RESEND_COOLDOWN_SECONDS:
                    wait_time = int(self.RESEND_COOLDOWN_SECONDS - elapsed)
                    raise AppException(
                        f"Please wait {wait_time} seconds before requesting a new OTP.",
                        429,
                    )

        otp = self._generate_otp()
        otp_hash = self._hash_otp(otp)
        expires_at = now + timedelta(minutes=self.OTP_EXPIRY_MINUTES)

        # Dispatch email asynchronously before persisting the OTP.
        # This ensures we never report delivery success if sending fails.
        try:
            await self.email_service.send_html_email_async(
                to_email=email,
                subject="HRMS - Email Verification OTP",
                template_name="emails/employee_verification_otp.html",
                template_data={
                    "otp": otp,
                    "expiry_minutes": self.OTP_EXPIRY_MINUTES,
                },
            )
        except Exception as exc:
            raise AppException(
                "Failed to send verification email. Please check your SMTP configuration or try again.",
                500,
            ) from exc

        # Clean previous OTP records for this email & purpose
        await self.repository.delete_by_email_and_purpose(
            email,
            self.EMPLOYEE_VERIFICATION_PURPOSE,
        )

        otp_record = {
            "email": email,
            "admin_id": str(admin_id),
            "otp_hash": otp_hash,
            "purpose": self.EMPLOYEE_VERIFICATION_PURPOSE,
            "attempts": 0,
            "created_at": now,
            "expires_at": expires_at,
        }
        await self.repository.create(otp_record)

        return {
            "message": "Verification OTP sent successfully.",
            "expires_in_minutes": self.OTP_EXPIRY_MINUTES,
            "cooldown_seconds": self.RESEND_COOLDOWN_SECONDS,
        }

    async def verify_employee_verification_otp(
        self,
        email: str,
        otp: str,
        admin_id: str,
    ):
        email = email.lower().strip()
        otp = otp.strip()

        otp_record = await self.repository.get_by_email_and_purpose(
            email,
            self.EMPLOYEE_VERIFICATION_PURPOSE,
        )

        if not otp_record:
            raise AppException(
                "OTP not found or expired. Please request a new OTP.",
                400,
            )

        now = datetime.now(timezone.utc)
        expires_at = otp_record["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if now >= expires_at:
            await self.repository.delete_by_email_and_purpose(
                email,
                self.EMPLOYEE_VERIFICATION_PURPOSE,
            )
            raise AppException(
                "OTP has expired. Please request a new OTP.",
                400,
            )

        attempts = otp_record.get("attempts", 0)
        if attempts >= self.MAX_ATTEMPTS:
            await self.repository.delete_by_email_and_purpose(
                email,
                self.EMPLOYEE_VERIFICATION_PURPOSE,
            )
            raise AppException(
                "Too many incorrect OTP attempts. Please request a new OTP.",
                400,
            )

        submitted_hash = self._hash_otp(otp)
        if not secrets.compare_digest(submitted_hash, otp_record["otp_hash"]):
            await self.repository.update_by_email_and_purpose(
                email,
                self.EMPLOYEE_VERIFICATION_PURPOSE,
                {"attempts": attempts + 1},
            )
            remaining_attempts = self.MAX_ATTEMPTS - (attempts + 1)
            if remaining_attempts <= 0:
                await self.repository.delete_by_email_and_purpose(
                    email,
                    self.EMPLOYEE_VERIFICATION_PURPOSE,
                )
                raise AppException(
                    "Too many incorrect OTP attempts. Please request a new OTP.",
                    400,
                )
            raise AppException(
                f"Invalid OTP. {remaining_attempts} attempts remaining.",
                400,
            )

        # Delete OTP record immediately upon successful verification (one-time use)
        await self.repository.delete_by_email_and_purpose(
            email,
            self.EMPLOYEE_VERIFICATION_PURPOSE,
        )

        jti = secrets.token_hex(16)
        token_expires_at = now + timedelta(minutes=self.TOKEN_EXPIRY_MINUTES)

        payload = {
            "sub": email,
            "email": email,
            "admin_id": str(admin_id),
            "purpose": self.EMPLOYEE_TOKEN_PURPOSE,
            "jti": jti,
            "iat": now,
            "exp": token_expires_at,
        }

        verification_token = jwt.encode(
            payload,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )

        # Store verification record in database for atomic consumption and replay prevention
        await self.repository.create_verification_record(
            {
                "jti": jti,
                "email": email,
                "admin_id": str(admin_id),
                "purpose": self.EMPLOYEE_TOKEN_PURPOSE,
                "consumed": False,
                "created_at": now,
                "expires_at": token_expires_at,
            }
        )

        return {
            "message": "Email verified successfully.",
            "email": email,
            "verification_token": verification_token,
            "expires_in_minutes": self.TOKEN_EXPIRY_MINUTES,
        }

    async def consume_employee_email_verification(
        self,
        token: str | None,
        submitted_email: str,
        admin_id: str,
    ):
        if not token or not token.strip():
            raise AppException(
                "Email verification token is required to add an employee.",
                400,
            )

        token = token.strip()
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
            )
        except jwt.ExpiredSignatureError:
            raise AppException(
                "Email verification token has expired. Please verify the email again.",
                400,
            )
        except jwt.InvalidTokenError:
            raise AppException(
                "Invalid email verification token. Please verify the email again.",
                400,
            )

        if payload.get("purpose") != self.EMPLOYEE_TOKEN_PURPOSE:
            raise AppException(
                "Invalid verification token purpose.",
                400,
            )

        token_email = (payload.get("email") or payload.get("sub") or "").lower().strip()
        submitted_email = submitted_email.lower().strip()
        if token_email != submitted_email:
            raise AppException(
                "Verification token email does not match the submitted employee email.",
                400,
            )

        token_admin_id = str(payload.get("admin_id", ""))
        if token_admin_id != str(admin_id):
            raise AppException(
                "Verification token was not issued to the authenticated administrator.",
                403,
            )

        jti = payload.get("jti")
        if not jti:
            raise AppException(
                "Invalid verification token structure.",
                400,
            )

        # Atomically consume authorization to prevent replay attacks
        consumed_record = await self.repository.consume_verification_record(
            jti=jti,
            email=submitted_email,
            admin_id=str(admin_id),
            purpose=self.EMPLOYEE_TOKEN_PURPOSE,
        )

        if not consumed_record:
            raise AppException(
                "Verification token has already been used, is expired, or is invalid.",
                400,
            )

        return payload