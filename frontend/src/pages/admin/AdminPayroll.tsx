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

const summaryCards = [
  { label: "Total Employees", value: "128", note: "Active employees", icon: Users, color: "bg-blue-600" },
  { label: "Processed Payroll", value: "118", note: "92% of total employees", icon: WalletCards, color: "bg-emerald-500" },
  { label: "Pending Payroll", value: "10", note: "Needs attention", icon: ClipboardList, color: "bg-orange-500" },
  { label: "Total Payroll Amount", value: "₹ 36,45,000", note: "May 2024", icon: Landmark, color: "bg-violet-600" },
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
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${isComplete ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"}`}>
      {status}
    </span>
  );
}

function ComingSoonPanel({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-10 text-center shadow-sm">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <p className="mt-1 text-xs text-slate-400">This section is not built yet.</p>
    </div>
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
    <div className="min-h-full px-5 pb-10 pt-6 sm:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payroll Management</h1>
          <p className="mt-1 text-xs text-slate-500">Manage payroll, salary structure, deductions and generate payslips</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.color} text-white`}><Icon className="h-5 w-5" /></span>
              <div className="min-w-0"><p className="text-[10px] text-slate-500">{card.label}</p><p className="truncate text-lg font-bold text-slate-900">{card.value}</p><p className="text-[10px] text-slate-400">{card.note}</p></div>
            </div>
          );
        })}
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap gap-5 text-xs font-medium text-slate-500">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`pb-2 ${
                activeTab === tab.key
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === "overview" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Pay Period</span>
            <button className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">
              01 May 2024 - 31 May 2024 <ChevronDown className="h-3 w-3" />
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
              <Play className="h-3 w-3 fill-current" /> Run Payroll
            </button>
          </div>
        )}
      </div>

      {activeTab === "overview" && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-5">
            <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm xl:col-span-3">
              <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">Payroll Summary</h2></div>
              <div className="overflow-x-auto"><table className="min-w-[650px] w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] text-slate-500"><tr>{["Department", "Employees", "Gross Salary", "Net Salary", "Status"].map((heading) => <th key={heading} className="px-5 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-50">{departmentRows.map((row) => <tr key={row[0]}><td className="px-5 py-3 font-medium text-slate-700">{row[0]}</td><td className="px-5 py-3 text-slate-600">{row[1]}</td><td className="px-5 py-3 text-slate-600">{row[2]}</td><td className="px-5 py-3 text-slate-600">{row[3]}</td><td className="px-5 py-3"><StatusBadge status={row[4]} /></td></tr>)}</tbody></table></div>
              <p className="px-5 py-3 text-[10px] text-slate-400">Showing 1 to 5 of 5 entries</p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm xl:col-span-2">
              <h2 className="text-sm font-bold text-slate-900">Payroll Charts</h2>
              <p className="mt-1 text-[10px] text-slate-500">Total Payroll Amount (Last 6 Months)</p>
              <div className="relative mt-5 flex h-40 items-end justify-between gap-2 border-b border-l border-slate-200 px-3 pb-1 pt-3">
                {chartBars.map((bar) => (
                  <div key={bar.month} className="relative flex h-full flex-1 items-end justify-center gap-1">
                    <div className="w-3 rounded-t-sm bg-blue-500" style={{ height: `${bar.gross}%` }} />
                    <div className="w-3 rounded-t-sm bg-emerald-400" style={{ height: `${bar.net}%` }} />
                    <span className="absolute -bottom-5 text-[10px] text-slate-400">{bar.month}</span>
                  </div>
                ))}
              </div>
              <div className="mt-7 flex justify-center gap-5 text-[10px] text-slate-500">
                <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-500" />Gross Salary</span>
                <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />Net Salary</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-900">Recent Payroll Runs</h2><button className="text-[10px] text-blue-600">View All</button></div>
              <div className="space-y-3">{recentRuns.map((run) => <div key={run[0]} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 text-[10px]"><div><p className="font-semibold text-slate-700">{run[0]}</p><p className="text-slate-400">Processed on {run[1]}</p></div><span className="text-slate-500">{run[2]}</span><StatusBadge status={run[3]} /></div>)}</div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-900">Pending Items</h2><button className="text-[10px] text-blue-600">View All</button></div>
              <div className="space-y-3 text-xs">{pendingItems.map(([count, label, Icon]) => <div key={label} className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Icon className="h-3.5 w-3.5" /></span><b className="text-slate-800">{count}</b><span className="flex-1 text-[10px] text-slate-500">{label}</span><button className="rounded border border-slate-200 px-2 py-1 text-[10px] text-blue-600">View</button></div>)}</div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-slate-900">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map(([label, Icon, onClick]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-left text-[10px] font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                  >
                    <Icon className="h-4 w-4 text-blue-600" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "structure" && <SalaryStructureTab />}
      {activeTab === "deductions" && <DeductionsTab />}
      {activeTab === "payslips" && <PayslipsTab />}
      {activeTab === "reports" && <ComingSoonPanel label="Reports" />}
    </div>
  );
}