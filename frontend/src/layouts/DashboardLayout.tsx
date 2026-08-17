import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import KpiCard from "../components/KpiCard";
import HiringPipeline from "../components/HiringPipeline";
import Celebrations from "../components/Celebrations";
import Employees from "../pages/Employees";

interface DashboardLayoutProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

function DashboardLayout({
  activePage,
  onNavigate,
}: DashboardLayoutProps) {
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
            <div className="grid grid-cols-4 gap-6">

              <KpiCard
                title="TOTAL HEADCOUNT"
                value="1,248"
                description="↗ +12 this month"
                icon="♟"
                iconBg="bg-green-100"
              />

              <KpiCard
                title="ATTENDANCE RATE"
                value="96%"
                icon="✓"
                iconBg="bg-orange-100"
              >
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full w-[96%] rounded-full bg-[#99543f]" />
                </div>
              </KpiCard>

              <KpiCard
                title="ON LEAVE TODAY"
                value="34"
                description="View details →"
                icon="▣"
                iconBg="bg-stone-100"
              />

              <div className="row-span-2">
                <Celebrations />
              </div>

              <div className="col-span-3">
                <HiringPipeline />
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default DashboardLayout;