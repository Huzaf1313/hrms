import asyncio
import logging
import smtplib
from email.message import EmailMessage
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from app.core.config import settings
from app.core.exceptions import AppException

logger = logging.getLogger(__name__)


class EmailService:
    SMTP_TIMEOUT_SECONDS = 10

    def __init__(self):
        template_dir = (
            Path(__file__).resolve().parents[2]
            / "templates"
        )

        self.template_env = Environment(
            loader=FileSystemLoader(template_dir)
        )

    def _send_smtp(self, message: EmailMessage) -> None:
        try:
            with smtplib.SMTP_SSL(
                settings.EMAIL_HOST,
                settings.EMAIL_PORT,
                timeout=self.SMTP_TIMEOUT_SECONDS,
            ) as server:
                server.login(
                    settings.EMAIL_USER,
                    settings.EMAIL_PASSWORD,
                )
                server.send_message(message)
        except (smtplib.SMTPException, OSError, TimeoutError) as exc:
            logger.error(
                "SMTP delivery failure: %s (%s)",
                type(exc).__name__,
                exc,
            )
            raise AppException(
                "Failed to send email. Please check your SMTP configuration or try again.",
                500,
            ) from exc
        except Exception as exc:
            logger.error(
                "Unexpected error during email dispatch: %s",
                type(exc).__name__,
            )
            raise AppException(
                "An unexpected error occurred while sending the email.",
                500,
            ) from exc

    def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
    ) -> None:
        message = EmailMessage()

        message["From"] = settings.EMAIL_FROM
        message["To"] = to_email
        message["Subject"] = subject

        message.set_content(body)

        self._send_smtp(message)

    def send_html_email(
        self,
        to_email: str,
        subject: str,
        template_name: str,
        template_data: dict,
    ) -> None:
        template = self.template_env.get_template(
            template_name
        )

        html_body = template.render(**template_data)

        message = EmailMessage()

        message["From"] = settings.EMAIL_FROM
        message["To"] = to_email
        message["Subject"] = subject

        message.set_content(
            "Please view this email in an HTML-compatible email client."
        )

        message.add_alternative(
            html_body,
            subtype="html",
        )

        self._send_smtp(message)

    async def send_email_async(
        self,
        to_email: str,
        subject: str,
        body: str,
    ) -> None:
        await asyncio.to_thread(
            self.send_email,
            to_email,
            subject,
            body,
        )

    async def send_html_email_async(
        self,
        to_email: str,
        subject: str,
        template_name: str,
        template_data: dict,
    ) -> None:
        await asyncio.to_thread(
            self.send_html_email,
            to_email,
            subject,
            template_name,
            template_data,
        )