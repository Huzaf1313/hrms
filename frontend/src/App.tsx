import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { Login } from "./modules/auth";
import ProtectedRoute, { AdminRoute } from "./components/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";
import { EmployeeDashboard } from "./modules/dashboard";
import { EmployeeProfile, EmployeeDocuments } from "./modules/employees";
import { EmployeeAttendance } from "./modules/attendance";
import { EmployeeLeave } from "./modules/leaves";
import { EmployeePayroll } from "./modules/payroll";
import { EmployeeAnnouncements } from "./modules/announcements";
import { EmployeeHelpSupport } from "./modules/support";
import { clearSession, setOnSessionClear } from "./services/api";
import { clearPendingPasswordRedirect } from "./lib/session";
import { authService } from "./modules/auth";
import EmployeeLayout from "./layouts/EmployeeLayout";
import { EmployeeExit, EmployeeResignation } from "./modules/exit";
import { clearAuthQueries } from "./lib/queryClient";
import { GlobalDateProvider } from "./context/GlobalDateProvider";
import { EmployeeAssets } from "./modules/assets";
import { ToastProvider } from "./components/ui/Toast";

// Send the browser back to the login page whenever the session is cleared
// from under it (e.g. the password was changed on another device and the
// stored token was revoked server-side). Manual logouts already land on
// /login, so this stays consistent with that flow.
setOnSessionClear(() => {
  if (!window.location.pathname.startsWith("/login")) {
    const wasPasswordChange =
      sessionStorage.getItem("hrms_login_notice") === "password_changed";

    if (wasPasswordChange) {
      // Preserve the notice - login.tsx consumes it on the login page.
      window.location.href = "/login";
    } else {
      // Drop any stale notice so a generic expiry redirect is not
      // mislabelled as "password changed".
      clearPendingPasswordRedirect();
      window.location.href = "/login?reason=session_expired";
    }
  }
});

function App() {
  async function handleLogout() {
    // Only the server can clear the HttpOnly session cookies, so logout is
    // always a request; it reads the refresh cookie itself.
    await authService.logout();
    clearSession();
    clearAuthQueries();

    window.location.href = "/login";
  }

  return (
    <BrowserRouter>
      {/* Above the routes so one header date serves the admin and employee
          shells, and survives navigating between them. */}
      <GlobalDateProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<AdminRoute />}>
              <Route
                path="/dashboard/*"
                element={<DashboardLayout onLogout={handleLogout} />}
              />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route
                path="/employee"
                element={<EmployeeLayout onLogout={handleLogout} />}
              >
                <Route index element={<EmployeeDashboard />} />
                <Route path="dashboard" element={<EmployeeDashboard />} />
                <Route path="profile" element={<EmployeeProfile />} />
                <Route path="attendance" element={<EmployeeAttendance />} />
                <Route path="leave" element={<EmployeeLeave />} />
                <Route path="payroll" element={<EmployeePayroll />} />
                <Route path="documents" element={<EmployeeDocuments />} />
                <Route path="assets" element={<EmployeeAssets />} />
                <Route
                  path="announcements"
                  element={<EmployeeAnnouncements />}
                />
                <Route path="help" element={<EmployeeHelpSupport />} />
                <Route path="exit" element={<EmployeeExit />} />
                <Route
                  path="exit/resignation"
                  element={<EmployeeResignation />}
                />
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/login" replace />} />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ToastProvider>
      </GlobalDateProvider>
    </BrowserRouter>
  );
}

export default App;
