import { useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./pages/login";
import ProtectedRoute from "./components/ProtectedRoute";
import Registration from "./pages/Registration";
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


function App() {
  const [activePage, setActivePage] = useState("Dashboard");

  async function handleLogout() {
    const refreshToken = getRefreshToken();

    if (refreshToken) {
      await authService.logout(refreshToken);
    } else {
      clearSession();
    }

    window.location.href = "/login";
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Registration />} />

        <Route element={<ProtectedRoute />}>
          <Route
            path="/dashboard"
            element={
              <DashboardLayout
                activePage={activePage}
                onNavigate={setActivePage}
                onLogout={handleLogout}
              />
            }
          />
          <Route
            path="/dashboard/regularization"
            element={
              <DashboardLayout
                activePage="Regularization Requests"
                onNavigate={() => undefined}
                onLogout={handleLogout}
              />
            }
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
            <Route path="announcements" element={<EmployeeAnnouncements />} />
            <Route path="help" element={<EmployeeHelpSupport />} />
          </Route>
        </Route>

        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />

        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;