import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import { clearSession } from "../services/api";

function DashboardPage() {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState("Dashboard");

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <DashboardLayout
      activePage={activePage}
      onNavigate={setActivePage}
      onLogout={handleLogout}
    />
  );
}

export default DashboardPage;