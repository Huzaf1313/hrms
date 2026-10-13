/**
 * Admin dashboard view models.
 *
 * The dashboard is built frontend-only for now, so every value below is a
 * deterministic placeholder. Each shape maps 1:1 to the endpoint that will
 * eventually back it, so swapping a placeholder for a live fetch means
 * replacing the constant in `dashboardPlaceholders` and nothing else.
 */

export interface AttendancePoint {
  day: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
}

export interface RecruitmentStage {
  label: string;
  value: number;
  color: string;
}

export interface DepartmentShare {
  label: string;
  value: number;
  color: string;
}

export interface InterviewRow {
  id: string;
  candidateName: string;
  position: string;
  dateLabel: string;
  timeLabel: string;
}

export interface ActivityRow {
  id: string;
  text: string;
  timeLabel: string;
}

export interface QuickActionItem {
  id: string;
  label: string;
  icon: "user-plus" | "briefcase" | "calendar-check" | "clock" | "wallet" | "megaphone";
  iconClass: string;
  chipClass: string;
}

export interface PayrollSummary {
  payrollThisMonth: number;
  payrollChangePercent: number;
  totalExpenses: number;
  expenseChangePercent: number;
}

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** 1 May – 31 May, matching the month shown in the attendance chart. */
const CHART_MONTH_INDEX = 4;
const CHART_DAYS = 31;

function buildAttendanceSeries(): AttendancePoint[] {
  return Array.from({ length: CHART_DAYS }, (_, index) => {
    const day = index + 1;

    // Deterministic wobble so the chart reads like real headcount noise
    // instead of a flat line, without any randomness between renders.
    const wave = Math.sin(day / 2.4) * 14;
    const drift = day * 1.6;

    return {
      day,
      present: Math.round(168 + wave + drift),
      late: Math.round(48 + Math.sin(day / 1.7) * 9),
      absent: Math.round(22 + Math.cos(day / 2.1) * 6),
      onLeave: Math.round(12 + Math.sin(day / 3.1) * 4),
    };
  });
}

export const attendanceSeries = buildAttendanceSeries();

export const attendanceMonthLabel = `${MONTH_LABELS[CHART_MONTH_INDEX]} 2024`;

export const attendanceMonthOptions = [
  `${MONTH_LABELS[3]} 2024`,
  `${MONTH_LABELS[4]} 2024`,
  `${MONTH_LABELS[5]} 2024`,
];

export const recruitmentStages: RecruitmentStage[] = [
  { label: "Applied", value: 82, color: "#2563eb" },
  { label: "Screening", value: 56, color: "#22c55e" },
  { label: "Shortlisted", value: 34, color: "#f0b429" },
  { label: "Interview", value: 22, color: "#f97316" },
  { label: "Selected", value: 12, color: "#ef4444" },
  { label: "Offer", value: 8, color: "#8b5cf6" },
  { label: "Hired", value: 5, color: "#4338ca" },
];

/** Donut palette, reused when real department counts arrive. */
export const DEPARTMENT_COLORS = [
  "#2563eb",
  "#22c55e",
  "#f0b429",
  "#f97316",
  "#a855f7",
  "#06b6d4",
  "#cbd5e1",
];

export const departmentShares: DepartmentShare[] = [
  { label: "Engineering", value: 82, color: DEPARTMENT_COLORS[0] },
  { label: "Sales", value: 56, color: DEPARTMENT_COLORS[1] },
  { label: "HR", value: 28, color: DEPARTMENT_COLORS[2] },
  { label: "Finance", value: 24, color: DEPARTMENT_COLORS[3] },
  { label: "Marketing", value: 20, color: DEPARTMENT_COLORS[4] },
  { label: "Support", value: 15, color: DEPARTMENT_COLORS[5] },
  { label: "Others", value: 20, color: DEPARTMENT_COLORS[6] },
];

export const interviewRows: InterviewRow[] = [
  {
    id: "interview-1",
    candidateName: "Sneha Desai",
    position: "Frontend Developer",
    dateLabel: "20 May 2024",
    timeLabel: "10:00 AM",
  },
  {
    id: "interview-2",
    candidateName: "Rohit Mehta",
    position: "Backend Developer",
    dateLabel: "21 May 2024",
    timeLabel: "02:00 PM",
  },
  {
    id: "interview-3",
    candidateName: "Pooja Sharma",
    position: "UI/UX Designer",
    dateLabel: "22 May 2024",
    timeLabel: "11:00 AM",
  },
  {
    id: "interview-4",
    candidateName: "Karan Singh",
    position: "DevOps Engineer",
    dateLabel: "23 May 2024",
    timeLabel: "03:00 PM",
  },
  {
    id: "interview-5",
    candidateName: "Anjali Yadav",
    position: "QA Engineer",
    dateLabel: "24 May 2024",
    timeLabel: "11:30 AM",
  },
];

export const activityRows: ActivityRow[] = [
  { id: "act-1", text: "Rahul Sharma applied for Casual Leave (20 May – 21 May)", timeLabel: "10 min ago" },
  { id: "act-2", text: "New employee Priya Singh onboarded", timeLabel: "30 min ago" },
  { id: "act-3", text: "Payroll processed for May 2024", timeLabel: "1 hour ago" },
  { id: "act-4", text: "Interview scheduled for Sneha Desai", timeLabel: "2 hours ago" },
  { id: "act-5", text: "Leave request approved for Ankit Gupta", timeLabel: "3 hours ago" },
];

export const quickActions: QuickActionItem[] = [
  { id: "qa-1", label: "Add Employee", icon: "user-plus", iconClass: "text-[#2563eb]", chipClass: "bg-[#eff6ff]" },
  { id: "qa-2", label: "Create Job", icon: "briefcase", iconClass: "text-[#7c3aed]", chipClass: "bg-[#f5f3ff]" },
  { id: "qa-3", label: "Apply Leave on Behalf", icon: "calendar-check", iconClass: "text-[#16a34a]", chipClass: "bg-[#ecfdf5]" },
  { id: "qa-4", label: "Mark Attendance", icon: "clock", iconClass: "text-[#ea580c]", chipClass: "bg-[#fff7ed]" },
  { id: "qa-5", label: "Process Payroll", icon: "wallet", iconClass: "text-[#dc2626]", chipClass: "bg-[#fef2f2]" },
  { id: "qa-6", label: "Schedule Interview", icon: "calendar-check", iconClass: "text-[#db2777]", chipClass: "bg-[#fdf2f8]" },
  { id: "qa-7", label: "Add Announcement", icon: "megaphone", iconClass: "text-[#2563eb]", chipClass: "bg-[#eff6ff]" },
  { id: "qa-8", label: "Generate Report", icon: "briefcase", iconClass: "text-[#059669]", chipClass: "bg-[#ecfdf5]" },
];

export const payrollSummary: PayrollSummary = {
  payrollThisMonth: 12475000,
  payrollChangePercent: 6.2,
  totalExpenses: 1845320,
  expenseChangePercent: 3.4,
};

export const dashboardPlaceholders = {
  totalEmployees: 245,
  employeesAddedThisMonth: 12,
  presentToday: 218,
  presentPercent: 89,
  onLeaveToday: 12,
  onLeavePercent: 4.9,
  openPositions: 5,
  pendingLeaveRequests: 8,
};

export function initialsFor(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function formatIndianAmount(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}