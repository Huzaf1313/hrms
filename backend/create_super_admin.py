"""CLI script to create or update a Super Admin account according to the HRMS architecture.

Usage:
    cd backend
    .\\venv\\Scripts\\python.exe create_super_admin.py

Or with command-line arguments:
    .\\venv\\Scripts\\python.exe create_super_admin.py --email admin@hrms.com --password StrongPassword@123 --name "Super Admin"
"""

import argparse
import asyncio
import sys
from datetime import datetime, timezone
import getpass

from app.core.roles import UserRole
from app.core.security import hash_password
from app.repositories.user_repository import UserRepository


async def create_or_update_super_admin(email: str, password: str, full_name: str):
    user_repo = UserRepository()
    email_clean = email.strip().lower()

    if not email_clean or "@" not in email_clean:
        print("[-] Error: A valid email address is required.")
        sys.exit(1)

    if len(password) < 8:
        print("[-] Error: Password must be at least 8 characters long.")
        sys.exit(1)

    existing = await user_repo.get_by_email(email_clean)
    now = datetime.now(timezone.utc)

    if existing:
        print(f"[*] Account with email '{email_clean}' already exists.")
        print(f"    Current Role: {existing.get('role')}")
        print(f"    Current Status: {'Active' if existing.get('is_active') else 'Inactive'}")

        # Promote to super_admin and update password
        await user_repo.collection.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "role": UserRole.SUPER_ADMIN.value,
                    "password_hash": hash_password(password),
                    "full_name": full_name.strip() or existing.get("full_name", "Super Admin"),
                    "is_active": True,
                    "is_locked": False,
                    "failed_login_attempts": 0,
                    "updated_at": now,
                }
            },
        )
        print(f"[+] Successfully updated account '{email_clean}' to SUPER_ADMIN role with new password.")
        print("[+] Account is active and unlocked.")
    else:
        doc = {
            "full_name": full_name.strip() or "Super Admin",
            "email": email_clean,
            "phone_number": "",
            "password_hash": hash_password(password),
            "company_name": "",
            "company_address": "",
            "reference": "",
            "role": UserRole.SUPER_ADMIN.value,
            "is_active": True,
            "is_locked": False,
            "failed_login_attempts": 0,
            "created_at": now,
            "updated_at": now,
        }
        await user_repo.collection.insert_one(doc)
        print(f"[+] Successfully created new SUPER_ADMIN account: {email_clean}")

    print("\n[+] You can now log in at the HRMS web portal using:")
    print(f"    Email:    {email_clean}")
    print(f"    Password: {'*' * len(password)}")
    print(f"    Role:     {UserRole.SUPER_ADMIN.value}\n")


def main():
    parser = argparse.ArgumentParser(description="Create or update an HRMS Super Admin account.")
    parser.add_argument("--email", type=str, help="Super admin email address")
    parser.add_argument("--password", type=str, help="Super admin password")
    parser.add_argument("--name", type=str, default="Super Admin", help="Full name (default: Super Admin)")

    args = parser.parse_args()

    email = args.email
    password = args.password
    name = args.name

    if not email:
        email = input("Enter Super Admin email: ").strip()

    if not password:
        password = getpass.getpass("Enter Super Admin password (min 8 characters): ")

    if not name:
        name = input("Enter Full Name [Super Admin]: ").strip() or "Super Admin"

    asyncio.run(create_or_update_super_admin(email, password, name))


if __name__ == "__main__":
    main()
