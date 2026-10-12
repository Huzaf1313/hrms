import { useEffect, useState } from "react";
import { CalendarMinus2, Users } from "lucide-react";

import CelebrationTicker from "../components/CelebrationTicker";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import ErrorBoundary from "../components/ErrorBoundary";
import HiringPipeline from "../components/HiringPipeline";
import Celebrations from "../components/Celebrations";
import AdminEmployees from "../pages/admin/AdminEmployees";
import AdminAttendance from "../pages/admin/AdminAttendance";
import AdminLeave from "../pages/admin/admin_leave";
import AdminRegularizationRequests from "../pages/admin/AdminRegularizationRequests";
import AdminPayroll from "../pages/admin/AdminPayroll";
import AdminAnnouncements from "../pages/admin/AdminAnnouncements";
import AdminSettings from "../pages/admin/AdminSetting";
import { getDashboardData, type DashboardData } from "../services/dashboardService";
import AdminExitRequests from "../pages/admin/AdminExitrequests";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  function handleNavigate(page: string) {
    // Consume the "create employee" intent so it only applies to the very
    // next mount of the Employees page.
    if (page !== "Employees") {
      setOpenEmployeeFormOnMount(false);
    }

    onNavigate(page);
  }

  function handleCreateEmployee() {
    setOpenEmployeeFormOnMount(true);
    onNavigate("Employees");
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
                ) : activePage === "Announcement" ? (
          <AdminAnnouncements onCreateEmployee={handleCreateEmployee} />
        ) : activePage === "Exit Requests" ? (
          <AdminExitRequests />
        ) : activePage === "Settings" ? (
          <AdminSettings />
        ) : (
          <div className="px-8 pb-10 pt-8">
            {/* Scrolling Celebration Announcement */}
           <CelebrationTicker />
            {/* Page heading */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="mt-1 text-gray-500">
                Overview of your organization's workforce today.
              </p>
            </div>

            {/* KPI cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-4 rounded-2xl bg-[#eff6ff] p-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#2563eb] shadow-sm">
                  <Users className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm text-gray-600">Total Headcount</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {dashboardData ? String(dashboardData.total_headcount) : "—"}
                  </p>
                  <p className="text-xs font-medium text-[#2563eb]">
                    ↗ +12 this month
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-[#ecfdf5] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm text-gray-600">Attendance Rate</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData?.attendance_rate != null
                    ? `${dashboardData.attendance_rate}%`
                    : "—"}
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/80">
                  <div
                    className="h-full rounded-full bg-[#10b981]"
                    style={{ width: `${dashboardData?.attendance_rate ?? 0}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-[#f5f3ff] p-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#7c3aed] shadow-sm">
                  <CalendarMinus2 className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm text-gray-600">On Leave Today</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {dashboardData ? String(dashboardData.on_leave_today) : "—"}
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate("Leave")}
                    className="cursor-pointer text-xs font-medium text-[#2563eb] hover:underline"
                  >
                    View details →
                  </button>
                </div>
              </div>

              <Celebrations celebrations={dashboardData?.celebrations ?? []} />
            </div>

            <HiringPipeline
              pipeline={
                dashboardData?.hiring_pipeline ?? {
                  applied: 0,
                  screened: 0,
                  interview: 0,
                  offered: 0,
                }
              }
            />
          </div>
        )}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default DashboardLayout;
