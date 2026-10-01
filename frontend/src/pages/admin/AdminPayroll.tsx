import { useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileText,
  Landmark,
  Play,
  Settings2,
  Users,
  WalletCards,
} from "lucide-react";
import SalaryStructureTab from "../../components/admin/SalaryStructureTab";
import DeductionsTab from "../../components/admin/DeductionsTab";
import PayslipsTab from "../../components/admin/PayslipsTab";
import Reports from "../../components/admin/Reports";

const summaryCards = [
  { label: "Total Employees", value: "128", note: "Active employees", icon: Users, iconBg: "bg-blue-500" },
  { label: "Processed Payroll", value: "118", note: "92% of total employees", icon: WalletCards, iconBg: "bg-emerald-500" },
  { label: "Pending Payroll", value: "10", note: "Needs attention", icon: ClipboardList, iconBg: "bg-orange-500" },
  { label: "Total Payroll Amount", value: "₹ 36,45,000", note: "May 2024", icon: Landmark, iconBg: "bg-violet-600" },
];

const departmentRows = [
  ["Engineering", "45", "₹ 15,20,000", "₹ 13,45,000", "Completed"],
  ["HR", "8", "₹ 2,70,000", "₹ 2,45,000", "Completed"],
  ["Sales", "32", "₹ 10,80,000", "₹ 9,50,000", "Completed"],
  ["Marketing", "15", "₹ 5,10,000", "₹ 4,60,000", "Pending"],
  ["Finance", "12", "₹ 4,20,000", "₹ 3,80,000", "Pending"],
];

const recentRuns = [
  ["May 2024", "25 May 2024", "118/128", "Completed"],
  ["April 2024", "25 Apr 2024", "120/128", "Completed"],
  ["Mar 2024", "25 Mar 2024", "120/128", "Completed"],
  ["Feb 2024", "26 Feb 2024", "118/128", "Completed"],
];

const chartBars = [
  { month: "Dec", gross: 62, net: 49 },
  { month: "Jan", gross: 60, net: 52 },
  { month: "Feb", gross: 65, net: 56 },
  { month: "Mar", gross: 70, net: 59 },
  { month: "Apr", gross: 74, net: 62 },
  { month: "May", gross: 78, net: 67 },
];

const pendingItems: Array<[string, string, typeof Users]> = [
  ["10", "Employees - Pending Payroll", Users],
  ["2", "New Joiners - Add to Payroll", Users],
  ["3", "Employee Updates - Pending", ClipboardList],
];

type TabKey = "overview" | "structure" | "deductions" | "payslips" | "reports";

const tabs: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Payroll Overview" },
  { key: "structure", label: "Salary Structure" },
  { key: "deductions", label: "Deductions & Contributions" },
  { key: "payslips", label: "Payslips" },
  { key: "reports", label: "Reports" },
];

function StatusBadge({ status }: { status: string }) {
  const isComplete = status === "Completed";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
        isComplete ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
      }`}
    >
      {status}
    </span>
  );
}

/** Bar chart styled to match the line/area charts on the Leave page. */
function PayrollChart() {
  const width = 720;
  const height = 220;
  const paddingLeft = 32;
  const paddingBottom = 24;
  const maxY = 100;
  const gridValues = [0, 25, 50, 75, 100];
  const slot = (width - paddingLeft) / chartBars.length;
  const barWidth = 13;
  const baseline = height - paddingBottom;

  const yFor = (value: number) => baseline - (value / maxY) * baseline;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 240 }}>
      {gridValues.map((value) => (
        <g key={value}>
          <line
            x1={paddingLeft}
            x2={width}
            y1={yFor(value)}
            y2={yFor(value)}
            stroke="#f1f5f4"
            strokeWidth={1}
          />
          <text x={0} y={yFor(value) + 4} fontSize={11} fill="#9ca3af">
            {value}
          </text>
        </g>
      ))}

      {chartBars.map((bar, index) => {
        const center = paddingLeft + slot * index + slot / 2;

        return (
          <g key={bar.month}>
            <rect
              x={center - barWidth - 2}
              y={yFor(bar.gross)}
              width={barWidth}
              height={baseline - yFor(bar.gross)}
              rx={3}
              fill="#2563eb"
            />
            <rect
              x={center + 2}
              y={yFor(bar.net)}
              width={barWidth}
              height={baseline - yFor(bar.net)}
              rx={3}
              fill="#10b981"
            />
            <text
              x={center}
              y={height - 4}
              fontSize={11}
              fill="#9ca3af"
              textAnchor="middle"
            >
              {bar.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function AdminPayroll() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const quickActions: Array<[string, typeof Settings2, () => void]> = [
    ["Add Salary Structure", Settings2, () => setActiveTab("structure")],
    ["Manage Deductions", CalendarDays, () => setActiveTab("deductions")],
    ["Generate Payslip", FileText, () => setActiveTab("payslips")],
    ["Payroll Reports", BarChart3, () => setActiveTab("reports")],
  ];

  return (
    <div className="px-10 pb-10 pt-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Payroll Management</h1>
          <p className="mt-1 text-gray-500">
            Manage payroll, salary structure, deductions and generate payslips.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <div key={card.label} className="rounded-3xl bg-white p-5 shadow-sm">
              <div
                className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}
              >
                <Icon className="h-5 w-5 text-white" />
              </div>

              <p className="text-sm font-bold text-black">{card.label}</p>
              <div className="mt-1 text-2xl font-bold text-gray-900">{card.value}</div>
              <p className="mt-1 text-xs text-gray-400">{card.note}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs + run controls */}
      <div className="mb-6 rounded-3xl bg-white px-6 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-6 border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition ${
                  activeTab === tab.key
                    ? "border-[#2563eb] text-[#2563eb]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Pay Period</span>

              <button
                type="button"
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
              >
                01 May 2024 - 31 May 2024 <ChevronDown className="h-3 w-3" />
              </button>

              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
              >
                <Play className="h-3.5 w-3.5 fill-current" /> Run Payroll
              </button>
            </div>
          )}
        </div>
      </div>

      {activeTab === "overview" && (
        <>
          {/* Chart + Quick actions */}
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="min-w-0 rounded-3xl bg-white p-6 shadow-sm lg:col-span-3">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-900">Payroll Charts</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Total Payroll Amount (Last 6 Months)
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#2563eb]" /> Gross Salary
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" /> Net Salary
                  </span>
                </div>
              </div>

              <PayrollChart />
            </div>

            <div className="min-w-0 rounded-3xl bg-white p-6 shadow-sm lg:col-span-2">
              <h3 className="mb-4 font-bold text-gray-900">Quick Actions</h3>

              <div className="grid grid-cols-2 gap-3">
                {quickActions.map(([label, Icon, onClick]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    className="rounded-2xl border border-gray-100 p-4 text-left transition hover:bg-gray-50"
                  >
                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                      <Icon className="h-4 w-4 text-[#2563eb]" />
                    </div>

                    <p className="text-xs font-medium text-gray-700">{label}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Recent runs + pending items */}
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="min-w-0 rounded-3xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Recent Payroll Runs</h3>
                <button
                  type="button"
                  className="text-xs font-semibold text-[#2563eb] hover:underline"
                >
                  View All
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {recentRuns.map((run) => (
                  <div
                    key={run[0]}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{run[0]}</p>
                      <p className="text-xs text-gray-400">Processed on {run[1]}</p>
                    </div>

                    <span className="text-sm text-gray-500">{run[2]}</span>
                    <StatusBadge status={run[3]} />
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0 rounded-3xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Pending Items</h3>
                <button
                  type="button"
                  className="text-xs font-semibold text-[#2563eb] hover:underline"
                >
                  View All
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {pendingItems.map(([count, label, Icon]) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-2xl border border-gray-100 p-4"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                      <Icon className="h-4 w-4 text-[#2563eb]" />
                    </div>

                    <span className="text-lg font-bold text-gray-900">{count}</span>
                    <span className="flex-1 text-sm text-gray-500">{label}</span>

                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Department summary table */}
          <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-gray-900">Payroll Summary by Department</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <th className="pb-3">Department</th>
                    <th className="pb-3">Employees</th>
                    <th className="pb-3">Gross Salary</th>
                    <th className="pb-3">Net Salary</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {departmentRows.map((row) => (
                    <tr key={row[0]} className="border-b border-gray-50 last:border-0">
                      <td className="py-4 font-semibold text-gray-900">{row[0]}</td>
                      <td className="py-4 text-gray-600">{row[1]}</td>
                      <td className="py-4 text-gray-600">{row[2]}</td>
                      <td className="py-4 text-gray-600">{row[3]}</td>
                      <td className="py-4">
                        <StatusBadge status={row[4]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
              <span>Showing 1 to {departmentRows.length} of {departmentRows.length} entries</span>
            </div>
          </div>
        </>
      )}

      {activeTab === "structure" && <SalaryStructureTab />}
      {activeTab === "deductions" && <DeductionsTab />}
      {activeTab === "payslips" && <PayslipsTab />}
      {activeTab === "reports" && <Reports />}
    </div>
  );
}
