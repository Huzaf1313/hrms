import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/login";
import ProtectedRoute from "./components/ProtectedRoute";
import Registration from "./pages/Registration";
import DashboardLayout from "./layouts/DashboardLayout";

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