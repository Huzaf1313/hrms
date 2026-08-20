import { useState } from "react";

import DashboardLayout from "./layouts/DashboardLayout";
import { clearSession, getRefreshToken } from "./services/api";
import { authService } from "./services/authService";

// TODO: auth is temporarily disabled while employee CRUD is being built.
// The backend's /employees endpoints currently bypass permission checks too
// (see AUTH_ENABLED in backend/app/api/v1/employees.py). To restore the
// login flow: bring back the isAuthenticated gate + <Login /> here, flip
// AUTH_ENABLED back to True on the backend, and set isAuthenticated from
// Boolean(getAccessToken()) again.
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
    <DashboardLayout
      activePage={activePage}
      onNavigate={setActivePage}
      onLogout={handleLogout}
    />
  );
}

export default App;
