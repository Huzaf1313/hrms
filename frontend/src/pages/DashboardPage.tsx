import { useNavigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import { clearSession } from "../services/api";

function DashboardPage() {
  const navigate = useNavigate();
  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <DashboardLayout onLogout={handleLogout} />
  );
}

export default DashboardPage;
