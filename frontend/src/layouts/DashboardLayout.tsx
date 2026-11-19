import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import ErrorBoundary from "../components/ErrorBoundary";
import { AdminDashboard, getDashboardData, type DashboardData } from "../modules/dashboard";
import { AdminEmployees, AdminMyProfile, AdminAccounts } from "../modules/employees";
import { AdminAttendance, AdminRegularizationRequests } from "../modules/attendance";
import { AdminLeave } from "../modules/leaves";
import { AdminPayroll } from "../modules/payroll";
import { AdminAssets } from "../modules/assets";
import { AdminAnnouncements } from "../modules/announcements";
import { AdminSettings } from "../modules/settings";
import { AdminRecruitment } from "../modules/recruitment";
import { AdminExitRequests } from "../modules/exit";
import { AdminSupportTickets } from "../modules/support";
import { canAccessPage } from "../lib/access";

interface DashboardLayoutProps {
  onLogout: () => void;
}

const pagePaths: Record<string, string> = {
  Dashboard: "/dashboard",
  Employees: "/dashboard/employees",
  Recruitment: "/dashboard/recruitment",
  Attendance: "/dashboard/attendance",
  Leave: "/dashboard/leave",
  Payroll: "/dashboard/payroll",
  Assets: "/dashboard/assets",
  Announcement: "/dashboard/announcements",
  "Exit Requests": "/dashboard/exit-requests",
  "Support Tickets": "/dashboard/support-tickets",
  Settings: "/dashboard/settings",
  "My Profile": "/dashboard/profile",
  // Super admin only: for anyone else canAccessPage falls back to Dashboard.
  "Admin Accounts": "/dashboard/admin-accounts",
};

function pageFromPath(pathname: string): string {
  if (pathname === "/dashboard/regularization") return "Attendance";
  return Object.entries(pagePaths).find(([, path]) => path === pathname)?.[0] ?? "Dashboard";
}

function DashboardLayout({
  onLogout,
}: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const page = pageFromPath(location.pathname);

  // A manager who types an HR-only URL lands on their dashboard instead. The
  // backend would 403 anyway; this just avoids a dead page.
  const activePage = canAccessPage(page) ? page : "Dashboard";

  // Standalone full-page list opened from the "View All" on the attendance
  // page's regularization card. It is not a sidebar destination, so the
  // sidebar keeps Attendance highlighted while this list is showing.
  const isRegularizationPage = location.pathname === "/dashboard/regularization";

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [openEmployeeFormOnMount, setOpenEmployeeFormOnMount] = useState(false);
  const [openAnnouncementFormOnMount, setOpenAnnouncementFormOnMount] =
    useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [employeeSearchRequest, setEmployeeSearchRequest] = useState<{
    query: string;
    requestId: number;
  } | undefined>(undefined);
  const [employeeSelectionRequest, setEmployeeSelectionRequest] = useState<{
    employeeId: string;
    requestId: number;
  } | undefined>(undefined);

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

    navigate(pagePaths[page] ?? "/dashboard");
    setSidebarOpen(false);
  }

  function handleSearchEmployee(query: string) {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) return;

    setOpenEmployeeFormOnMount(false);

    setEmployeeSearchRequest((current) => ({
      query: trimmedQuery,
      requestId: (current?.requestId ?? 0) + 1,
    }));

    handleNavigate("Employees");
  }

  function handleCreateEmployee() {
    setOpenEmployeeFormOnMount(true);
    handleNavigate("Employees");
  }

  function handleCreateAnnouncement() {
    setOpenAnnouncementFormOnMount(true);
    handleNavigate("Announcement");
  }

  function handleSelectEmployee(employeeId: string) {
    setOpenEmployeeFormOnMount(false);

    setEmployeeSelectionRequest((current) => ({
      employeeId,
      requestId: (current?.requestId ?? 0) + 1,
    }));

    handleNavigate("Employees");
  }

  useEffect(() => {
    let isMounted = true;

    const loadDashboardData = () =>
      getDashboardData()
        .then((data) => {
          if (isMounted) {
            setDashboardData(data);
          }
        })
        .catch((error) => {
          console.error("Failed to load dashboard data", error);
        });

    void loadDashboardData();
    const interval = window.setInterval(loadDashboardData, 30_000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-[#f5f7fb]">
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="min-w-0 flex-1">
        <Header
          onLogout={onLogout}
          pageTitle={isRegularizationPage ? "Regularization Requests" : activePage}
          collapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((previous) => !previous)}
          onOpenSidebar={() => setSidebarOpen(true)}
          onSearchEmployee={handleSearchEmployee}
          onSelectEmployee={handleSelectEmployee}
        />

        {/* Scoped so a crash in one admin page leaves the sidebar and header
            usable, instead of blanking the whole screen. */}
        <ErrorBoundary label={isRegularizationPage ? "Regularization Requests" : activePage}>
          {isRegularizationPage ? (
          <AdminRegularizationRequests />
        ) : activePage === "Employees" ? (
          <AdminEmployees
            autoOpenCreateForm={openEmployeeFormOnMount}
            employeeSearchRequest={employeeSearchRequest}
            employeeSelectionRequest={employeeSelectionRequest}
          />
        ) : activePage === "Recruitment" ? (
          <AdminRecruitment />
        ) : activePage === "Attendance" ? (
          <AdminAttendance />
        ) : activePage === "Leave" ? (
          <AdminLeave />
        ) : activePage === "Payroll" ? (
          <AdminPayroll />
        ) : activePage === "Assets" ? (
          <AdminAssets />
        ) : activePage === "Announcement" ? (
          <AdminAnnouncements
            onCreateEmployee={handleCreateEmployee}
            autoOpenCreateForm={openAnnouncementFormOnMount}
          />
        ) : activePage === "Exit Requests" ? (
          <AdminExitRequests />
        ) : activePage === "Support Tickets" ? (
          <AdminSupportTickets />
        ) : activePage === "Settings" ? (
          <AdminSettings />
        ) : activePage === "My Profile" ? (
          <AdminMyProfile />
        ) : activePage === "Admin Accounts" ? (
          <AdminAccounts />
        ) : (
          <AdminDashboard
            totalHeadcount={dashboardData?.total_headcount ?? null}
            celebrations={dashboardData?.celebrations ?? []}
            recentActivities={dashboardData?.recent_activities ?? []}
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
