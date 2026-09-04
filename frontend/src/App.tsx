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
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route
            element={<EmployeeLayout onLogout={handleLogout} />}
          >
            <Route
              path="/employee/dashboard"
              element={<EmployeeDashboard />}
            />

            <Route
              path="/employee/profile"
              element={<EmployeeProfile />}
            />

            <Route
              path="/employee/attendance"
              element={<EmployeeAttendance />}
            />

            <Route
              path="/employee/leave"
              element={<EmployeeLeave />}
            />
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
