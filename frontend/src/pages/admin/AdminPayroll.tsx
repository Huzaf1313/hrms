import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileText,
  Landmark,
  Loader2,
  RefreshCw,
  Settings2,
  Users,
  WalletCards,
} from "lucide-react";
import SalaryStructureTab from "../../components/admin/SalaryStructureTab";
import DeductionsTab from "../../components/admin/DeductionsTab";
import PayslipsTab from "../../components/admin/PayslipsTab";
import Reports from "../../components/admin/Reports";
import {
  adminPayrollService,
  type MonthlyPayrollItem,
  type PayrollAnalyticsData,
} from "../../services/adminPayrollService";

type TabKey = "overview" | "structure" | "deductions" | "payslips" | "reports";

const tabs: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Payroll Overview" },
  { key: "structure", label: "Salary Structure" },
  { key: "deductions", label: "Deductions & Contributions" },
  { key: "payslips", label: "Payslips" },
  { key: "reports", label: "Reports" },
];

function formatCurrency(amount: number): string {
  return `₹ ${Math.round(amount).toLocaleString("en-IN")}`;
}

function formatAxisValue(value: number): string {
  if (value === 0) return "0";
  if (value >= 10000000) {
    return `${(value / 10000000).toFixed(1).replace(/\.0$/, "")}Cr`;
  }
  if (value >= 100000) {
    return `${(value / 100000).toFixed(1).replace(/\.0$/, "")}L`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return value.toString();
}

function calculateMaxY(value: number): number {
  if (value <= 0) return 100;
  const target = value * 1.15;
  const exp = Math.floor(Math.log10(target));
  const magnitude = Math.pow(10, exp);
  const normalized = target / magnitude;
  let niceMultiplier = 1;
  if (normalized <= 1) niceMultiplier = 1;
  else if (normalized <= 2) niceMultiplier = 2;
  else if (normalized <= 2.5) niceMultiplier = 2.5;
  else if (normalized <= 5) niceMultiplier = 5;
  else niceMultiplier = 10;
  return Math.max(100, niceMultiplier * magnitude);
}

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

interface PayrollChartProps {
  timeline: MonthlyPayrollItem[];
  hoveredIndex: number | null;
  onHover: (index: number | null) => void;
}

/** Bar chart styled to match the design with dynamic scales and hover tooltips */
function PayrollChart({ timeline, hoveredIndex, onHover }: PayrollChartProps) {
  const width = 720;
  const height = 220;
  const paddingLeft = 40;
  const paddingBottom = 24;
  const baseline = height - paddingBottom;

  const maxVal = useMemo(
    () => Math.max(...timeline.map((item) => Math.max(item.gross, item.net)), 0),
    [timeline]
  );

  const maxY = useMemo(() => calculateMaxY(maxVal), [maxVal]);
  const gridValues = useMemo(
    () => [0, maxY * 0.25, maxY * 0.5, maxY * 0.75, maxY],
    [maxY]
  );

  const count = Math.max(1, timeline.length);
  const slot = (width - paddingLeft) / count;
  const barWidth = Math.min(14, Math.max(6, (slot - 12) / 2));

  const yFor = (value: number) =>
    baseline - Math.min(1, Math.max(0, value / maxY)) * baseline;

  const hasAnyData = maxVal > 0;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height: 240 }}
      >
        {/* Horizontal grid lines and Y-axis labels */}
        {gridValues.map((value) => {
          const y = yFor(value);
          return (
            <g key={value}>
              <line
                x1={paddingLeft}
                x2={width}
                y1={y}
                y2={y}
                stroke="#f1f5f4"
                strokeWidth={1}
              />
              <text
                x={paddingLeft - 8}
                y={y + 4}
                fontSize={11}
                fill="#9ca3af"
                textAnchor="end"
              >
                {formatAxisValue(value)}
              </text>
            </g>
          );
        })}

        {/* Bars and month labels */}
        {timeline.map((bar, index) => {
          const center = paddingLeft + slot * index + slot / 2;
          const grossHeight = Math.max(0, baseline - yFor(bar.gross));
          const netHeight = Math.max(0, baseline - yFor(bar.net));
          const isHovered = hoveredIndex === index;

          return (
            <g
              key={`${bar.year}-${bar.month_num}`}
              className="cursor-pointer transition-opacity duration-200"
              opacity={hoveredIndex === null || isHovered ? 1 : 0.45}
            >
              {/* Gross salary bar */}
              <rect
                x={center - barWidth - 2}
                y={yFor(bar.gross)}
                width={barWidth}
                height={grossHeight}
                rx={3}
                fill="#2563eb"
                className="transition-all duration-300"
              />

              {/* Net salary bar */}
              <rect
                x={center + 2}
                y={yFor(bar.net)}
                width={barWidth}
                height={netHeight}
                rx={3}
                fill="#10b981"
                className="transition-all duration-300"
              />

              {/* Month label on X-axis */}
              <text
                x={center}
                y={height - 4}
                fontSize={11}
                fill={isHovered ? "#1f2937" : "#9ca3af"}
                fontWeight={isHovered ? "bold" : "normal"}
                textAnchor="middle"
              >
                {bar.month}
              </text>

              {/* Invisible overlay for hit detection */}
              <rect
                x={paddingLeft + slot * index}
                y={0}
                width={slot}
                height={height}
                fill="transparent"
                onMouseEnter={() => onHover(index)}
                onMouseLeave={() => onHover(null)}
              />
            </g>
          );
        })}
      </svg>

      {/* Empty records notice */}
      {!hasAnyData && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
          <p className="text-xs font-medium text-gray-400">
            No payroll records found for this period
          </p>
          <p className="text-[11px] text-gray-300">
            Generate payslips to see monthly gross and net distribution
          </p>
        </div>
      )}

      {/* Floating tooltip on hover */}
      {hoveredIndex !== null && timeline[hoveredIndex] && (
        <div
          className="pointer-events-none absolute z-20 min-w-[200px] rounded-2xl border border-gray-100 bg-gray-900/95 p-3 text-xs text-white shadow-xl backdrop-blur-sm transition-all"
          style={{
            left: `${Math.min(
              85,
              Math.max(
                15,
                ((paddingLeft + slot * hoveredIndex + slot / 2) / width) * 100
              )
            )}%`,
            top: "8px",
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-semibold text-gray-200">
            {timeline[hoveredIndex].month_name} {timeline[hoveredIndex].year}
          </div>
          <div className="mt-2 space-y-1 text-[11px]">
            <div className="flex items-center justify-between gap-4 text-blue-300">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb]" /> Gross Salary:
              </span>
              <span className="font-semibold text-white">
                {formatCurrency(timeline[hoveredIndex].gross)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-emerald-300">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" /> Net Salary:
              </span>
              <span className="font-semibold text-white">
                {formatCurrency(timeline[hoveredIndex].net)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-orange-300">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" /> Deductions:
              </span>
              <span className="font-semibold text-white">
                {formatCurrency(timeline[hoveredIndex].deductions)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-gray-300">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400" /> Total Expense:
              </span>
              <span className="font-semibold text-white">
                {formatCurrency(timeline[hoveredIndex].total_expense)}
              </span>
            </div>
            {timeline[hoveredIndex].employee_count > 0 && (
              <div className="mt-1.5 border-t border-gray-700/60 pt-1 text-[10px] text-gray-400">
                Processed for {timeline[hoveredIndex].employee_count}{" "}
                {timeline[hoveredIndex].employee_count === 1 ? "employee" : "employees"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPayroll() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [periodFilter, setPeriodFilter] = useState<string>("last_6");
  const [analytics, setAnalytics] = useState<PayrollAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let params: { year?: number; months?: number } = {};
      if (periodFilter === "last_6") {
        params = { months: 6 };
      } else if (periodFilter === "last_12") {
        params = { months: 12 };
      } else {
        const parsedYear = Number(periodFilter);
        if (!isNaN(parsedYear)) {
          params = { year: parsedYear };
        }
      }

      const data = await adminPayrollService.getAnalytics(params);
      setAnalytics(data);
    } catch (err: unknown) {
      console.error("Failed to load payroll analytics:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load payroll overview data."
      );
    } finally {
      setLoading(false);
    }
  }, [periodFilter]);

  // Refresh analytics whenever overview tab is opened or period filter changes
  useEffect(() => {
    if (activeTab === "overview") {
      void fetchAnalytics();
    }
  }, [activeTab, fetchAnalytics]);

  const filterLabel = useMemo(() => {
    if (periodFilter === "last_6") return "Last 6 Months";
    if (periodFilter === "last_12") return "Last 12 Months";
    return `Year ${periodFilter}`;
  }, [periodFilter]);

  const summary = analytics?.summary;

  const summaryCards = useMemo(() => {
    const totalEmps = summary?.total_employees ?? 0;
    const processed = summary?.processed_payroll ?? 0;
    const pending = summary?.pending_payroll ?? 0;
    const totalAmt = summary?.total_payroll_amount ?? 0;
    const latestMonth = summary?.latest_month || "Current Month";

    const processedPercent =
      totalEmps > 0 ? Math.round((processed / totalEmps) * 100) : 0;

    return [
      {
        label: "Total Employees",
        value: loading && !analytics ? "..." : String(totalEmps),
        note: "Active employees",
        icon: Users,
        iconBg: "bg-blue-500",
      },
      {
        label: "Processed Payroll",
        value: loading && !analytics ? "..." : String(processed),
        note:
          totalEmps > 0
            ? `${processedPercent}% of total employees`
            : "No active employees",
        icon: WalletCards,
        iconBg: "bg-emerald-500",
      },
      {
        label: "Pending Payroll",
        value: loading && !analytics ? "..." : String(pending),
        note: pending > 0 ? "Needs attention" : "All up to date",
        icon: ClipboardList,
        iconBg: "bg-orange-500",
      },
      {
        label: "Total Payroll Amount",
        value: loading && !analytics ? "..." : formatCurrency(totalAmt),
        note: latestMonth,
        icon: Landmark,
        iconBg: "bg-violet-600",
      },
    ];
  }, [analytics, loading, summary]);

  const recentRuns = useMemo(() => {
    if (analytics?.recent_runs && analytics.recent_runs.length > 0) {
      return analytics.recent_runs;
    }
    return [];
  }, [analytics]);

  const departmentRows = useMemo(() => {
    if (analytics?.departments && analytics.departments.length > 0) {
      return analytics.departments;
    }
    return [];
  }, [analytics]);

  const quickActions: Array<[string, typeof Settings2, () => void]> = [
    ["Add Salary Structure", Settings2, () => setActiveTab("structure")],
    ["Manage Deductions", CalendarDays, () => setActiveTab("deductions")],
    ["Generate Payslip", FileText, () => setActiveTab("payslips")],
    ["Payroll Reports", BarChart3, () => setActiveTab("reports")],
  ];

  const pendingItems: Array<[string, string, typeof Users]> = useMemo(() => {
    const pendingCount = summary?.pending_payroll ?? 0;
    return [
      [String(pendingCount), "Employees - Pending Payroll", Users],
      ["0", "New Joiners - Add to Payroll", Users],
      ["0", "Employee Updates - Pending", ClipboardList],
    ];
  }, [summary]);

  return (
    <div className="px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10">
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

      {/* Tabs */}
      <div className="mb-6 rounded-3xl bg-white px-6 py-4 shadow-sm">
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
                    Total Payroll Amount ({filterLabel})
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                  {/* Filter select */}
                  <div className="relative">
                    <select
                      value={periodFilter}
                      onChange={(e) => setPeriodFilter(e.target.value)}
                      disabled={loading}
                      aria-label="Select payroll chart period"
                      className="cursor-pointer appearance-none rounded-full border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-gray-700 outline-none transition hover:border-gray-300 focus:border-[#2563eb]"
                    >
                      <option value="last_6">Last 6 Months</option>
                      <option value="last_12">Last 12 Months</option>
                      {analytics?.available_years?.map((yr) => (
                        <option key={yr} value={String(yr)}>
                          Year {yr}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  </div>

                  {/* Refresh button */}
                  <button
                    type="button"
                    onClick={() => void fetchAnalytics()}
                    disabled={loading}
                    title="Refresh payroll data"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#2563eb]" : ""}`}
                    />
                  </button>

                  {/* Legend */}
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#2563eb]" /> Gross Salary
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#10b981]" /> Net Salary
                    </span>
                  </div>
                </div>
              </div>

              {/* Chart Content State */}
              {loading && !analytics ? (
                <div className="flex h-[240px] flex-col items-center justify-center gap-2">
                  <Loader2 className="h-7 w-7 animate-spin text-[#2563eb]" />
                  <p className="text-xs text-gray-400">Loading payroll analytics...</p>
                </div>
              ) : error ? (
                <div className="flex h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-red-200 bg-red-50/40 p-6 text-center">
                  <AlertCircle className="h-7 w-7 text-red-500" />
                  <p className="text-xs font-medium text-red-700">{error}</p>
                  <button
                    type="button"
                    onClick={() => void fetchAnalytics()}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  <PayrollChart
                    timeline={analytics?.timeline ?? []}
                    hoveredIndex={hoveredBarIndex}
                    onHover={setHoveredBarIndex}
                  />

                  {/* Monthly Payroll Key Metrics Breakdown */}
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-4">
                    <div className="rounded-xl bg-gray-50/70 p-2.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        Total Gross
                      </p>
                      <p className="mt-0.5 text-xs font-bold text-gray-900">
                        {formatCurrency(summary?.period_gross ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-emerald-50/50 p-2.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">
                        Total Net
                      </p>
                      <p className="mt-0.5 text-xs font-bold text-emerald-900">
                        {formatCurrency(summary?.period_net ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-orange-50/50 p-2.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-orange-600">
                        Deductions
                      </p>
                      <p className="mt-0.5 text-xs font-bold text-orange-900">
                        {formatCurrency(summary?.period_deductions ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-blue-50/50 p-2.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600">
                        Total Expenses
                      </p>
                      <p className="mt-0.5 text-xs font-bold text-blue-900">
                        {formatCurrency(summary?.period_expense ?? 0)}
                      </p>
                    </div>
                  </div>
                </>
              )}
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
                  onClick={() => setActiveTab("reports")}
                  className="text-xs font-semibold text-[#2563eb] hover:underline"
                >
                  View Reports
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {recentRuns.length > 0 ? (
                  recentRuns.map((run) => (
                    <div
                      key={run.month}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 p-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{run.month}</p>
                        <p className="text-xs text-gray-400">Processed on {run.processed_on}</p>
                      </div>

                      <span className="text-sm text-gray-500">{run.progress}</span>
                      <StatusBadge status={run.status} />
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-100 p-6 text-center text-xs text-gray-400">
                    No recent payroll runs recorded.
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 rounded-3xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Pending Items</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab("payslips")}
                  className="text-xs font-semibold text-[#2563eb] hover:underline"
                >
                  Go to Payslips
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
                      onClick={() => setActiveTab("payslips")}
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

            {departmentRows.length > 0 ? (
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
                      <tr key={row.department} className="border-b border-gray-50 last:border-0">
                        <td className="py-4 font-semibold text-gray-900">{row.department}</td>
                        <td className="py-4 text-gray-600">{row.employees}</td>
                        <td className="py-4 text-gray-600">{formatCurrency(row.gross)}</td>
                        <td className="py-4 text-gray-600">{formatCurrency(row.net)}</td>
                        <td className="py-4">
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-100 p-8 text-center text-xs text-gray-400">
                No department payroll records available for this period.
              </div>
            )}

            {departmentRows.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
                <span>
                  Showing 1 to {departmentRows.length} of {departmentRows.length} entries
                </span>
              </div>
            )}
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
