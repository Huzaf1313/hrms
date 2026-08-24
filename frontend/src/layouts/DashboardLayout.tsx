import { useEffect, useState } from "react";
import { CalendarMinus2, Check, TrendingUp, Users } from "lucide-react";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import KpiCard from "../components/KpiCard";
import HiringPipeline from "../components/HiringPipeline";
import Celebrations from "../components/Celebrations";
import Employees from "../pages/Employees";
import Attendance from "../pages/Attendance";
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

  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

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
    <div className="flex min-h-screen bg-[#f7f9f8]">
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
      />

      <main className="min-w-0 flex-1">
        <Header user={user} onLogout={onLogout} />

        {activePage === "Employees" ? (
          <Employees />
        ) : activePage === "Attendance" ? (
          <Attendance />
        ) : (
          <div className="px-10 pb-10 pt-8">
            <div className="grid grid-cols-4 gap-6">

              <KpiCard
                title="TOTAL HEADCOUNT"
                value={dashboardData ? String(dashboardData.total_headcount) : "-"}
                description={(
                  <span className="inline-flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    +12 this month
                  </span>
                )}
                icon={<Users className="h-6 w-6 text-emerald-700" />}
                iconBg="bg-green-100"
              />

              <KpiCard
                title="ATTENDANCE RATE"
                value={
                  dashboardData?.attendance_rate != null
                    ? `${dashboardData.attendance_rate}%`
                    : "-"
                }
                icon={<Check className="h-6 w-6 text-amber-700" />}
                iconBg="bg-orange-100"
              >
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-[#99543f]"
                    style={{ width: `${dashboardData?.attendance_rate ?? 0}%` }}
                  />
                </div>
              </KpiCard>

              <KpiCard
                title="ON LEAVE TODAY"
                value={dashboardData ? String(dashboardData.on_leave_today) : "-"}
                description="View details"
                icon={<CalendarMinus2 className="h-6 w-6 text-slate-700" />}
                iconBg="bg-stone-100"
              />

              <div className="row-span-2">
                <Celebrations celebrations={dashboardData?.celebrations ?? []} />
              </div>

              <div className="col-span-3">
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

            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default DashboardLayout;