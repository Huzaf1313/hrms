import { useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

// TODO: replace all mock data below with real API calls once the backend
// Leave module exists - follow the same repository/service/router pattern
// used for Attendance (app/repositories/leave_repository.py,
// app/services/leave_service.py, app/api/v1/leave.py).

type LeaveStatus = "pending" | "approved" | "rejected";

interface LeaveRequest {
  id: string;
  name: string;
  employeeCode: string;
  department: string;
  leaveType: string;
  leaveTypeColor: string;
  fromDate: string;
  toDate: string;
  days: number;
  status: LeaveStatus;
  appliedOn: string;
}

const statCards = [
  {
    label: "Total Leave Requests",
    value: "128",
    sub: "This Month",
    icon: CalendarDays,
    iconBg: "bg-blue-500",
  },
  {
    label: "Pending Requests",
    value: "28",
    sub: "Awaiting Approval",
    icon: Clock,
    iconBg: "bg-orange-500",
  },
  {
    label: "Approved Requests",
    value: "86",
    sub: "This Month",
    icon: CheckCircle2,
    iconBg: "bg-emerald-500",
  },
  {
    label: "Rejected Requests",
    value: "14",
    sub: "This Month",
    icon: XCircle,
    iconBg: "bg-rose-500",
  },
  {
    label: "On Leave Today",
    value: "18",
    sub: "Employees",
    icon: UserRound,
    iconBg: "bg-violet-500",
  },
  {
    label: "Upcoming Leaves",
    value: "32",
    sub: "Next 7 Days",
    icon: CalendarClock,
    iconBg: "bg-teal-500",
  },
];

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

const leaveTypeColors: Record<string, string> = {
  "Casual Leave": "bg-emerald-50 text-emerald-600",
  "Sick Leave": "bg-blue-50 text-blue-600",
  "Earned Leave": "bg-orange-50 text-orange-500",
  "Comp Off": "bg-violet-50 text-violet-600",
};

const leaveRequests: LeaveRequest[] = [
  {
    id: "1",
    name: "Sneha Patil",
    employeeCode: "EMP004",
    department: "Engineering",
    leaveType: "Casual Leave",
    leaveTypeColor: leaveTypeColors["Casual Leave"],
    fromDate: "24 May 2024",
    toDate: "25 May 2024",
    days: 2,
    status: "pending",
    appliedOn: "22 May 2024",
  },
  {
    id: "2",
    name: "Rahul Sharma",
    employeeCode: "EMP001",
    department: "Engineering",
    leaveType: "Sick Leave",
    leaveTypeColor: leaveTypeColors["Sick Leave"],
    fromDate: "23 May 2024",
    toDate: "23 May 2024",
    days: 1,
    status: "pending",
    appliedOn: "22 May 2024",
  },
  {
    id: "3",
    name: "Priya Singh",
    employeeCode: "EMP002",
    department: "HR",
    leaveType: "Earned Leave",
    leaveTypeColor: leaveTypeColors["Earned Leave"],
    fromDate: "20 May 2024",
    toDate: "20 May 2024",
    days: 3,
    status: "approved",
    appliedOn: "18 May 2024",
  },
  {
    id: "4",
    name: "Amit Kumar",
    employeeCode: "EMP003",
    department: "Sales",
    leaveType: "Casual Leave",
    leaveTypeColor: leaveTypeColors["Casual Leave"],
    fromDate: "17 May 2024",
    toDate: "17 May 2024",
    days: 1,
    status: "rejected",
    appliedOn: "16 May 2024",
  },
  {
    id: "5",
    name: "Vikram Joshi",
    employeeCode: "EMP005",
    department: "Marketing",
    leaveType: "Comp Off",
    leaveTypeColor: leaveTypeColors["Comp Off"],
    fromDate: "27 May 2024",
    toDate: "27 May 2024",
    days: 1,
    status: "approved",
    appliedOn: "21 May 2024",
  },
];

const upcomingLeaves = [
  {
    name: "Rahul Sharma",
    employeeCode: "EMP001",
    leaveType: "Casual Leave",
    leaveTypeColor: leaveTypeColors["Casual Leave"],
    range: "24 May 2024 - 25 May 2024",
    days: "2 Days",
  },
  {
    name: "Priya Singh",
    employeeCode: "EMP002",
    leaveType: "Earned Leave",
    leaveTypeColor: leaveTypeColors["Earned Leave"],
    range: "26 May 2024 - 28 May 2024",
    days: "3 Days",
  },
];

const statusStyles: Record<LeaveStatus, string> = {
  pending: "bg-orange-50 text-orange-500",
  approved: "bg-emerald-50 text-emerald-600",
  rejected: "bg-rose-50 text-rose-600",
};

const statusLabel: Record<LeaveStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

// --- Line chart (pure SVG, no external chart library required) --------

const chartDates = ["1 May", "6 May", "11 May", "16 May", "21 May", "26 May", "31 May"];
const chartSeries = {
  pending: [12, 20, 15, 28, 18, 30, 22],
  approved: [8, 14, 10, 18, 12, 20, 16],
  rejected: [3, 5, 4, 8, 5, 9, 6],
};

function LeaveChart() {
  const width = 720;
  const height = 220;
  const paddingLeft = 32;
  const paddingBottom = 24;
  const maxY = 40;
  const points = chartSeries.pending.length;

  const xFor = (index: number) =>
    paddingLeft + (index * (width - paddingLeft)) / (points - 1);
  const yFor = (value: number) =>
    height - paddingBottom - (value / maxY) * (height - paddingBottom);

  const toPath = (values: number[]) =>
    values.map((value, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(value)}`).join(" ");

  const toArea = (values: number[]) =>
    `${toPath(values)} L ${xFor(values.length - 1)} ${height - paddingBottom} L ${xFor(0)} ${height - paddingBottom} Z`;

  const series = [
    { key: "pending", color: "#f97316", values: chartSeries.pending },
    { key: "approved", color: "#10b981", values: chartSeries.approved },
    { key: "rejected", color: "#f43f5e", values: chartSeries.rejected },
  ];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 240 }}>
      {[0, 10, 20, 30, 40].map((value) => (
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

      {series.map((line) => (
        <path key={`${line.key}-area`} d={toArea(line.values)} fill={line.color} opacity={0.08} />
      ))}
      {series.map((line) => (
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

      {chartDates.map((label, index) => (
        <text
          key={label}
          x={xFor(index)}
          y={height - 4}
          fontSize={11}
          fill="#9ca3af"
          textAnchor="middle"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

// --- Month calendar grid ------------------------------------------------

type DayDot = "pending" | "approved" | "rejected";

const dotColor: Record<DayDot, string> = {
  pending: "bg-orange-400",
  approved: "bg-emerald-400",
  rejected: "bg-rose-400",
};

// May 2024 starts on Wednesday; 29-30 April are leading days from the prior month.
const calendarWeeks: { day: number; muted?: boolean; dots?: DayDot[] }[][] = [
  [
    { day: 29, muted: true },
    { day: 30, muted: true },
    { day: 1 },
    { day: 2 },
    { day: 3 },
    { day: 4 },
    { day: 5 },
  ],
  [
    { day: 6 },
    { day: 7, dots: ["approved"] },
    { day: 8, dots: ["rejected"] },
    { day: 9 },
    { day: 10 },
    { day: 11, dots: ["approved"] },
    { day: 12 },
  ],
  [
    { day: 13 },
    { day: 14 },
    { day: 15, dots: ["approved"] },
    { day: 16 },
    { day: 17, dots: ["approved"] },
    { day: 18, dots: ["rejected"] },
    { day: 19, dots: ["approved"] },
  ],
];

function LeaveCalendar() {
  return (
    <div className="grid grid-cols-7 gap-y-3 text-center">
      {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
        <div key={day} className="text-xs font-semibold text-gray-400">
          {day}
        </div>
      ))}

      {calendarWeeks.map((week, weekIndex) =>
        week.map((cell) => (
          <div key={`${weekIndex}-${cell.day}`} className="flex flex-col items-center gap-1 py-1">
            <span className={`text-sm ${cell.muted ? "text-gray-300" : "text-gray-700"}`}>
              {cell.day}
            </span>
            <div className="flex h-1.5 items-center gap-0.5">
              {(cell.dots ?? []).map((dot, index) => (
                <span key={index} className={`h-1.5 w-1.5 rounded-full ${dotColor[dot]}`} />
              ))}
            </div>
          </div>
        )),
      )}
    </div>
  );
}

// -------------------------------------------------------------------------

function Leave() {
  const [departmentFilter, setDepartmentFilter] = useState("");

  return (
    <div className="px-10 pb-10 pt-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Leave Management</h1>
          <p className="mt-1 text-gray-500">
            Track, review, and manage employee leave requests.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-3xl bg-white p-5 shadow-sm">
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <div className="mt-1 text-2xl font-bold text-gray-900">{card.value}</div>
              <p className="mt-1 text-xs text-gray-400">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Chart + Balance summary */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="rounded-3xl bg-white p-6 shadow-sm lg:col-span-3">
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
                This Month <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>
          <LeaveChart />
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Leave Balance Summary</h3>
            <button className="text-xs font-semibold text-[#456b54] hover:underline">
              View All
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {leaveBalances.map((balance) => {
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

      {/* Recent Leave Requests */}
      <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-gray-900">Recent Leave Requests</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 focus:border-[#456b54] focus:outline-none"
            >
              <option value="">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="HR">HR</option>
              <option value="Sales">Sales</option>
              <option value="Marketing">Marketing</option>
            </select>
            <button className="flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </button>
            <button className="flex items-center gap-1.5 rounded-full bg-[#456b54] px-4 py-2 text-sm font-semibold text-white hover:bg-[#385b46]">
              <Plus className="h-3.5 w-3.5" />
              New Request
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
              {leaveRequests.map((request) => (
                <tr key={request.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                        {request.name.split(" ").map((part) => part[0]).join("")}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{request.name}</div>
                        <div className="text-xs text-gray-400">{request.employeeCode}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-gray-600">{request.department}</td>
                  <td className="py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${request.leaveTypeColor}`}>
                      {request.leaveType}
                    </span>
                  </td>
                  <td className="py-4 text-gray-600">{request.fromDate}</td>
                  <td className="py-4 text-gray-600">{request.toDate}</td>
                  <td className="py-4 text-gray-600">{request.days}</td>
                  <td className="py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusStyles[request.status]}`}>
                      {statusLabel[request.status]}
                    </span>
                  </td>
                  <td className="py-4 text-gray-600">{request.appliedOn}</td>
                  <td className="py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {request.status === "pending" && (
                        <>
                          <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500 text-white hover:bg-rose-600">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
          <span>Showing 1 to {leaveRequests.length} of 128 entries</span>
          <div className="flex items-center gap-1.5">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#456b54] font-semibold text-white">
              1
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              2
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              3
            </button>
            <span className="px-1 text-gray-400">...</span>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              26
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar + Upcoming leave */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="rounded-3xl bg-white p-6 shadow-sm lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Leave Calendar (May 2024)</h3>
            <button className="text-xs font-semibold text-[#456b54] hover:underline">
              View Full Calendar
            </button>
          </div>
          <LeaveCalendar />
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Upcoming Leave (Next 7 Days)</h3>
            <button className="text-xs font-semibold text-[#456b54] hover:underline">
              View All
            </button>
          </div>
          <div className="flex flex-col gap-4">
            {upcomingLeaves.map((leave) => (
              <div key={leave.employeeCode} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                    {leave.name.split(" ").map((part) => part[0]).join("")}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{leave.name}</div>
                    <div className="text-xs text-gray-400">{leave.employeeCode}</div>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${leave.leaveTypeColor}`}>
                      {leave.leaveType}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">{leave.range}</div>
                  <div className="text-xs font-semibold text-gray-700">{leave.days}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Leave;