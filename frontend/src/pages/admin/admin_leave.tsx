import { useEffect, useMemo, useState } from "react";
import { TableRowSkeleton } from "../../components/ui";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  UserRound,
  CalendarClock,
  Palmtree,
  Stethoscope,
  Gift,
  Timer,
  Eye,
  Check,
  X,
  Filter,
  Plus,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Pencil,
} from "lucide-react";
import { departmentService } from "../../services/departmentService";
import { leaveService, type LeaveRequest, type LeaveStatus, type LeaveSummary } from "../../services/admin_leave_service";
import { adminMyLeaveStore } from "../../services/adminMyLeaveStore";
import { useGlobalDate } from "../../context/globalDateContext";
import { GlobalDateBadge } from "../../components/GlobalDateBadge";
import NewLeaveRequestModal from "../../components/admin/NewLeaveRequestModal";
import type { Department } from "../../types/department";
import type { LeaveRequestDraft } from "../../types/leave";
import { countWorkingDays } from "../../utils/workingDays";

const leaveBalances = [
  {
    label: "Casual Leave",
    used: 240,
    total: 320,
    icon: Palmtree,
    iconBg: "bg-teal-50",
    iconColor: "text-teal-600",
  },
  {
    label: "Sick Leave",
    used: 96,
    total: 120,
    icon: Stethoscope,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    label: "Earned Leave",
    used: 156,
    total: 240,
    icon: Gift,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
  },
  {
    label: "Comp Off",
    used: 32,
    total: 48,
    icon: Timer,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
  },
];

/** localStorage key holding edits to the balance summary's day totals. */
const LEAVE_BALANCES_KEY = "adminLeaveBalances";

const leaveTypeColors: Record<string, string> = {
  "Casual Leave": "bg-emerald-50 text-emerald-600",
  "Sick Leave": "bg-blue-50 text-blue-600",
  "Earned Leave": "bg-orange-50 text-orange-500",
  "Comp Off": "bg-violet-50 text-violet-600",
};

const statusStyles: Record<LeaveStatus, string> = {
  pending: "bg-orange-50 text-orange-500",
  approved: "bg-emerald-50 text-emerald-600",
  rejected: "bg-rose-50 text-rose-600",
  cancelled: "bg-gray-50 text-gray-500",
};

const statusLabel: Record<LeaveStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

// --- Line chart (pure SVG, no external chart library required) --------

/**
 * Pages through every leave request so the monthly chart is not limited to the
 * five rows the table shows.
 */
async function listAllLeaves(): Promise<LeaveRequest[]> {
  const pageSize = 100;
  const collected: LeaveRequest[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const response = await leaveService.list({ page, limit: pageSize });

    collected.push(...response.items);

    if (response.items.length < pageSize || page >= response.pages) break;
  }

  return collected;
}

/** Counts requests per day of the current month, grouped by status. */
function buildMonthlySeries(requests: LeaveRequest[]): LeaveChartSeries {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const dayCount = new Date(year, month + 1, 0).getDate();

  const series: LeaveChartSeries = {
    pending: Array<number>(dayCount).fill(0),
    approved: Array<number>(dayCount).fill(0),
    rejected: Array<number>(dayCount).fill(0),
    dayCount,
    monthLabel: today.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
  };

  for (const request of requests) {
    if (!request.created_at) continue;

    const created = new Date(request.created_at);

    if (
      Number.isNaN(created.getTime()) ||
      created.getFullYear() !== year ||
      created.getMonth() !== month
    ) {
      continue;
    }

    const status = request.status.toLowerCase();
    const bucket = series[status as "pending" | "approved" | "rejected"];

    // Cancelled and any unknown status are not charted.
    if (!bucket) continue;

    bucket[created.getDate() - 1] += 1;
  }

  return series;
}

export interface LeaveChartSeries {
  pending: number[];
  approved: number[];
  rejected: number[];
  /** Days in the rendered month, so the axis matches the real month length. */
  dayCount: number;
  monthLabel: string;
}

/** Rounds the axis maximum up to the next multiple of ten, never below ten. */
function niceMax(values: number[][]): number {
  const highest = Math.max(0, ...values.flat());

  return Math.max(10, Math.ceil(highest / 10) * 10);
}

function LeaveChart({ series }: { series: LeaveChartSeries }) {
  const width = 720;
  const height = 220;
  const paddingLeft = 32;
  const paddingBottom = 24;
  const points = series.dayCount;
  const maxY = niceMax([series.pending, series.approved, series.rejected]);
  const step = maxY / 4;

  const xFor = (index: number) =>
    paddingLeft + (index * (width - paddingLeft)) / (points - 1);
  const yFor = (value: number) =>
    height - paddingBottom - (value / maxY) * (height - paddingBottom);

  const toPath = (values: number[]) =>
    values.map((value, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(value)}`).join(" ");

  const toArea = (values: number[]) =>
    `${toPath(values)} L ${xFor(values.length - 1)} ${height - paddingBottom} L ${xFor(0)} ${height - paddingBottom} Z`;

  const lines = [
    { key: "pending", color: "#f97316", values: series.pending },
    { key: "approved", color: "#10b981", values: series.approved },
    { key: "rejected", color: "#f43f5e", values: series.rejected },
  ];

  const gridValues = [0, step, step * 2, step * 3, maxY];

  const hasData = lines.some((line) => line.values.some((value) => value > 0));

  // One label per week keeps the axis readable on a 28-31 day month.
  const labelEvery = Math.max(1, Math.round(points / 6));
  const dayLabels = series.dayCount
    ? Array.from({ length: points }, (_, index) => index + 1).filter(
        (day) => (day - 1) % labelEvery === 0 || day === points,
      )
    : [];

  return (
    <div>
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
              {Math.round(value)}
            </text>
          </g>
        ))}

        {lines.map((line) => (
          <path key={`${line.key}-area`} d={toArea(line.values)} fill={line.color} opacity={0.08} />
        ))}
        {lines.map((line) => (
          <path
            key={`${line.key}-line`}
            d={toPath(line.values)}
            fill="none"
            stroke={line.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {dayLabels.map((day) => (
          <text
            key={day}
            x={xFor(day - 1)}
            y={height - 4}
            fontSize={11}
            fill="#9ca3af"
            textAnchor="middle"
          >
            {day}
          </text>
        ))}
      </svg>

      {!hasData && (
        <p className="-mt-2 text-center text-[11px] text-gray-400">
          No leave requests recorded in {series.monthLabel}.
        </p>
      )}
    </div>
  );
}

// --- Month calendar grid ------------------------------------------------

type DayDot = "pending";

const dotColor: Record<DayDot, string> = {
  pending: "bg-orange-400",
};

function LeaveCalendar({
  requests,
  department,
  leaveType,
}: {
  requests: LeaveRequest[];
  department: string;
  leaveType: string;
}) {
  const today = new Date();
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  // Follows the header calendar's month, so the grid and the filtered list
  // below it are never showing different months. Paging by hand is navigation
  // and leaves the shared date alone.
  //
  // The month is derived rather than stored so it cannot fall out of step, and
  // it has to be memoised: writing a freshly built Date back into state on
  // every render never compares equal, which loops forever.
  const { date: globalDateKey } = useGlobalDate();

  const globalDate = useMemo(
    () => new Date(`${globalDateKey}T00:00:00`),
    [globalDateKey],
  );

  const [monthOverride, setMonthOverride] = useState<Date | null>(null);
  const [syncedToDate, setSyncedToDate] = useState(globalDateKey);

  if (syncedToDate !== globalDateKey) {
    setSyncedToDate(globalDateKey);
    setMonthOverride(null);
  }

  const viewDate = useMemo(
    () => monthOverride ?? globalDate,
    [monthOverride, globalDate],
  );

  const filteredRequests = requests.filter(
    (request) =>
      (!department || request.department_id === department) &&
      (!leaveType || request.leave_type === leaveType),
  );

  const pendingDays = filteredRequests.reduce<Record<number, DayDot[]>>((days, request) => {
    if (request.status !== "pending") return days;

    const start = new Date(request.start_date);
    const end = new Date(request.end_date);

    for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      const key = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
      const current = days[key] ?? [];
      if (!current.includes("pending")) current.push("pending");
      days[key] = current;
    }

    return days;
  }, {});

  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const startOffset = (monthStart.getDay() + 6) % 7;
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - startOffset);

  const calendarWeeks = Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const current = new Date(calendarStart);
      current.setDate(calendarStart.getDate() + weekIndex * 7 + dayIndex);

      return {
        day: current.getDate(),
        muted: current.getMonth() !== viewDate.getMonth(),
        dotKey: new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime(),
      };
    }),
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-1">
        <button
          type="button"
          onClick={() => {
            setMonthOverride(
              new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1),
            );
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-semibold text-gray-600 hover:bg-gray-100"
          aria-label="Previous month"
        >
          &lt;
        </button>
        <span className="text-sm font-semibold text-gray-700">
          {viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={() => {
            setMonthOverride(
              new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1),
            );
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-semibold text-gray-600 hover:bg-gray-100"
          aria-label="Next month"
        >
          &gt;
        </button>
      </div>

      <div className="grid min-h-[238px] grid-cols-7 gap-y-0.5 text-center">
        {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
          <div key={day} className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {day}
          </div>
        ))}

                {calendarWeeks.flat().map((cell) => {
          const isToday = cell.dotKey === todayKey;
          const hasPending = (pendingDays[cell.dotKey] ?? []).length > 0;

          return (
            <div
              key={`${cell.dotKey}`}
              className="flex min-h-[33px] flex-col items-center justify-start rounded-lg border border-transparent px-1 py-0"
            >
              <span className={`text-sm font-medium ${isToday ? "font-bold text-blue-600" : cell.muted ? "text-gray-300" : "text-gray-700"}`}>
                {cell.day}
              </span>
                            <div className="mt-1 flex h-2.5 items-center gap-1">
                {isToday && <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />}
                {hasPending && <span className={`h-2.5 w-2.5 rounded-full ${dotColor.pending}`} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
const departmentColors = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#f97316", "#94a3b8"];
const leaveTypeKpiColors = ["#10b981", "#2563eb", "#f59e0b", "#8b5cf6", "#f97316", "#94a3b8"];

function LeaveByDepartmentKpi({ requests }: { requests: LeaveRequest[] }) {
  const counts = requests.reduce<Record<string, number>>((result, request) => {
    const department = request.department_name || "Other";
    result[department] = (result[department] ?? 0) + 1;
    return result;
  }, {});

  const items = Object.entries(counts).sort(([, a], [, b]) => b - a);
  const total = items.reduce((sum, [, count]) => sum + count, 0);

  const gradient = items
    .reduce<{ offset: number; segments: string[] }>(
      (result, [, count], index) => {
        const start = (result.offset / Math.max(total, 1)) * 100;
        const offset = result.offset + count;
        const end = (offset / Math.max(total, 1)) * 100;
        result.segments.push(`${departmentColors[index % departmentColors.length]} ${start}% ${end}%`);
        return { offset, segments: result.segments };
      },
      { offset: 0, segments: [] },
    )
    .segments.join(", ");

  return (
    <div className="overflow-y-auto rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h3 className="mb-2 font-bold text-gray-900">Leave by Department</h3>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className="relative h-24 w-24 shrink-0 rounded-full"
          style={{ background: `conic-gradient(${gradient || "#e5e7eb 0 100%"})` }}
        >
          <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white">
            <span className="text-lg font-bold text-gray-900">{total}</span>
            <span className="text-[10px] leading-tight text-gray-400">Total</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          {items.length === 0 ? (
            <span className="text-sm text-gray-400">No department data</span>
          ) : (
            items.map(([department, count], index) => (
              <div key={department} className="flex items-center justify-between gap-4 text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: departmentColors[index % departmentColors.length] }}
                  />
                  {department}
                </span>
                <span className="font-semibold text-gray-700">
                  {count} ({total ? ((count / total) * 100).toFixed(2) : 0}%)
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function LeaveByTypeKpi({ requests }: { requests: LeaveRequest[] }) {
  const counts = requests.reduce<Record<string, number>>((result, request) => {
    result[request.leave_type] = (result[request.leave_type] ?? 0) + 1;
    return result;
  }, {});

  const items = Object.entries(counts).sort(([, a], [, b]) => b - a);
  const total = items.reduce((sum, [, count]) => sum + count, 0);

  const gradient = items
    .reduce<{ offset: number; segments: string[] }>(
      (result, [, count], index) => {
        const start = (result.offset / Math.max(total, 1)) * 100;
        const offset = result.offset + count;
        const end = (offset / Math.max(total, 1)) * 100;
        result.segments.push(`${leaveTypeKpiColors[index % leaveTypeKpiColors.length]} ${start}% ${end}%`);
        return { offset, segments: result.segments };
      },
      { offset: 0, segments: [] },
    )
    .segments.join(", ");

  return (
    <div className="overflow-y-auto rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h3 className="mb-2 font-bold text-gray-900">Leave by Type</h3>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className="relative h-24 w-24 shrink-0 rounded-full"
          style={{ background: `conic-gradient(${gradient || "#e5e7eb 0 100%"})` }}
        >
          <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white">
            <span className="text-lg font-bold text-gray-900">{total}</span>
            <span className="text-[10px] leading-tight text-gray-400">Total</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {items.length === 0 ? (
            <span className="text-sm text-gray-400">No leave type data</span>
          ) : (
            items.map(([leaveType, count], index) => (
              <div key={leaveType} className="flex items-center justify-between gap-4 text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: leaveTypeKpiColors[index % leaveTypeKpiColors.length] }}
                  />
                  {leaveType}
                </span>
                <span className="font-semibold text-gray-700">
                  {count} ({total ? ((count / total) * 100).toFixed(2) : 0}%)
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
// -------------------------------------------------------------------------

function AdminLeave() {
  const [departmentFilter, setDepartmentFilter] = useState("");
  // The header calendar's day. Only sent once a day other than today has been
  // picked, so the default view stays the full unfiltered list. Leave spans
  // time, so narrowing it to a single day on load would hide every request
  // that does not happen to cover today.
  const { date: globalDate, isDefault: isGlobalDateDefault } = useGlobalDate();
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "">("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [summary, setSummary] = useState<LeaveSummary | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [chartRequests, setChartRequests] = useState<LeaveRequest[]>([]);
  const [successMessage, setSuccessMessage] = useState("");

  // Leave the admin files for themselves. The admin portal has no create
  // endpoint of its own yet, so these are kept in the browser.
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>(() =>
    adminMyLeaveStore.list(),
  );
  const [onlyMine, setOnlyMine] = useState(false);

  // Editable leave-balance quotas (days per leave type). Saved back to the
  // browser so an admin's tweaks survive a reload until a real backend for
  // balance editing exists.
  const [leaveBalancesState, setLeaveBalancesState] = useState(() => {
    try {
      const saved = localStorage.getItem(LEAVE_BALANCES_KEY);

      if (saved) {
        const parsed = JSON.parse(saved) as { label: string; used: number; total: number }[];

        return leaveBalances.map((balance) => ({
          ...balance,
          ...(parsed.find((savedRow) => savedRow.label === balance.label) ?? {}),
        }));
      }
    } catch {
      /* Corrupt or unavailable storage falls back to the defaults. */
    }

    return leaveBalances;
  });
  const [isBalanceEditOpen, setIsBalanceEditOpen] = useState(false);
  /** Per-type working copy of the numbers shown in the edit modal. */
  const [balanceDraft, setBalanceDraft] = useState<
    Record<string, { used: number; total: number }>
  >({});

  function openBalanceEdit() {
    setBalanceDraft(
      Object.fromEntries(
        leaveBalancesState.map((balance) => [
          balance.label,
          { used: balance.used, total: balance.total },
        ]),
      ),
    );
    setIsBalanceEditOpen(true);
  }

  function saveBalanceEdit() {
    const next = leaveBalancesState.map((balance) => {
      const draft = balanceDraft[balance.label] ?? {
        used: balance.used,
        total: balance.total,
      };

      return {
        ...balance,
        used: Math.max(0, Math.round(Number(draft.used) || 0)),
        total: Math.max(0, Math.round(Number(draft.total) || 0)),
      };
    });

    try {
      localStorage.setItem(
        LEAVE_BALANCES_KEY,
        JSON.stringify(next.map((balance) => ({
          label: balance.label,
          used: balance.used,
          total: balance.total,
        }))),
      );
    } catch {
      /* Persistence is best-effort; the in-memory edit still applies. */
    }

    setLeaveBalancesState(next);
    setIsBalanceEditOpen(false);
  }

  useEffect(() => {
    let cancelled = false;

    // The chart counts every request of the month, so it needs the full list
    // rather than the filtered page the table below shows.
    listAllLeaves()
      .then((all) => {
        if (!cancelled) setChartRequests(all);
      })
      .catch(() => {
        if (!cancelled) setChartRequests([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // The rows the table and the widgets below show: the admin's own requests
  // from this browser, plus the page the API returned.
  const filteredMyRequests = useMemo(
    () =>
      myRequests.filter((request) => {
        if (
          statusFilter &&
          request.status.toLowerCase() !== statusFilter.toLowerCase()
        ) {
          return false;
        }

        if (leaveTypeFilter && request.leave_type !== leaveTypeFilter) {
          return false;
        }

        // A department filter is about the organisation, and a request the
        // admin filed for themselves carries no department of its own.
        if (departmentFilter) {
          return false;
        }

        return true;
      }),
    [myRequests, statusFilter, leaveTypeFilter, departmentFilter],
  );

  const tableRequests = useMemo(
    () => (onlyMine ? filteredMyRequests : [...filteredMyRequests, ...requests]),
    [filteredMyRequests, requests, onlyMine],
  );

  const chartRows = useMemo(
    () => [...myRequests, ...chartRequests],
    [myRequests, chartRequests],
  );

  const displayTotal = onlyMine
    ? filteredMyRequests.length
    : total + filteredMyRequests.length;

  const leaveChartSeries = useMemo(() => buildMonthlySeries(chartRows), [chartRows]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      leaveService.list({ page, limit: pageSize, status: statusFilter || undefined, leave_type: leaveTypeFilter || undefined, department_id: departmentFilter || undefined, date: isGlobalDateDefault ? undefined : globalDate }),
      leaveService.summary(),
      departmentService.list(),
    ]).then(([listResult, summaryResult, departmentsResult]) => {
      if (cancelled) return;
      let hasError = false;

      if (listResult.status === "fulfilled") {
        setRequests(listResult.value.items);
        setPages(listResult.value.pages);
        setTotal(listResult.value.total);
      } else {
        hasError = true;
      }

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        hasError = true;
      }

      if (departmentsResult.status === "fulfilled") {
        setDepartments(departmentsResult.value);
      }

      setError(hasError ? "Some leave data could not be loaded." : "");
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [departmentFilter, globalDate, isGlobalDateDefault, leaveTypeFilter, page, pageSize, statusFilter]);

  const statCards = [
    { label: "Total Leave Requests", value: summary?.total_leave_requests ?? "-", sub: "This Month", icon: CalendarDays, iconBg: "bg-blue-500" },
    { label: "Pending Requests", value: summary?.pending_requests ?? "-", sub: "Awaiting Approval", icon: Clock, iconBg: "bg-orange-500" },
    { label: "Approved Requests", value: summary?.approved_requests ?? "-", sub: "This Month", icon: CheckCircle2, iconBg: "bg-emerald-500" },
    { label: "Rejected Requests", value: summary?.rejected_requests ?? "-", sub: "This Month", icon: XCircle, iconBg: "bg-rose-500" },
    { label: "On Leave Today", value: summary?.on_leave_today ?? "-", sub: "Employees", icon: UserRound, iconBg: "bg-violet-500" },
    { label: "Upcoming Leaves", value: summary?.upcoming_leaves ?? "-", sub: "Next 7 Days", icon: CalendarClock, iconBg: "bg-teal-500" },
  ];

  async function updateRequestStatus(request: LeaveRequest, nextStatus: "approved" | "rejected") {
    // A request the admin filed for themselves lives in the browser, so it is
    // updated there instead of on the server.
    if (request.id.startsWith("local-leave-")) {
      setMyRequests(adminMyLeaveStore.update(request.id, { status: nextStatus }));
      setSummary((current) =>
        current
          ? {
              ...current,
              pending_requests: Math.max(0, current.pending_requests - 1),
              approved_requests:
                nextStatus === "approved"
                  ? current.approved_requests + 1
                  : current.approved_requests,
              rejected_requests:
                nextStatus === "rejected"
                  ? current.rejected_requests + 1
                  : current.rejected_requests,
            }
          : current,
      );
      setSuccessMessage(`Your leave request was marked as ${nextStatus}.`);
      return;
    }

    try {
      await leaveService.updateStatus(request.id, nextStatus);
      setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status: nextStatus } : item));
      setSummary(await leaveService.summary());
    } catch {
      setError("Unable to update this leave request.");
    }
  }

  function createRequest(draft: LeaveRequestDraft) {
    const localRequest: LeaveRequest = {
      id: `local-leave-${Date.now()}`,
      employee_id: draft.employee_id,
      employee_name: draft.employee_name ?? "HR User",
      department_id: draft.department_id ?? null,
      department_name: draft.department_name ?? null,
      leave_type: draft.leave_type,
      start_date: draft.start_date,
      end_date: draft.end_date,
      total_days: countWorkingDays(draft.start_date, draft.end_date),
      reason: draft.reason,
      attachment_name: draft.attachment_name ?? null,
      attachment_size: draft.attachment_size ?? null,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    setMyRequests(adminMyLeaveStore.add(localRequest));
    setSummary((current) =>
      current
        ? {
            ...current,
            total_leave_requests: current.total_leave_requests + 1,
            pending_requests: current.pending_requests + 1,
          }
        : current,
    );
    setPage(1);
    setSuccessMessage("Your leave request was submitted and is pending approval.");
  }

  return (
    <div className="px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Leave Management</h1>
          <p className="mt-1 text-gray-500">
            Track, review, and manage employee leave requests.
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage("")}
            className="font-semibold text-emerald-700 hover:text-emerald-900"
            aria-label="Dismiss success message"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <p className="text-sm font-bold text-black">{card.label}</p>
              <div className="mt-1 text-2xl font-bold text-gray-900">{card.value}</div>
              <p className="mt-1 text-xs text-gray-400">{card.sub}</p>
            </div>
          );
        })}
      </div>


      {/* Recent Leave Requests */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-gray-900">Recent Leave Requests</h3>
          <div className="flex flex-wrap items-center gap-2">
            <GlobalDateBadge prefix="Covering" />
            <select
              value={departmentFilter}
              onChange={(event) => { setPage(1); setDepartmentFilter(event.target.value); }}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 focus:border-[#2563eb] focus:outline-none"
            >
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value as LeaveStatus | ""); }} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 focus:border-[#2563eb] focus:outline-none">
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select value={leaveTypeFilter} onChange={(event) => { setPage(1); setLeaveTypeFilter(event.target.value); }} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 focus:border-[#2563eb] focus:outline-none">
              <option value="">All Leave Types</option>
              {Object.keys(leaveTypeColors).map((leaveType) => <option key={leaveType} value={leaveType}>{leaveType}</option>)}
            </select>
            <button type="button" onClick={() => { setPage(1); setDepartmentFilter(""); setStatusFilter(""); setLeaveTypeFilter(""); }} className="flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </button>
            <button
              type="button"
              onClick={() => setOnlyMine((current) => !current)}
              aria-pressed={onlyMine}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition ${
                onlyMine
                  ? "border-[#2563eb] bg-blue-50 font-semibold text-[#2563eb]"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <UserRound className="h-3.5 w-3.5" />
              My Requests
            </button>
            <button type="button" onClick={() => setIsCreateOpen(true)} className="flex items-center gap-1.5 rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8]">
              <Plus className="h-3.5 w-3.5" />
              Apply for Leave
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="pb-3">Employee</th>
                <th className="pb-3">Department</th>
                <th className="pb-3">Leave Type</th>
                <th className="pb-3">From Date</th>
                <th className="pb-3">To Date</th>
                <th className="pb-3">Days</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Applied On</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableRowSkeleton rows={5} columns={9} />
              ) : error ? (
                <tr><td colSpan={9} className="py-10 text-center text-rose-600">{error}</td></tr>
              ) : tableRequests.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-gray-500">No leave requests found.</td></tr>
              ) : tableRequests.map((request) => {
                const name = request.employee_name || request.employee_id;
                const fromDate = new Date(request.start_date).toLocaleDateString();
                const toDate = new Date(request.end_date).toLocaleDateString();
                const days = request.total_days ?? countWorkingDays(request.start_date, request.end_date);
                return (
                <tr key={request.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                        {name.split(" ").map((part) => part[0]).join("")}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{name}</div>
                        <div className="text-xs text-gray-400">{request.employee_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-gray-600">{request.department_name || "-"}</td>
                  <td className="py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${leaveTypeColors[request.leave_type] || "bg-gray-50 text-gray-600"}`}>
                      {request.leave_type}
                    </span>
                  </td>
                  <td className="py-4 text-gray-600">{fromDate}</td>
                  <td className="py-4 text-gray-600">{toDate}</td>
                  <td className="py-4 text-gray-600">{days}</td>
                  <td className="py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusStyles[request.status]}`}>
                      {statusLabel[request.status]}
                    </span>
                  </td>
                  <td className="py-4 text-gray-600">{new Date(request.created_at).toLocaleDateString()}</td>
                  <td className="py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRequest(request)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
>                       <Eye className="h-3.5 w-3.5" />
                      </button>
                      {request.status === "pending" && (
                        <>
                          <button type="button" onClick={() => updateRequestStatus(request, "approved")} className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => updateRequestStatus(request, "rejected")} className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500 text-white hover:bg-rose-600">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
          <span>
            {displayTotal === 0
              ? "Showing 0 of 0 entries"
              : `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, displayTotal)} of ${displayTotal} entries`}
          </span>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Rows per page</span>

              <select
                value={pageSize}
                onChange={(event) => {
                  setPage(1);
                  setPageSize(Number(event.target.value));
                }}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 focus:border-[#2563eb] focus:outline-none"
              >
                {[5, 10, 20].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>

            {!onlyMine && (
              <div className="flex items-center gap-1.5">
                <button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 font-semibold text-gray-700">{page} / {pages}</span>
                <button type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart + Balance summary */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-gray-900">Leave Requests Overview</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-orange-400" /> Pending
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Approved
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400" /> Rejected
                </span>
              </div>
              <button className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                {leaveChartSeries.monthLabel} <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>
          <LeaveChart series={leaveChartSeries} />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Leave Balance Summary</h3>
            <button
              type="button"
              onClick={openBalanceEdit}
              className="flex items-center gap-1 text-xs font-semibold text-[#2563eb] hover:underline"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {leaveBalancesState.map((balance) => {
              const Icon = balance.icon;
              return (
                <div key={balance.label} className="rounded-2xl border border-gray-100 p-4">
                  <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${balance.iconBg}`}>
                    <Icon className={`h-4 w-4 ${balance.iconColor}`} />
                  </div>
                  <p className="text-xs text-gray-500">{balance.label}</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">
                    {balance.used}
                    <span className="text-sm font-medium text-gray-400"> / {balance.total} Days</span>
                  </p>
                  <p className="text-xs text-gray-400">Available</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Calendar + Upcoming leave + KPI cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.25fr_2fr_2fr]">
        <div className="overflow-y-auto rounded-2xl border border-gray-100 bg-white p-4 shadow-sm lg:h-[400px]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-bold text-gray-900">Leave Calendar</h3>
          </div>

          <LeaveCalendar requests={tableRequests} department="" leaveType="" />
          <div className="mt-2 flex flex-wrap gap-4 border-t border-gray-100 pt-1.5 text-xs text-gray-500">
            <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />Today</span>
            <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-orange-400" />Pending</span>
          </div>
        </div>

        <div className="min-w-0 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-4 shadow-sm lg:h-[400px]">
          <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="font-bold text-gray-900">Upcoming Leave (Next 7 Days)</h3>
            <button className="text-xs font-semibold text-[#2563eb] hover:underline">
              View All
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {tableRequests.filter((request) => request.status === "approved").slice(0, 3).map((leave) => {
              const name = leave.employee_name || leave.employee_id;
              const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

              return (
                <div key={leave.id} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-3 transition-colors hover:bg-gray-50">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-gray-900">{name}</div>
                        <div className="text-[11px] text-gray-400">{leave.employee_id}</div>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      Approved
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-[12px] text-gray-600">
                    <div className="min-w-0">
                      <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${leaveTypeColors[leave.leave_type] || "bg-gray-100 text-gray-600"}`}>
                        {leave.leave_type}
                      </span>
                      <div className="mt-1 truncate text-[11px] text-gray-500">
                        {leave.department_name || "Department not assigned"}
                      </div>
                    </div>
                    <span className="truncate font-medium text-gray-500">{leave.start_date} - {leave.end_date}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 md:col-span-2 lg:col-span-1 lg:h-[400px] [&>div]:flex-1">
          <LeaveByDepartmentKpi requests={tableRequests} />
          <LeaveByTypeKpi requests={tableRequests} />
        </div>
      </div>

      {/* Leave Request Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-[#17213a]">Leave Request</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Submitted by {selectedRequest.employee_name || selectedRequest.employee_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-6">
              {/* Employee + status */}
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                    {(selectedRequest.employee_name || selectedRequest.employee_id)
                      .split(" ")
                      .map((part) => part[0])
                      .join("")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedRequest.employee_name || selectedRequest.employee_id}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedRequest.employee_id} • {selectedRequest.department_name || "-"}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[selectedRequest.status]}`}
                >
                  {statusLabel[selectedRequest.status]}
                </span>
              </div>

              {/* Leave Type */}
              <div className="mb-4">
                <p className="mb-1 text-sm font-semibold text-gray-700">Leave Type</p>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                    leaveTypeColors[selectedRequest.leave_type] || "bg-gray-50 text-gray-600"
                  }`}
                >
                  {selectedRequest.leave_type}
                </span>
              </div>

              {/* From / To */}
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700">From Date</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(selectedRequest.start_date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">To Date</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(selectedRequest.end_date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Total Days */}
              <div className="mb-4 flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
                <div>
                  <p className="text-sm text-gray-700">Total Days</p>
                  <p className="text-xs text-gray-400">
                    Excludes Saturdays and Sundays
                  </p>
                </div>
                <span className="text-sm font-bold text-[#2563eb]">
                  {
                    selectedRequest.total_days ??
                    countWorkingDays(
                      selectedRequest.start_date,
                      selectedRequest.end_date,
                    )
                  }{" "}
                  Day(s)
                </span>
              </div>

              {/* Reason */}
              <div className="mb-4">
                <p className="mb-1 text-sm font-semibold text-gray-700">Reason</p>
                <p className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                  {selectedRequest.reason || "No reason provided."}
                </p>
              </div>

              {/* Attachment */}
              {selectedRequest.attachment_name && (
                <div className="mb-4">
                  <p className="mb-1 text-sm font-semibold text-gray-700">Attachment</p>
                  <p className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                    <Paperclip className="h-4 w-4 shrink-0 text-gray-400" />

                    <span className="truncate">{selectedRequest.attachment_name}</span>

                    {selectedRequest.attachment_size ? (
                      <span className="ml-auto shrink-0 text-xs text-gray-400">
                        {(selectedRequest.attachment_size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    ) : null}
                  </p>
                </div>
              )}

              {/* Applied On */}
              <div className="border-t border-gray-100 pt-4 text-sm text-gray-500">
                Applied on{" "}
                {new Date(selectedRequest.created_at).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>

            {/* Footer actions */}
            <div className="border-t border-gray-100 px-6 py-5">
              {selectedRequest.status === "pending" ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      updateRequestStatus(selectedRequest, "rejected");
                      setSelectedRequest(null);
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateRequestStatus(selectedRequest, "approved");
                      setSelectedRequest(null);
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </button>
                </div>
              ) : (
                <div
                  className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${statusStyles[selectedRequest.status]}`}
                >
                  {selectedRequest.status === "approved" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  This request has been {statusLabel[selectedRequest.status].toLowerCase()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <NewLeaveRequestModal
          onClose={() => setIsCreateOpen(false)}
          onSubmit={createRequest}
        />
      )}

      {isBalanceEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Edit Leave Balances
                </h3>

                <p className="mt-0.5 text-xs text-gray-500">
                  Set the days used and total days per leave type.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsBalanceEditOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {leaveBalancesState.map((balance) => (
                <div key={balance.label} className="rounded-xl border border-gray-100 p-3">
                  <p className="mb-2 text-sm font-semibold text-gray-800">
                    {balance.label}
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">
                        Days used
                      </label>

                      <input
                        type="number"
                        min={0}
                        value={balanceDraft[balance.label]?.used ?? balance.used}
                        onChange={(event) =>
                          setBalanceDraft((current) => ({
                            ...current,
                            [balance.label]: {
                              total: current[balance.label]?.total ?? balance.total,
                              used: Number(event.target.value),
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">
                        Total days
                      </label>

                      <input
                        type="number"
                        min={0}
                        value={balanceDraft[balance.label]?.total ?? balance.total}
                        onChange={(event) =>
                          setBalanceDraft((current) => ({
                            ...current,
                            [balance.label]: {
                              used: current[balance.label]?.used ?? balance.used,
                              total: Number(event.target.value),
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBalanceEditOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveBalanceEdit}
                className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminLeave;
