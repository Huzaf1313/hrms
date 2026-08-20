import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/login";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardPage from "./pages/DashboardPage";
import Registration from "./pages/Registration";

// TODO: auth is temporarily disabled while employee CRUD is being built.
// The backend's /employees endpoints currently bypass permission checks too
// (see AUTH_ENABLED in backend/app/api/v1/employees.py). To restore the
// login flow: bring back the isAuthenticated gate + <Login /> here, flip
// AUTH_ENABLED back to True on the backend, and set isAuthenticated from
// Boolean(getAccessToken()) again.
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Registration />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
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