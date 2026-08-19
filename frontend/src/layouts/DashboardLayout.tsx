import { useEffect, useState } from "react";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import KpiCard from "../components/KpiCard";
import HiringPipeline from "../components/HiringPipeline";
import Celebrations from "../components/Celebrations";
import Employees from "../pages/Employees";

import {
  getDashboardData,
  type DashboardData,
} from "../services/dashboardService";

interface DashboardLayoutProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

function DashboardLayout({
  activePage,
  onNavigate,
}: DashboardLayoutProps) {
  const [dashboardData, setDashboardData] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);

        const data = await getDashboardData();

        setDashboardData(data);
      } catch (error) {
        console.error("Failed to load dashboard:", error);

        setError("Unable to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }

    if (activePage === "Dashboard") {
      loadDashboard();
    }
  }, [activePage]);

  return (
    <div className="flex min-h-screen bg-[#f7f9f8]">
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
      />

      <main className="min-w-0 flex-1">
        <Header />

        {activePage === "Employees" ? (
          <Employees />
        ) : (
          <div className="px-10 pb-10 pt-8">

            {/* Page heading */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-[#456b54]">
                Dashboard
              </h1>

              <p className="mt-2 text-gray-600">
                Overview of your HR operations.
              </p>
            </div>

            {/* Loading */}
            {loading && (
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-gray-500">
                  Loading dashboard data...
                </p>
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="font-medium text-red-600">
                  {error}
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  Please make sure the backend server is running.
                </p>
              </div>
            )}

            {/* Dashboard */}
            {!loading && !error && dashboardData && (
              <div className="grid grid-cols-4 gap-6">

                {/* KPI 1 — Total Headcount */}
                <KpiCard
                  title="TOTAL HEADCOUNT"
                  value={String(
                    dashboardData.total_headcount ?? 0
                  )}
                  icon="♟"
                  iconBg="bg-green-100"
                />

                {/* KPI 2 — Attendance */}
                <KpiCard
                  title="ATTENDANCE RATE"
                  value={
                    dashboardData.attendance_rate !== null
                      ? `${dashboardData.attendance_rate}%`
                      : "—"
                  }
                  icon="✓"
                  iconBg="bg-orange-100"
                >
                  {dashboardData.attendance_rate !== null ? (
                    <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-[#99543f]"
                        style={{
                          width: `${Math.min(
                            Math.max(
                              dashboardData.attendance_rate,
                              0,
                            ),
                            100,
                          )}%`,
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No attendance data available
                    </p>
                  )}
                </KpiCard>

                {/* KPI 3 — On Leave */}
                <KpiCard
                  title="ON LEAVE TODAY"
                  value={String(
                    dashboardData.on_leave_today ?? 0
                  )}
                  description={
                    dashboardData.on_leave_today > 0
                      ? "View details →"
                      : "No employees on leave"
                  }
                  icon="▣"
                  iconBg="bg-stone-100"
                />

                {/* Celebrations */}
                <div className="row-span-2">
                  <Celebrations
                    celebrations={dashboardData.celebrations}
                  />
                </div>

                {/* Hiring Pipeline */}
                <div className="col-span-3">
                  <HiringPipeline
                    pipeline={dashboardData.hiring_pipeline}
                  />
                </div>

              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}

export default DashboardLayout;