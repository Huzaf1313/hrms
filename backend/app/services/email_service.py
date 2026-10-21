import smtplib
from email.message import EmailMessage
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from app.core.config import settings


class EmailService:
    def __init__(self):
        template_dir = (
            Path(__file__).resolve().parents[2]
            / "templates"
        )

        self.template_env = Environment(
            loader=FileSystemLoader(template_dir)
        )

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

        with smtplib.SMTP_SSL(
            settings.EMAIL_HOST,
            settings.EMAIL_PORT,
        ) as server:
            server.login(
                settings.EMAIL_USER,
                settings.EMAIL_PASSWORD,
            )

            server.send_message(message)

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

        with smtplib.SMTP_SSL(
            settings.EMAIL_HOST,
            settings.EMAIL_PORT,
        ) as server:
            server.login(
                settings.EMAIL_USER,
                settings.EMAIL_PASSWORD,
            )

            server.send_message(message)