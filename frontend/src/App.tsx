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
import EmployeeLayout from "./layouts/EmployeeLayout";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import EmployeeProfile from "./pages/employee/EmployeeProfile";
import EmployeeAttendance from "./pages/employee/EmployeeAttendance";

import { clearSession, getRefreshToken } from "./services/api";
import { authService } from "./services/authService";

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
