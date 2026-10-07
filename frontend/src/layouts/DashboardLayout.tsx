import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import ErrorBoundary from "../components/ErrorBoundary";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminEmployees from "../pages/admin/AdminEmployees";
import AdminAttendance from "../pages/admin/AdminAttendance";
import AdminLeave from "../pages/admin/admin_leave";
import AdminRegularizationRequests from "../pages/admin/AdminRegularizationRequests";
import AdminPayroll from "../pages/admin/AdminPayroll";
import AdminAssets from "../pages/admin/AdminAssets";
import AdminAnnouncements from "../pages/admin/AdminAnnouncements";
import AdminSettings from "../pages/admin/AdminSetting";
import AdminRecruitment from "../pages/admin/AdminRecruitment";
import { getDashboardData, type DashboardData } from "../services/dashboardService";

interface DashboardLayoutProps {
  activePage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

function DashboardLayout({
  activePage,
  onNavigate,
  onLogout,
}: DashboardLayoutProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [openEmployeeFormOnMount, setOpenEmployeeFormOnMount] = useState(false);
  const [openAnnouncementFormOnMount, setOpenAnnouncementFormOnMount] =
    useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  function handleNavigate(page: string) {
    // Consume the "create employee" intent so it only applies to the very
    // next mount of the Employees page.
    if (page !== "Employees") {
      setOpenEmployeeFormOnMount(false);
    }

    // Same for the announcement form shortcut from the dashboard.
    if (page !== "Announcement") {
      setOpenAnnouncementFormOnMount(false);
    }

    onNavigate(page);
  }

  function handleCreateEmployee() {
    setOpenEmployeeFormOnMount(true);
    onNavigate("Employees");
  }

  function handleCreateAnnouncement() {
    setOpenAnnouncementFormOnMount(true);
    onNavigate("Announcement");
  }

  useEffect(() => {
    let isMounted = true;

    getDashboardData()
      .then((data) => {
        if (isMounted) {
          setDashboardData(data);
        }
      })
      .catch((error) => {
        console.error("Failed to load dashboard data", error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-[#f5f7fb]">
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
      />

      <main className="min-w-0 flex-1">
        <Header
          onLogout={onLogout}
          pageTitle={activePage}
          collapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((previous) => !previous)}
        />

        {/* Scoped so a crash in one admin page leaves the sidebar and header
            usable, instead of blanking the whole screen. */}
        <ErrorBoundary label={activePage}>
          {activePage === "Employees" ? (
          <AdminEmployees autoOpenCreateForm={openEmployeeFormOnMount} />
        ) : activePage === "Attendance" ? (
          <AdminAttendance />
        ) : activePage === "Leave" ? (
          <AdminLeave />
        ) : activePage === "Regularization Requests" ? (
          <AdminRegularizationRequests />
        ) : activePage === "Payroll" ? (
          <AdminPayroll />
        ) : activePage === "Assets" ? (
          <AdminAssets />
        ) : activePage === "Announcement" ? (
          <AdminAnnouncements
            onCreateEmployee={handleCreateEmployee}
            autoOpenCreateForm={openAnnouncementFormOnMount}
          />
        ) : activePage === "Settings" ? (
          <AdminSettings />
        ) : (
          <AdminDashboard
            totalHeadcount={dashboardData?.total_headcount ?? null}
            celebrations={dashboardData?.celebrations ?? []}
            onNavigate={handleNavigate}
            onCreateAnnouncement={handleCreateAnnouncement}
          />
        )}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default DashboardLayout;
