import { useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";

function DashboardPage() {
  const [activePage, setActivePage] = useState("Dashboard");

  return (
    <DashboardLayout
      activePage={activePage}
      onNavigate={setActivePage}
    />
  );
}

export default DashboardPage;