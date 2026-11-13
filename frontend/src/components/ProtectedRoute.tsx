import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { isAdminRole } from "../lib/access";
import { hasSessionHint, isSessionConfirmed, restoreSession } from "../services/api";

type SessionState = "checking" | "signed-in" | "signed-out";

/**
 * The session lives in HttpOnly cookies that scripts cannot see, so after a
 * page reload this tab does not know whether it is still signed in. When
 * this browser has signed in before, check with the server (refreshing the
 * access cookie if it expired) before deciding to send the user to login.
 */
function useSession(): SessionState {
  const [state, setState] = useState<SessionState>(() =>
    isSessionConfirmed() ? "signed-in" : hasSessionHint() ? "checking" : "signed-out",
  );

  useEffect(() => {
    if (state !== "checking") return;

    let active = true;

    void restoreSession().then((restored) => {
      if (active) setState(restored ? "signed-in" : "signed-out");
    });

    return () => {
      active = false;
    };
  }, [state]);

  return state;
}

/** Requires a valid session. */
function ProtectedRoute() {
  const session = useSession();

  if (session === "checking") return null;

  if (session === "signed-out") {
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
  const session = useSession();

  if (session === "checking") return null;

  if (session === "signed-out") {
    return <Navigate to="/login" replace />;
  }

  if (!isAdminRole()) {
    return <Navigate to="/employee" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
