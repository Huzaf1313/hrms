import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  FileText,
  IndianRupee,
  Loader2,
  RefreshCw,
  Settings2,
  Users,
} from "lucide-react";
import SalaryStructureTab from "./SalaryStructureTab";
import DeductionsTab from "./DeductionsTab";
import PayslipsTab from "./PayslipsTab";
import { PageHeading } from "../../components/ui/PageHeading";
import Reports from "../dashboard/Reports";
import {
  type MonthlyPayrollItem,
} from "./adminPayrollService";
import { usePayrollAnalytics } from "../../hooks/useAdminPayroll";

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
  let niceMultiplier: number;
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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
        isComplete
          ? "bg-[#E3F5E1] text-[#1E6B45] border-[#BCE8B5]"
          : "bg-[#FDF3D6] text-[#8A5A00] border-[#F6DE95]"
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const width = Math.max(containerWidth, 600);
  const height = 280;
  const paddingLeft = 48;
  const paddingRight = 24;
  const paddingBottom = 32;
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
  const availableWidth = width - paddingLeft - paddingRight;
  const slot = availableWidth / count;
  const barWidth = Math.min(22, Math.max(10, (slot - 16) / 3));

  const yFor = (value: number) =>
    baseline - Math.min(1, Math.max(0, value / maxY)) * baseline;

  const hasAnyData = maxVal > 0;

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full block overflow-visible"
        style={{ height: 280 }}
      >
        {/* Horizontal grid lines and Y-axis labels */}
        {gridValues.map((value) => {
          const y = yFor(value);
          return (
            <g key={value}>
              <line
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={y}
                y2={y}
                stroke="#E4E6E1"
                strokeWidth={1}
              />
              <text
                x={paddingLeft - 8}
                y={y + 4}
                fontSize={12}
                fill="#7B8794"
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
                x={center - barWidth - 3}
                y={yFor(bar.gross)}
                width={barWidth}
                height={grossHeight}
                rx={3}
                fill="#2F5FD0"
                className="transition-all duration-300"
              />

              {/* Net salary bar */}
              <rect
                x={center + 3}
                y={yFor(bar.net)}
                width={barWidth}
                height={netHeight}
                rx={3}
                fill="#10B981"
                className="transition-all duration-300"
              />

              {/* Month label on X-axis */}
              <text
                x={center}
                y={height - 8}
                fontSize={12}
                fill={isHovered ? "#1F2933" : "#7B8794"}
                fontWeight={isHovered ? "600" : "400"}
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
          <p className="text-xs font-medium text-[#7B8794]">
            No payroll records found for this period
          </p>
          <p className="text-xs text-[#7B8794]/80">
            Generate payslips to see monthly gross and net distribution
          </p>
        </div>
      )}

      {/* Floating tooltip on hover */}
      {hoveredIndex !== null && timeline[hoveredIndex] && (
        <div
          className="pointer-events-none absolute z-20 min-w-[200px] rounded-lg border border-[#E4E6E1] bg-[#1F2933]/95 p-3 text-xs text-white shadow-xl backdrop-blur-sm transition-all"
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
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex items-center justify-between gap-4 text-blue-300">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2F5FD0]" /> Gross Salary:
              </span>
              <span className="font-semibold text-white">
                {formatCurrency(timeline[hoveredIndex].gross)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-emerald-300">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" /> Net Salary:
              </span>
              <span className="font-semibold text-white">
                {formatCurrency(timeline[hoveredIndex].net)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-amber-300">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" /> Deductions:
              </span>
              <span className="font-semibold text-white">
                {formatCurrency(timeline[hoveredIndex].deductions)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Total Expense:
              </span>
              <span className="font-semibold text-white">
                {formatCurrency(timeline[hoveredIndex].total_expense)}
              </span>
            </div>
            {timeline[hoveredIndex].employee_count > 0 && (
              <div className="mt-1.5 border-t border-slate-700/60 pt-1 text-xs text-slate-400">
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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [payslipStatusFilter, setPayslipStatusFilter] = useState<string>("");
  const [periodFilter, setPeriodFilter] = useState<string>("last_6");
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const analyticsParams = useMemo(() => {
    if (periodFilter === "last_6") {
      return { months: 6 };
    } else if (periodFilter === "last_12") {
      return { months: 12 };
    } else {
      const parsedYear = Number(periodFilter);
      return !isNaN(parsedYear) ? { year: parsedYear } : {};
    }
  }, [periodFilter]);

  const {
    data: analyticsData,
    isLoading: loading,
    error: queryError,
    refetch,
  } = usePayrollAnalytics(analyticsParams);

  const analytics = analyticsData ?? null;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Failed to load payroll overview data."
    : null;

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
        iconBg: "bg-[#E8EEFB]",
        iconColor: "text-[#2F5FD0]",
      },
      {
        label: "Processed Payroll",
        value: loading && !analytics ? "..." : String(processed),
        note:
          totalEmps > 0
            ? `${processedPercent}% of total employees`
            : "No active employees",
        icon: CheckCircle2,
        iconBg: "bg-[#E3F5E1]",
        iconColor: "text-[#1E6B45]",
      },
      {
        label: "Pending Payroll",
        value: loading && !analytics ? "..." : String(pending),
        note: pending > 0 ? "Needs attention" : "All up to date",
        icon: Clock,
        iconBg: "bg-[#FDF3D6]",
        iconColor: "text-[#8A5A00]",
      },
      {
        label: "Total Payroll Amount",
        value: loading && !analytics ? "..." : formatCurrency(totalAmt),
        note: latestMonth,
        icon: IndianRupee,
        iconBg: "bg-[#F3E8FF]",
        iconColor: "text-[#7E22CE]",
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

  const quickActions: Array<{
    label: string;
    icon: typeof Settings2;
    onClick: () => void;
    iconBg: string;
    iconColor: string;
  }> = [
    {
      label: "Add Salary Structure",
      icon: Settings2,
      onClick: () => setActiveTab("structure"),
      iconBg: "bg-[#E8EEFB]",
      iconColor: "text-[#2F5FD0]",
    },
    {
      label: "Manage Deductions",
      icon: CalendarDays,
      onClick: () => setActiveTab("deductions"),
      iconBg: "bg-[#FDF3D6]",
      iconColor: "text-[#8A5A00]",
    },
    {
      label: "Generate Payslip",
      icon: FileText,
      onClick: () => setActiveTab("payslips"),
      iconBg: "bg-[#E3F5E1]",
      iconColor: "text-[#1E6B45]",
    },
    {
      label: "Payroll Reports",
      icon: BarChart3,
      onClick: () => setActiveTab("reports"),
      iconBg: "bg-[#F3E8FF]",
      iconColor: "text-[#7E22CE]",
    },
  ];

  const pendingItems: Array<{
    count: string;
    label: string;
    icon: typeof Users;
    action: () => void;
    iconBg: string;
    iconColor: string;
  }> = useMemo(() => {
    const pendingCount = summary?.pending_employees ?? summary?.pending_payroll ?? 0;
    const newJoiners = summary?.new_joiners ?? 0;
    const unassignedStructures = summary?.unassigned_salary_structures ?? 0;
    return [
      {
        count: loading && !analytics ? "..." : String(pendingCount),
        label: "Employees - Pending Payroll",
        icon: Users,
        action: () => {
          setPayslipStatusFilter("Pending");
          setActiveTab("payslips");
        },
        iconBg: "bg-[#FDF3D6]",
        iconColor: "text-[#8A5A00]",
      },
      {
        count: loading && !analytics ? "..." : String(newJoiners),
        label: "New Joiners (Last 30 Days)",
        icon: Users,
        action: () => navigate("/dashboard/employees?filter=new_joiners"),
        iconBg: "bg-[#E8EEFB]",
        iconColor: "text-[#2F5FD0]",
      },
      {
        count: loading && !analytics ? "..." : String(unassignedStructures),
        label: "Employees Missing Salary Structure",
        icon: ClipboardList,
        action: () => navigate("/dashboard/employees?filter=missing_salary_structure"),
        iconBg: "bg-[#FBE4E1]",
        iconColor: "text-[#A12D22]",
      },
    ];
  }, [summary, loading, analytics, navigate]);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Page Header */}
      <PageHeading title="Manage payroll, salary structure, deductions and generate payslips." />

      {/* KPI Stats - 4 separate cards in a grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="rounded-lg border border-[#E4E6E1] bg-white p-[16px_20px] min-h-[96px] shadow-kpi flex flex-col justify-between min-w-0"
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-[13px] font-medium text-[#7B8794] truncate">
                  {card.label}
                </span>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${card.iconColor}`} />
                </div>
              </div>

              <div className="mt-2">
                <span className="text-[28px] font-semibold text-[#1F2933] tracking-tight leading-[1.1] block">
                  {card.value}
                </span>
              </div>
              {card.note && (
                <span className="text-xs text-[#7B8794] mt-1 truncate block m-0">
                  {card.note}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#E4E6E1] overflow-x-auto overflow-y-hidden scrollbar-hidden max-w-full">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === tab.key
                ? "border-[#2F5FD0] text-[#2F5FD0] font-semibold bg-white"
                : "border-transparent text-[#52606D] hover:text-[#1F2933] hover:bg-[#F6F7F5]"
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="flex flex-col gap-6">
          {/* Payroll Charts (Full Width) */}
          <div className="min-w-0 rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-none flex flex-col justify-between">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[#1F2933]">Payroll Charts</h2>
                  <p className="mt-0.5 text-xs text-[#7B8794]">
                    Total Payroll Amount ({filterLabel})
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-[#7B8794]">
                  {/* Filter select */}
                  <div className="relative">
                    <select
                      value={periodFilter}
                      onChange={(e) => setPeriodFilter(e.target.value)}
                      disabled={loading}
                      aria-label="Select payroll chart period"
                      className="cursor-pointer appearance-none rounded-md border border-[#E4E6E1] bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-[#1F2933] outline-none transition hover:border-[#CBD2D9] focus:border-[#2F5FD0]"
                    >
                      <option value="last_6">Last 6 Months</option>
                      <option value="last_12">Last 12 Months</option>
                      {analytics?.available_years?.map((yr) => (
                        <option key={yr} value={String(yr)}>
                          Year {yr}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2 text-[#7B8794]" />
                  </div>

                  {/* Refresh button */}
                  <button
                    type="button"
                    onClick={() => void refetch()}
                    disabled={loading}
                    title="Refresh payroll data"
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E4E6E1] text-[#7B8794] transition hover:bg-[#F0F1EE] hover:text-[#1F2933] cursor-pointer"
                  >
                    <RefreshCw
                      className={`h-4 w-4 shrink-0 ${loading ? "animate-spin text-[#2F5FD0]" : ""}`}
                    />
                  </button>

                  {/* Legend */}
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-[#52606D]">
                      <span className="h-2 w-2 rounded-full bg-[#2F5FD0]" /> Gross Salary
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-[#52606D]">
                      <span className="h-2 w-2 rounded-full bg-[#10B981]" /> Net Salary
                    </span>
                  </div>
                </div>
              </div>

              {/* Chart Content State */}
              {loading && !analytics ? (
                <div className="flex h-[280px] flex-col items-center justify-center gap-2">
                  <Loader2 className="h-7 w-7 animate-spin text-[#2F5FD0]" />
                  <p className="text-xs text-[#7B8794]">Loading payroll analytics...</p>
                </div>
              ) : error ? (
                <div className="flex h-[280px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#FBE4E1] bg-[#FBE4E1]/30 p-6 text-center">
                  <AlertCircle className="h-7 w-7 text-[#A12D22]" />
                  <p className="text-xs font-medium text-[#A12D22]">{error}</p>
                  <button
                    type="button"
                    onClick={() => void refetch()}
                    className="rounded-md bg-[#A12D22] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#8B231A] cursor-pointer"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="w-full min-w-0">
                  <PayrollChart
                    timeline={analytics?.timeline ?? []}
                    hoveredIndex={hoveredBarIndex}
                    onHover={setHoveredBarIndex}
                  />

                  {/* Monthly Payroll Key Metrics Breakdown */}
                  <div className="mt-6 border-t border-[#E4E6E1] py-4 px-5 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E4E6E1]">
                    <div className="px-4 py-2 sm:py-0 first:pl-0 last:pr-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-[#7B8794]">
                        Total Gross
                      </p>
                      <p className="mt-1 text-base font-semibold text-[#1F2933]">
                        {formatCurrency(summary?.period_gross ?? 0)}
                      </p>
                    </div>
                    <div className="px-4 py-2 sm:py-0 first:pl-0 last:pr-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-[#7B8794]">
                        Total Net
                      </p>
                      <p className="mt-1 text-base font-semibold text-[#1F2933]">
                        {formatCurrency(summary?.period_net ?? 0)}
                      </p>
                    </div>
                    <div className="px-4 py-2 sm:py-0 first:pl-0 last:pr-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-[#7B8794]">
                        Deductions
                      </p>
                      <p className="mt-1 text-base font-semibold text-[#1F2933]">
                        {formatCurrency(summary?.period_deductions ?? 0)}
                      </p>
                    </div>
                    <div className="px-4 py-2 sm:py-0 first:pl-0 last:pr-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-[#7B8794]">
                        Total Expenses
                      </p>
                      <p className="mt-1 text-base font-semibold text-[#1F2933]">
                        {formatCurrency(summary?.period_expense ?? 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions (2x2 image style) + Recent Payroll Runs */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-stretch">
              <div className="min-w-0 rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-none flex flex-col justify-between">
                <div>
                  <h2 className="mb-4 text-base font-semibold text-[#1F2933]">Quick Actions</h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {quickActions.map(({ label, icon: Icon, onClick, iconBg, iconColor }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={onClick}
                        className="flex min-w-0 items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-left transition hover:border-[#CBD5E1] hover:bg-[#F8FAFC] cursor-pointer"
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
                          <Icon className="h-4 w-4 shrink-0" />
                        </span>
                        <span className="min-w-0 flex-1 text-[13px] font-medium text-[#1F2937] leading-tight truncate">
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="min-w-0 rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-none">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[#1F2933]">Recent Payroll Runs</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab("reports")}
                    className="text-xs font-semibold text-[#2F5FD0] hover:underline cursor-pointer"
                  >
                    View Reports
                  </button>
                </div>

                <div className="divide-y divide-[#E5E7EB]">
                  {recentRuns.length > 0 ? (
                    recentRuns.map((run) => (
                      <div
                        key={run.month}
                        className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-[#F6F7F5]/50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#1F2933]">{run.month}</p>
                          <p className="text-xs text-[#7B8794]">Processed on {run.processed_on}</p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs text-[#52606D] font-medium">{run.progress}</span>
                          <StatusBadge status={run.status} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] p-6 text-center text-xs text-[#7B8794]">
                      No recent payroll runs recorded.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Department summary + Pending Items */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-stretch">
              <div className="xl:col-span-7 h-full min-w-0 rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-none flex flex-col justify-between">
                <div>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-[#1F2933]">Payroll Summary by Department</h2>
                  </div>

                  {departmentRows.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[540px] text-sm">
                        <thead>
                          <tr className="border-b border-[#E5E7EB] text-xs font-medium uppercase tracking-wide text-[#7B8794]">
                            <th className="pb-3 pr-4 text-left">Department</th>
                            <th className="pb-3 px-4 text-right">Employees</th>
                            <th className="pb-3 px-4 text-right">Gross Salary</th>
                            <th className="pb-3 px-4 text-right">Net Salary</th>
                            <th className="pb-3 pl-4 text-left">Status</th>
                          </tr>
                        </thead>

                        <tbody>
                          {departmentRows.map((row) => (
                            <tr key={row.department} className="border-b border-[#E5E7EB]/60 last:border-0 hover:bg-[#F6F7F5]/50 transition-colors">
                              <td className="py-3.5 pr-4 text-left font-semibold text-[#1F2933]">{row.department}</td>
                              <td className="py-3.5 px-4 text-right tabular-nums text-[#52606D]">{row.employees}</td>
                              <td className="py-3.5 px-4 text-right tabular-nums font-medium text-[#1F2933]">{formatCurrency(row.gross)}</td>
                              <td className="py-3.5 px-4 text-right tabular-nums font-medium text-[#1F2933]">{formatCurrency(row.net)}</td>
                              <td className="py-3.5 pl-4 text-left">
                                <StatusBadge status={row.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] p-8 text-center text-xs text-[#7B8794]">
                      No department payroll records available for this period.
                    </div>
                  )}
                </div>

                {departmentRows.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#7B8794]">
                    <span>
                      Showing 1 to {departmentRows.length} of {departmentRows.length} entries
                    </span>
                  </div>
                )}
              </div>

              <div className="xl:col-span-5 h-full min-w-0 rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-none flex flex-col">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[#1F2933]">Pending Items</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setPayslipStatusFilter("");
                      setActiveTab("payslips");
                    }}
                    className="text-xs font-semibold text-[#2F5FD0] hover:underline cursor-pointer"
                  >
                    Go to Payslips
                  </button>
                </div>

                <div className="divide-y divide-[#E5E7EB]">
                  {pendingItems.map(({ count, label, icon: Icon, action, iconBg, iconColor }) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 py-3 hover:bg-[#F6F7F5]/50 transition-colors"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
                        <Icon className="h-4 w-4 shrink-0" />
                      </div>

                      <span className="text-base font-semibold text-[#1F2933] min-w-[20px]">{count}</span>
                      <span className="flex-1 text-sm text-[#52606D]">{label}</span>

                      <button
                        type="button"
                        onClick={action}
                        className="rounded-md border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#1F2933] hover:bg-[#F0F1EE] cursor-pointer"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
        </div>
      )}

      {activeTab === "structure" && <SalaryStructureTab />}
      {activeTab === "deductions" && <DeductionsTab />}
      {activeTab === "payslips" && <PayslipsTab initialStatusFilter={payslipStatusFilter} />}
      {activeTab === "reports" && <Reports />}
    </div>
  );
}
