import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import KpiCard from "../components/KpiCard";
import HiringPipeline from "../components/HiringPipeline";
import Celebrations from "../components/Celebrations";

function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-[#f7f9f8]">
      
      {/* Sidebar */}
      <Sidebar />

      {/* Main Dashboard */}
      <main className="min-w-0 flex-1">
        
        {/* Header */}
        <Header />

        {/* Dashboard Content */}
        <div className="px-9 pb-10">

          {/* Main Dashboard Grid */}
          <section className="grid grid-cols-4 gap-7">

            {/* KPI 1 */}
            <KpiCard
              title="TOTAL HEADCOUNT"
              value="1,248"
              description="↗ +12 this month"
              icon="♟"
              iconBg="bg-green-100"
            />

            {/* KPI 2 */}
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

            {/* KPI 3 */}
            <KpiCard
              title="ON LEAVE TODAY"
              value="34"
              description="View details →"
              icon="▣"
              iconBg="bg-stone-100"
            />

            {/* Celebrations */}
            <div className="row-span-2">
              <Celebrations />
            </div>

            {/* Hiring Pipeline */}
            <div className="col-span-3">
              <HiringPipeline />
            </div>

          </section>

        </div>
      </main>
    </div>
  );
}

export default DashboardLayout;