import { Navigate, Outlet, useLocation } from "react-router-dom";

import { isAdminRole } from "../lib/access";
import { getAccessToken } from "../services/api";

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

  if (!isAdminRole()) {
    return <Navigate to="/employee" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;