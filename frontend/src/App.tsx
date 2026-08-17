import { useState } from "react";

import DashboardLayout from "./layouts/DashboardLayout";

function App() {
  const [activePage, setActivePage] = useState("Dashboard");

  return (
    <DashboardLayout
      activePage={activePage}
      onNavigate={setActivePage}
    />
  );
}

export default App;
