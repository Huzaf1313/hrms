import re


def safe_storage_part(value: str | None, fallback: str = "employee") -> str:
    """Return a readable, path-safe object-key segment."""
    value = re.sub(r"[^A-Za-z0-9]+", "_", (value or "").strip())
    value = value.strip("_")
    return value or fallback


def employee_storage_prefix(employee: dict) -> str:
    employee_id = safe_storage_part(employee.get("employee_id"), "employee")
    employee_name = safe_storage_part(
        "_".join(
            part
            for part in (
                employee.get("first_name"),
                employee.get("last_name"),
            )
            if part
        )
    )
    return f"employees/{employee_id}_{employee_name}"


def employee_profile_key(employee: dict, extension: str) -> str:
    prefix = employee_storage_prefix(employee)
    filename = prefix.rsplit("/", 1)[-1]
    return f"{prefix}/profile/{filename}_Profile{extension.lower()}"


def employee_document_key(
    employee: dict,
    document_name: str,
    extension: str,
    suffix: int | None = None,
) -> str:
    prefix = employee_storage_prefix(employee)
    filename = prefix.rsplit("/", 1)[-1]
    document_part = safe_storage_part(document_name, "document")
    if suffix:
        document_part = f"{document_part}_{suffix}"
    return f"{prefix}/documents/{filename}_{document_part}{extension.lower()}"
