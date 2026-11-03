import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./pages/login";
import ProtectedRoute, { AdminRoute } from "./components/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import EmployeeProfile from "./pages/employee/EmployeeProfile";
import EmployeeAttendance from "./pages/employee/EmployeeAttendance";
import EmployeeLeave from "./pages/employee/EmployeeLeave";
import EmployeePayroll from "./pages/employee/EmployeePayroll";
import EmployeeDocuments from "./pages/employee/EmployeeDocuments";
import EmployeeAnnouncements from "./pages/employee/EmployeeAnnouncements";
import EmployeeHelpSupport from "./pages/employee/EmployeeHelpSupport";
import { clearSession, getRefreshToken } from "./services/api";
import { authService } from "./services/authService";
import EmployeeLayout from "./layouts/EmployeeLayout";
import EmployeeExit from "./pages/employee/EmployeeExit";
import EmployeeResignation from "./pages/employee/EmployeeResignation";
import { clearAuthQueries } from "./lib/queryClient";
import { GlobalDateProvider } from "./context/GlobalDateProvider";
import EmployeeAssets from "./pages/employee/EmployeeAssets";

function App() {
  async function handleLogout() {
    const refreshToken = getRefreshToken();

    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    clearSession();
    clearAuthQueries();

    window.location.href = "/login";
  }

  return (
    <BrowserRouter>
      {/* Above the routes so one header date serves the admin and employee
          shells, and survives navigating between them. */}
      <GlobalDateProvider>
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
      </GlobalDateProvider>
    </BrowserRouter>
  );
}

export default App;
