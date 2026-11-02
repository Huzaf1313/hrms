import asyncio
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
from bson import ObjectId

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.roles import Permission, UserRole, has_permission
from app.repositories.otp_repository import OTPRepository
from app.services.email_service import EmailService
from app.services.employee_service import EmployeeService
from app.services.otp_service import OTPService


class TestEmailOTPWorkflow(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.otp_service = OTPService()
        self.admin_id = str(ObjectId())
        self.test_email = "new.employee@example.com"

    @patch.object(EmailService, "send_html_email_async", new_callable=AsyncMock)
    @patch.object(OTPRepository, "create", new_callable=AsyncMock)
    @patch.object(OTPRepository, "get_by_email_and_purpose", new_callable=AsyncMock)
    @patch.object(OTPRepository, "delete_by_email_and_purpose", new_callable=AsyncMock)
    @patch.object(OTPRepository, "count_recent_requests", new_callable=AsyncMock)
    @patch.object(OTPRepository, "count_recent_admin_requests", new_callable=AsyncMock)
    async def test_otp_request_and_successful_email_dispatch(
        self,
        mock_admin_count,
        mock_email_count,
        mock_delete,
        mock_get,
        mock_create,
        mock_send_email,
    ):
        mock_email_count.return_value = 0
        mock_admin_count.return_value = 0
        mock_get.return_value = None
        mock_create.return_value = {"_id": "test_id"}

        with patch.object(self.otp_service.user_repository, "get_by_email", new_callable=AsyncMock) as mock_user_get:
            mock_user_get.return_value = None

            result = await self.otp_service.create_employee_verification_otp(
                email=self.test_email,
                admin_id=self.admin_id,
            )

            self.assertIn("message", result)
            self.assertEqual(result["expires_in_minutes"], 5)
            self.assertEqual(result["cooldown_seconds"], 60)
            mock_send_email.assert_awaited_once()
            call_kwargs = mock_send_email.call_args.kwargs
            self.assertEqual(call_kwargs["to_email"], self.test_email)
            self.assertEqual(call_kwargs["template_name"], "emails/employee_verification_otp.html")
            self.assertIn("otp", call_kwargs["template_data"])
            self.assertEqual(len(call_kwargs["template_data"]["otp"]), 6)
            mock_create.assert_awaited_once()
            created_data = mock_create.call_args[0][0]
            self.assertEqual(created_data["email"], self.test_email)
            self.assertEqual(created_data["purpose"], "employee_email_verification")
            self.assertNotEqual(created_data["otp_hash"], call_kwargs["template_data"]["otp"])

    @patch.object(EmailService, "send_html_email_async", new_callable=AsyncMock)
    @patch.object(OTPRepository, "create", new_callable=AsyncMock)
    @patch.object(OTPRepository, "get_by_email_and_purpose", new_callable=AsyncMock)
    @patch.object(OTPRepository, "delete_by_email_and_purpose", new_callable=AsyncMock)
    @patch.object(OTPRepository, "count_recent_requests", new_callable=AsyncMock)
    @patch.object(OTPRepository, "count_recent_admin_requests", new_callable=AsyncMock)
    async def test_smtp_failure_handling(
        self,
        mock_admin_count,
        mock_email_count,
        mock_delete,
        mock_get,
        mock_create,
        mock_send_email,
    ):
        mock_email_count.return_value = 0
        mock_admin_count.return_value = 0
        mock_get.return_value = None
        mock_send_email.side_effect = AppException("SMTP connection timed out", 500)

        with patch.object(self.otp_service.user_repository, "get_by_email", new_callable=AsyncMock) as mock_user_get:
            mock_user_get.return_value = None

            with self.assertRaises(AppException) as ctx:
                await self.otp_service.create_employee_verification_otp(
                    email=self.test_email,
                    admin_id=self.admin_id,
                )

            self.assertEqual(ctx.exception.status_code, 500)
            self.assertIn("Failed to send verification email", ctx.exception.message)
            mock_create.assert_not_awaited()

    @patch.object(OTPRepository, "get_by_email_and_purpose", new_callable=AsyncMock)
    @patch.object(OTPRepository, "count_recent_requests", new_callable=AsyncMock)
    @patch.object(OTPRepository, "count_recent_admin_requests", new_callable=AsyncMock)
    async def test_resend_cooldown_enforced(
        self,
        mock_admin_count,
        mock_email_count,
        mock_get,
    ):
        mock_email_count.return_value = 0
        mock_admin_count.return_value = 0
        # Simulated OTP created 20 seconds ago
        mock_get.return_value = {
            "created_at": datetime.now(timezone.utc) - timedelta(seconds=20),
        }

        with patch.object(self.otp_service.user_repository, "get_by_email", new_callable=AsyncMock) as mock_user_get:
            mock_user_get.return_value = None

            with self.assertRaises(AppException) as ctx:
                await self.otp_service.create_employee_verification_otp(
                    email=self.test_email,
                    admin_id=self.admin_id,
                )

            self.assertEqual(ctx.exception.status_code, 429)
            self.assertIn("Please wait", ctx.exception.message)

    @patch.object(OTPRepository, "get_by_email_and_purpose", new_callable=AsyncMock)
    @patch.object(OTPRepository, "delete_by_email_and_purpose", new_callable=AsyncMock)
    @patch.object(OTPRepository, "create_verification_record", new_callable=AsyncMock)
    async def test_correct_otp_verification(
        self,
        mock_create_record,
        mock_delete,
        mock_get,
    ):
        raw_otp = "481920"
        otp_hash = self.otp_service._hash_otp(raw_otp)
        now = datetime.now(timezone.utc)

        mock_get.return_value = {
            "email": self.test_email,
            "otp_hash": otp_hash,
            "purpose": "employee_email_verification",
            "attempts": 0,
            "created_at": now - timedelta(minutes=1),
            "expires_at": now + timedelta(minutes=4),
        }

        result = await self.otp_service.verify_employee_verification_otp(
            email=self.test_email,
            otp=raw_otp,
            admin_id=self.admin_id,
        )

        self.assertEqual(result["email"], self.test_email)
        self.assertIn("verification_token", result)
        mock_delete.assert_awaited_once_with(self.test_email, "employee_email_verification")
        mock_create_record.assert_awaited_once()

        # Check the decoded verification token
        decoded = jwt.decode(
            result["verification_token"],
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        self.assertEqual(decoded["email"], self.test_email)
        self.assertEqual(decoded["admin_id"], self.admin_id)
        self.assertEqual(decoded["purpose"], "employee_email_verified")
        self.assertIn("jti", decoded)

    @patch.object(OTPRepository, "get_by_email_and_purpose", new_callable=AsyncMock)
    @patch.object(OTPRepository, "update_by_email_and_purpose", new_callable=AsyncMock)
    async def test_incorrect_otp_increments_attempts(
        self,
        mock_update,
        mock_get,
    ):
        raw_otp = "123456"
        otp_hash = self.otp_service._hash_otp(raw_otp)
        now = datetime.now(timezone.utc)

        mock_get.return_value = {
            "email": self.test_email,
            "otp_hash": otp_hash,
            "purpose": "employee_email_verification",
            "attempts": 1,
            "created_at": now - timedelta(minutes=1),
            "expires_at": now + timedelta(minutes=4),
        }

        with self.assertRaises(AppException) as ctx:
            await self.otp_service.verify_employee_verification_otp(
                email=self.test_email,
                otp="999999",
                admin_id=self.admin_id,
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Invalid OTP. 3 attempts remaining.", ctx.exception.message)
        mock_update.assert_awaited_once_with(
            self.test_email,
            "employee_email_verification",
            {"attempts": 2},
        )

    @patch.object(OTPRepository, "get_by_email_and_purpose", new_callable=AsyncMock)
    @patch.object(OTPRepository, "delete_by_email_and_purpose", new_callable=AsyncMock)
    async def test_expired_otp_rejected(
        self,
        mock_delete,
        mock_get,
    ):
        now = datetime.now(timezone.utc)
        mock_get.return_value = {
            "email": self.test_email,
            "otp_hash": "hash",
            "purpose": "employee_email_verification",
            "attempts": 0,
            "created_at": now - timedelta(minutes=10),
            "expires_at": now - timedelta(minutes=5),
        }

        with self.assertRaises(AppException) as ctx:
            await self.otp_service.verify_employee_verification_otp(
                email=self.test_email,
                otp="123456",
                admin_id=self.admin_id,
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("OTP has expired", ctx.exception.message)
        mock_delete.assert_awaited_once_with(self.test_email, "employee_email_verification")

    @patch.object(OTPRepository, "get_by_email_and_purpose", new_callable=AsyncMock)
    @patch.object(OTPRepository, "update_by_email_and_purpose", new_callable=AsyncMock)
    @patch.object(OTPRepository, "delete_by_email_and_purpose", new_callable=AsyncMock)
    async def test_maximum_attempts_exhausted(
        self,
        mock_delete,
        mock_update,
        mock_get,
    ):
        now = datetime.now(timezone.utc)
        mock_get.return_value = {
            "email": self.test_email,
            "otp_hash": self.otp_service._hash_otp("111111"),
            "purpose": "employee_email_verification",
            "attempts": 4,
            "created_at": now - timedelta(minutes=1),
            "expires_at": now + timedelta(minutes=4),
        }

        with self.assertRaises(AppException) as ctx:
            await self.otp_service.verify_employee_verification_otp(
                email=self.test_email,
                otp="000000",
                admin_id=self.admin_id,
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Too many incorrect OTP attempts", ctx.exception.message)
        mock_delete.assert_awaited_once_with(self.test_email, "employee_email_verification")

    @patch.object(OTPRepository, "consume_verification_record", new_callable=AsyncMock)
    async def test_token_email_mismatch_rejected(self, mock_consume):
        token = jwt.encode(
            {
                "sub": "user1@example.com",
                "email": "user1@example.com",
                "admin_id": self.admin_id,
                "purpose": "employee_email_verified",
                "jti": "jti123",
                "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
            },
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )

        with self.assertRaises(AppException) as ctx:
            await self.otp_service.consume_employee_email_verification(
                token=token,
                submitted_email="user2@example.com",
                admin_id=self.admin_id,
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("does not match", ctx.exception.message)
        mock_consume.assert_not_awaited()

    @patch.object(OTPRepository, "consume_verification_record", new_callable=AsyncMock)
    async def test_token_admin_mismatch_rejected(self, mock_consume):
        token = jwt.encode(
            {
                "sub": self.test_email,
                "email": self.test_email,
                "admin_id": "admin_one",
                "purpose": "employee_email_verified",
                "jti": "jti123",
                "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
            },
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )

        with self.assertRaises(AppException) as ctx:
            await self.otp_service.consume_employee_email_verification(
                token=token,
                submitted_email=self.test_email,
                admin_id="admin_two",
            )

        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("not issued to the authenticated administrator", ctx.exception.message)
        mock_consume.assert_not_awaited()

    async def test_expired_token_rejected(self):
        expired_token = jwt.encode(
            {
                "sub": self.test_email,
                "email": self.test_email,
                "admin_id": self.admin_id,
                "purpose": "employee_email_verified",
                "jti": "jti123",
                "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
            },
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )

        with self.assertRaises(AppException) as ctx:
            await self.otp_service.consume_employee_email_verification(
                token=expired_token,
                submitted_email=self.test_email,
                admin_id=self.admin_id,
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("has expired", ctx.exception.message)

    @patch.object(OTPRepository, "consume_verification_record", new_callable=AsyncMock)
    async def test_token_replay_atomic_single_use(self, mock_consume):
        mock_consume.return_value = None  # Already consumed in DB

        token = jwt.encode(
            {
                "sub": self.test_email,
                "email": self.test_email,
                "admin_id": self.admin_id,
                "purpose": "employee_email_verified",
                "jti": "jti_consumed",
                "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
            },
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )

        with self.assertRaises(AppException) as ctx:
            await self.otp_service.consume_employee_email_verification(
                token=token,
                submitted_email=self.test_email,
                admin_id=self.admin_id,
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already been used", ctx.exception.message)

    @patch.object(OTPService, "consume_employee_email_verification", new_callable=AsyncMock)
    @patch.object(EmailService, "send_html_email_async", new_callable=AsyncMock)
    async def test_employee_creation_and_welcome_email(
        self,
        mock_send_welcome,
        mock_consume_token,
    ):
        employee_service = EmployeeService()
        mock_consume_token.return_value = {"email": self.test_email}

        employee_data = {
            "employee_id": "EMP-9999",
            "first_name": "Alice",
            "last_name": "Smith",
            "email": self.test_email,
            "phone": "9876543210",
            "password": "Password@123",
            "department_id": str(ObjectId()),
            "designation": "Software Engineer",
            "joining_date": datetime.now(timezone.utc),
            "employment_type": "Full-time",
            "email_verification_token": "valid_signed_token",
        }

        with patch.object(employee_service.repository, "get_by_employee_id", new_callable=AsyncMock) as mock_emp_id, \
             patch.object(employee_service.user_repository, "get_by_email", new_callable=AsyncMock) as mock_user_email, \
             patch.object(employee_service.department_repository, "get_by_id", new_callable=AsyncMock) as mock_dept, \
             patch.object(employee_service.repository, "create", new_callable=AsyncMock) as mock_emp_create:

            mock_emp_id.return_value = None
            mock_user_email.return_value = None
            mock_dept.return_value = {"_id": employee_data["department_id"], "name": "Engineering"}
            mock_emp_create.return_value = {
                "_id": ObjectId(),
                **employee_data,
                "full_name": "Aabshar Mukadam",
            }

            emp, temp_pass, welcome_sent = await employee_service.create_employee(
                employee_data,
                created_by=self.admin_id,
            )

            self.assertEqual(emp["email"], self.test_email)
            self.assertEqual(temp_pass, "Password@123")
            self.assertTrue(welcome_sent)
            mock_consume_token.assert_awaited_once_with(
                token="valid_signed_token",
                submitted_email=self.test_email,
                admin_id=self.admin_id,
            )
            mock_send_welcome.assert_awaited_once()
            self.assertEqual(
                mock_send_welcome.await_args.kwargs["template_data"]["employee_name"],
                "Alice Smith",
            )

    @patch.object(OTPService, "consume_employee_email_verification", new_callable=AsyncMock)
    async def test_employee_creation_rejected_without_token(self, mock_consume_token):
        employee_service = EmployeeService()
        employee_data = {
            "employee_id": "EMP-9999",
            "first_name": "Alice",
            "last_name": "Smith",
            "email": self.test_email,
            "phone": "9876543210",
            "password": "Password@123",
            "department_id": str(ObjectId()),
            "designation": "Software Engineer",
            "joining_date": datetime.now(timezone.utc),
        }

        with self.assertRaises(AppException) as ctx:
            await employee_service.create_employee(
                employee_data,
                created_by=self.admin_id,
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("verification token is required", ctx.exception.message)
        mock_consume_token.assert_not_awaited()

    def test_permission_checks(self):
        # Admin / HR must have EMPLOYEES_CREATE
        self.assertTrue(has_permission(UserRole.HR_ADMIN.value, Permission.EMPLOYEES_CREATE))
        # Regular employee must NOT have EMPLOYEES_CREATE
        self.assertFalse(has_permission(UserRole.EMPLOYEE.value, Permission.EMPLOYEES_CREATE))

    @patch.object(EmailService, "send_email", new_callable=MagicMock)
    @patch.object(OTPRepository, "create", new_callable=AsyncMock)
    @patch.object(OTPRepository, "delete_by_email", new_callable=AsyncMock)
    async def test_registration_otp_workflow_regression(
        self,
        mock_delete,
        mock_create,
        mock_send_email,
    ):
        result = await self.otp_service.create_registration_otp(
            full_name="Bob User",
            email="bob@example.com",
            phone_number="1234567890",
            password="Password@123",
            role="employee",
        )
        self.assertEqual(result["expires_in_minutes"], 5)
        mock_send_email.assert_called_once()
        mock_create.assert_awaited_once()
        created_data = mock_create.call_args[0][0]
        self.assertEqual(created_data["purpose"], "registration")

    @patch.object(EmailService, "send_html_email", new_callable=MagicMock)
    @patch.object(OTPRepository, "create", new_callable=AsyncMock)
    @patch.object(OTPRepository, "delete_by_email", new_callable=AsyncMock)
    async def test_password_reset_otp_workflow_regression(
        self,
        mock_delete,
        mock_create,
        mock_send_email,
    ):
        with patch.object(self.otp_service.user_repository, "get_by_email", new_callable=AsyncMock) as mock_user_get:
            mock_user_get.return_value = {"email": "existing@example.com", "full_name": "Existing User"}
            result = await self.otp_service.create_password_reset_otp("existing@example.com")
            self.assertEqual(result["expires_in_minutes"], 5)
            mock_send_email.assert_called_once()
            mock_create.assert_awaited_once()
            created_data = mock_create.call_args[0][0]
            self.assertEqual(created_data["purpose"], "password_reset")

    @patch.object(OTPService, "consume_employee_email_verification", new_callable=AsyncMock)
    @patch.object(EmailService, "send_html_email_async", new_callable=AsyncMock)
    async def test_welcome_email_failure_does_not_abort_employee_creation(
        self,
        mock_send_welcome,
        mock_consume_token,
    ):
        employee_service = EmployeeService()
        mock_consume_token.return_value = {"email": self.test_email}
        mock_send_welcome.side_effect = AppException("SMTP server unreachable", 500)

        employee_data = {
            "employee_id": "EMP-8888",
            "first_name": "Charlie",
            "last_name": "Brown",
            "email": self.test_email,
            "phone": "9876543210",
            "password": "Password@123",
            "department_id": str(ObjectId()),
            "designation": "Designer",
            "joining_date": datetime.now(timezone.utc),
            "email_verification_token": "valid_token",
        }

        with patch.object(employee_service.repository, "get_by_employee_id", new_callable=AsyncMock) as mock_emp_id, \
             patch.object(employee_service.user_repository, "get_by_email", new_callable=AsyncMock) as mock_user_email, \
             patch.object(employee_service.department_repository, "get_by_id", new_callable=AsyncMock) as mock_dept, \
             patch.object(employee_service.repository, "create", new_callable=AsyncMock) as mock_emp_create:

            mock_emp_id.return_value = None
            mock_user_email.return_value = None
            mock_dept.return_value = {"_id": employee_data["department_id"], "name": "Design"}
            mock_emp_create.return_value = {
                "_id": ObjectId(),
                **employee_data,
                "full_name": "Charlie Brown",
            }

            emp, temp_pass, welcome_sent = await employee_service.create_employee(
                employee_data,
                created_by=self.admin_id,
            )

            self.assertEqual(emp["email"], self.test_email)
            self.assertFalse(welcome_sent)  # Marked as false, but employee creation succeeded!
            mock_emp_create.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
