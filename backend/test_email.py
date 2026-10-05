from app.services.email_service import EmailService


email_service = EmailService()

email_service.send_email(
    to_email="zaidmominn4@gmail.com",
    subject="HRMS SMTP Test",
    body=(
        "Hello,\n\n"
        "This is a test email from the HRMS backend.\n\n"
        "If you received this email, the GoDaddy SMTP configuration "
        "is working correctly.\n\n"
        "HRMS"
    ),
)

print("Test email sent successfully.")