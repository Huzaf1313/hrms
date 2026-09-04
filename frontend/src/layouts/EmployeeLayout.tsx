import { Outlet } from "react-router-dom";
import EmployeeSidebar from "../pages/employee/EmployeeSidebar";

interface EmployeeLayoutProps {
  onLogout: () => void;
}

function EmployeeLayout({ onLogout }: EmployeeLayoutProps) {
  return (
    <div className="flex min-h-screen bg-[#f5f7fb]">
      <EmployeeSidebar onLogout={onLogout} />

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export default EmployeeLayout;