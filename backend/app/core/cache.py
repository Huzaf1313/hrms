import json
import logging
from typing import Any

from urllib.parse import urlsplit, urlunsplit
from redis.asyncio import ConnectionPool, Redis

from app.core.config import settings

logger = logging.getLogger(__name__)

_redis_client: Redis | None = None
_connection_pool: ConnectionPool | None = None


def sanitize_redis_url(url: str) -> str:
    """Mask credentials (username and password) in a Redis URL for safe logging.

    Preserves scheme, host, port, db path, and query params without exposing secrets.
    Handles redis://, rediss://, and other URL schemes.
    """
    if not url:
        return ""
    try:
        parts = urlsplit(url)
        if "@" in parts.netloc:
            _, host_port = parts.netloc.rsplit("@", 1)
            sanitized_netloc = f"***:***@{host_port}"
            return urlunsplit((parts.scheme, sanitized_netloc, parts.path, parts.query, parts.fragment))
        return url
    except Exception:
        return "<masked_redis_url>"


def get_redis_client() -> Redis | None:
    """Return the global Redis client instance, or None if not initialized."""
    return _redis_client


async def init_redis() -> Redis | None:
    """Initialize Redis connection pool and client.

    If Redis is disabled (settings.REDIS_ENABLED is False) or unavailable,
    it logs an informative message and returns None without crashing the application.
    """
    global _redis_client, _connection_pool

    if not settings.REDIS_ENABLED:
        logger.info("Redis caching is disabled (REDIS_ENABLED=False).")
        return None

    if _redis_client is not None:
        return _redis_client

    safe_url = sanitize_redis_url(settings.REDIS_URL)

    try:
        _connection_pool = ConnectionPool.from_url(
            settings.REDIS_URL,
            max_connections=20,
            socket_connect_timeout=2.0,
            socket_timeout=2.0,
            decode_responses=True,
        )
        client = Redis(connection_pool=_connection_pool)

        # Test the connection with a quick ping
        await client.ping()
        _redis_client = client
        logger.info("Redis connected successfully at %s", safe_url)
        return _redis_client
    except Exception as exc:
        logger.warning(
            "Failed to connect to Redis at %s: %s. Application will continue without caching.",
            safe_url,
            exc,
        )
        if _connection_pool:
            try:
                await _connection_pool.disconnect()
            except Exception:
                pass
        _connection_pool = None
        _redis_client = None
        return None


async def close_redis() -> None:
    """Close Redis client connection and disconnect the connection pool."""
    global _redis_client, _connection_pool

    if _redis_client is not None:
        try:
            await _redis_client.aclose()
            logger.info("Redis client closed.")
        except Exception as exc:
            logger.warning("Error closing Redis client: %s", exc)
        finally:
            _redis_client = None

    if _connection_pool is not None:
        try:
            await _connection_pool.disconnect()
            logger.info("Redis connection pool disconnected.")
        except Exception as exc:
            logger.warning("Error disconnecting Redis connection pool: %s", exc)
        finally:
            _connection_pool = None


async def check_redis_health() -> dict[str, Any]:
    """Check health and connectivity status of Redis.

    Returns a dict with 'status' and 'connected' indicators.
    """
    if not settings.REDIS_ENABLED:
        return {"status": "disabled", "connected": False}

    if _redis_client is None:
        return {"status": "unavailable", "connected": False}

    try:
        pong = await _redis_client.ping()
        return {"status": "healthy", "connected": bool(pong)}
    except Exception as exc:
        return {"status": "unhealthy", "connected": False, "error": str(exc)}


async def is_redis_available() -> bool:
    """Convenience helper returning True if Redis is active and responding."""
    health = await check_redis_health()
    return bool(health.get("connected"))


async def get_cache(key: str) -> Any | None:
    """Retrieve and deserialize a JSON-encoded value from cache.

    Returns None if:
    - Redis is disabled or unavailable
    - The key does not exist
    - An error occurs during lookup or decoding
    """
    if _redis_client is None:
        return None

    try:
        raw_val = await _redis_client.get(key)
        if raw_val is None:
            return None

        try:
            return json.loads(raw_val)
        except (json.JSONDecodeError, TypeError) as exc:
            logger.warning(
                "Malformed cached JSON for key '%s': %s. Treating as cache miss and deleting corrupt key.",
                key,
                exc,
            )
            try:
                await _redis_client.delete(key)
            except Exception:
                pass
            return None
    except Exception as exc:
        logger.warning("Cache read failed for key '%s': %s", key, exc)
        return None


async def set_cache(key: str, value: Any, ttl: int | None = None) -> bool:
    """Serialize a value to JSON and store it in Redis.

    Parameters:
    - key: Cache key
    - value: JSON-serializable value (strings, dicts, lists, numbers, etc.)
    - ttl: Time-to-live in seconds (optional)

    Returns True if stored successfully, False otherwise.
    """
    if _redis_client is None:
        return False

    try:
        serialized = json.dumps(value, default=str)
    except Exception as exc:
        logger.error("Failed to serialize cache value for key '%s': %s", key, exc)
        return False

    try:
        if ttl is not None and ttl > 0:
            await _redis_client.set(key, serialized, ex=ttl)
        else:
            await _redis_client.set(key, serialized)
        return True
    except Exception as exc:
        logger.warning("Cache write failed for key '%s': %s", key, exc)
        return False


async def delete_cache(key: str) -> bool:
    """Delete a key from Redis.

    Returns True if the key was deleted, False otherwise.
    """
    if _redis_client is None:
        return False

    try:
        deleted = await _redis_client.delete(key)
        return bool(deleted > 0)
    except Exception as exc:
        logger.warning("Cache delete failed for key '%s': %s", key, exc)
        return False


async def delete_cache_by_prefix(prefix: str) -> int:
    """Delete all keys matching the prefix pattern '{prefix}*'.

    Scans keys iteratively using SCAN to avoid blocking Redis.
    Returns the number of keys deleted.
    """
    if _redis_client is None:
        return 0

    pattern = f"{prefix}*"
    total_deleted = 0

    try:
        keys_to_delete: list[str] = []
        async for matched_key in _redis_client.scan_iter(match=pattern, count=100):
            keys_to_delete.append(matched_key)
            if len(keys_to_delete) >= 100:
                deleted_batch = await _redis_client.delete(*keys_to_delete)
                total_deleted += deleted_batch
                keys_to_delete.clear()

        if keys_to_delete:
            deleted_batch = await _redis_client.delete(*keys_to_delete)
            total_deleted += deleted_batch

        return total_deleted
    except Exception as exc:
        logger.warning("Cache delete by prefix failed for pattern '%s': %s", pattern, exc)
        return total_deleted


async def get_cache_ttl(key: str) -> int | None:
    """Get the remaining TTL in seconds for a key.

    Returns:
    - Remaining seconds (> 0) if key has an expiration
    - -1 if key exists without TTL
    - None if key does not exist or Redis is unavailable
    """
    if _redis_client is None:
        return None

    try:
        ttl = await _redis_client.ttl(key)
        if ttl == -2:
            # Key does not exist
            return None
        return ttl
    except Exception as exc:
        logger.warning("Cache TTL lookup failed for key '%s': %s", key, exc)
        return None


async def invalidate_payroll_analytics_cache() -> int:
    """Invalidate all cached payroll analytics variants across all roles, users, years, and months."""
    try:
        deleted = await delete_cache_by_prefix("payroll:analytics:")
        logger.info("Invalidated %d payroll analytics cache entries.", deleted)
        return deleted
    except Exception as exc:
        logger.error(
            "Failed to invalidate payroll analytics cache: %s. Relying on TTL expiration.",
            exc,
        )
        return 0


async def invalidate_dashboard_cache() -> int:
    """Invalidate all cached dashboard data across all roles and users."""
    try:
        deleted = await delete_cache_by_prefix("dashboard:")
        logger.info("Invalidated %d dashboard cache entries.", deleted)
        return deleted
    except Exception as exc:
        logger.error(
            "Failed to invalidate dashboard cache: %s. Relying on TTL expiration.",
            exc,
        )
        return 0


async def invalidate_salary_structures_cache(structure_id: str | None = None) -> int:
    """Invalidate salary structures cache (all list and detail variants)."""
    try:
        deleted = await delete_cache_by_prefix("salary_structures:")
        logger.info("Invalidated %d salary structure cache entries.", deleted)
        return deleted
    except Exception as exc:
        logger.error(
            "Failed to invalidate salary structure cache: %s. Relying on TTL expiration.",
            exc,
        )
        return 0


async def invalidate_deductions_cache(deduction_id: str | None = None) -> int:
    """Invalidate deductions configuration cache (all list and detail variants)."""
    try:
        deleted = await delete_cache_by_prefix("deductions:")
        logger.info("Invalidated %d deduction cache entries.", deleted)
        return deleted
    except Exception as exc:
        logger.error(
            "Failed to invalidate deduction cache: %s. Relying on TTL expiration.",
            exc,
        )
        return 0


async def invalidate_shifts_cache(employee_id: str | None = None) -> int:
    """Invalidate shift cache entries.

    If employee_id is specified, invalidates that employee's assigned shift cache.
    Otherwise, invalidates all shift list and employee shift cache entries.
    """
    try:
        if employee_id:
            key = f"shifts:me:{employee_id}"
            deleted = 1 if await delete_cache(key) else 0
            logger.info("Invalidated shift cache for employee %s.", employee_id)
            return deleted
        else:
            deleted = await delete_cache_by_prefix("shifts:")
            logger.info("Invalidated %d shift cache entries.", deleted)
            return deleted
    except Exception as exc:
        logger.error("Failed to invalidate shift cache: %s. Relying on TTL expiration.", exc)
        return 0


async def invalidate_holidays_cache() -> int:
    """Invalidate all cached holiday calendar variants."""
    try:
        deleted = await delete_cache_by_prefix("holidays:")
        logger.info("Invalidated %d holiday cache entries.", deleted)
        return deleted
    except Exception as exc:
        logger.error("Failed to invalidate holiday cache: %s. Relying on TTL expiration.", exc)
        return 0


async def invalidate_managers_cache() -> int:
    """Invalidate reporting manager dropdown list cache."""
    try:
        deleted = await delete_cache_by_prefix("users:managers:")
        logger.info("Invalidated %d manager dropdown cache entries.", deleted)
        return deleted
    except Exception as exc:
        logger.error("Failed to invalidate manager dropdown cache: %s. Relying on TTL expiration.", exc)
        return 0


async def invalidate_attendance_options_cache() -> int:
    """Invalidate attendance filter dropdown options cache across all scopes."""
    try:
        deleted = await delete_cache_by_prefix("attendance:options:")
        logger.info("Invalidated %d attendance options cache entries.", deleted)
        return deleted
    except Exception as exc:
        logger.error("Failed to invalidate attendance options cache: %s. Relying on TTL expiration.", exc)
        return 0


async def invalidate_assets_cache(asset_id: str | None = None) -> int:
    """Invalidate asset cache entries (stats, allocations, inventory lists, details)."""
    try:
        deleted = await delete_cache_by_prefix("assets:")
        logger.info("Invalidated %d asset cache entries.", deleted)
        return deleted
    except Exception as exc:
        logger.error("Failed to invalidate asset cache: %s. Relying on TTL expiration.", exc)
        return 0


async def invalidate_attendance_cache(attendance_id: str | None = None) -> int:
    """Invalidate attendance lists, summaries, range, record, and employee calendar caches while preserving options."""
    try:
        total = 0
        total += await delete_cache_by_prefix("attendance:list:")
        total += await delete_cache_by_prefix("attendance:summary:")
        total += await delete_cache_by_prefix("attendance:range:")
        total += await delete_cache_by_prefix("attendance:record:")
        total += await delete_cache_by_prefix("attendance:emp:")
        logger.info("Invalidated %d attendance cache entries.", total)
        return total
    except Exception as exc:
        logger.error("Failed to invalidate attendance cache: %s. Relying on TTL expiration.", exc)
        return 0


async def invalidate_attendance_regularization_cache() -> int:
    """Invalidate attendance regularization lists and details."""
    try:
        deleted = await delete_cache_by_prefix("attendance:regularization:")
        logger.info("Invalidated %d attendance regularization cache entries.", deleted)
        return deleted
    except Exception as exc:
        logger.error("Failed to invalidate attendance regularization cache: %s. Relying on TTL expiration.", exc)
        return 0


async def invalidate_leaves_cache() -> int:
    """Invalidate admin leave summaries, lists, details, and employee leaves."""
    try:
        deleted = await delete_cache_by_prefix("leave:")
        logger.info("Invalidated %d leave cache entries.", deleted)
        return deleted
    except Exception as exc:
        logger.error("Failed to invalidate leave cache: %s. Relying on TTL expiration.", exc)
        return 0


async def invalidate_payslips_cache(payslip_id: str | None = None) -> int:
    """Invalidate admin payslip lists and details."""
    try:
        deleted = await delete_cache_by_prefix("payroll:payslips:")
        logger.info("Invalidated %d payslip cache entries.", deleted)
        return deleted
    except Exception as exc:
        logger.error("Failed to invalidate payslip cache: %s. Relying on TTL expiration.", exc)
        return 0


async def invalidate_employees_cache(employee_id: str | None = None, user_id: str | None = None) -> int:
    """Invalidate employee profiles and lists cache."""
    try:
        deleted = await delete_cache_by_prefix("employees:")
        logger.info("Invalidated %d employee cache entries.", deleted)
        return deleted
    except Exception as exc:
        logger.error("Failed to invalidate employee cache: %s. Relying on TTL expiration.", exc)
        return 0


async def invalidate_employee_leaves_cache(employee_id: str | None = None) -> int:
    """Invalidate employee self-service leave balance, history, and upcoming caches."""
    try:
        if employee_id:
            deleted = await delete_cache_by_prefix(f"leave:emp:{employee_id}:")
        else:
            deleted = await delete_cache_by_prefix("leave:emp:")
        logger.info("Invalidated %d employee leave cache entries.", deleted)
        return deleted
    except Exception as exc:
        logger.error("Failed to invalidate employee leave cache: %s. Relying on TTL expiration.", exc)
        return 0


async def invalidate_employee_payroll_cache(employee_id: str | None = None) -> int:
    """Invalidate employee self-service payroll history and payslip caches."""
    try:
        if employee_id:
            deleted = await delete_cache_by_prefix(f"payroll:emp:{employee_id}:")
        else:
            deleted = await delete_cache_by_prefix("payroll:emp:")
        logger.info("Invalidated %d employee payroll cache entries.", deleted)
        return deleted
    except Exception as exc:
        logger.error("Failed to invalidate employee payroll cache: %s. Relying on TTL expiration.", exc)
        return 0


async def invalidate_announcements_cache() -> int:
    """Invalidate all announcement feeds and details."""
    try:
        deleted = await delete_cache_by_prefix("announcements:")
        logger.info("Invalidated %d announcement cache entries.", deleted)
        return deleted
    except Exception as exc:
        logger.error("Failed to invalidate announcement cache: %s. Relying on TTL expiration.", exc)
        return 0


