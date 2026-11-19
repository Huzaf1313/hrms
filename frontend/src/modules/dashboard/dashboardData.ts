/**
 * Admin dashboard view models and utilities.
 */

export interface DepartmentShare {
  label: string;
  value: number;
  color: string;
}

export interface QuickActionItem {
  id: string;
  label: string;
  icon: "user-plus" | "briefcase" | "calendar-check" | "clock" | "wallet" | "megaphone";
  iconClass: string;
  chipClass: string;
}

/** Donut palette, reused when department counts arrive. */
export const DEPARTMENT_COLORS = [
  "#2563eb",
  "#22c55e",
  "#f0b429",
  "#f97316",
  "#a855f7",
  "#06b6d4",
  "#cbd5e1",
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
