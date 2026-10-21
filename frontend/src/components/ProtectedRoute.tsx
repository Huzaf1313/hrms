import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getAccessToken } from "../services/api";

const ADMIN_ROLES = ["hr_admin", "manager"];

function readRole(): string | null {
  try {
    const raw = localStorage.getItem("user");

    if (!raw) return null;

    return (JSON.parse(raw) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

/** Requires a valid session. */
function ProtectedRoute() {
  const accessToken = getAccessToken();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

/**
 * Requires a valid session belonging to an admin-level account.
 *
 * Without this, an employee could browse the admin portal and the
 * Announcement admin list, which is not audience filtered.
 */
export function AdminRoute() {
  const location = useLocation();
  const accessToken = getAccessToken();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (!ADMIN_ROLES.includes(readRole() ?? "")) {
    return <Navigate to="/employee" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
