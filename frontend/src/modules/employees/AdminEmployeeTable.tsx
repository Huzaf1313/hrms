import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  MoreVertical,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";

import { Avatar } from "../../components/ui/Avatar";
import { StatusPill } from "../../components/ui/Badge";
import type { Department } from "../departments/types";
import type { Employee } from "./types";

interface AdminEmployeeTableProps {
  employees: Employee[];
  departments: Department[];
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDeactivate: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  onClearFilters?: () => void;
}

type SortKey =
  | "employee"
  | "employee_id"
  | "department"
  | "designation"
  | "status"
  | "joining_date";

type SortDirection = "asc" | "desc";

function departmentLabel(employee: Employee, departments: Department[]): string {
  return departments.find((item) => item.id === employee.department_id)?.name ||
    employee.department_id ||
    "—";
}

function sortValue(employee: Employee, key: SortKey, departments: Department[]): string {
  switch (key) {
    case "employee":
      return `${employee.first_name} ${employee.last_name}`.toLowerCase();
    case "employee_id":
      return employee.employee_id.toLowerCase();
    case "department":
      return departmentLabel(employee, departments).toLowerCase();
    case "designation":
      return (employee.designation || "").toLowerCase();
    case "status":
      return employee.status;
    case "joining_date":
      return employee.joining_date || "";
  }
}

function SortButton({
  label,
  value,
  sortKey,
  sortDirection,
  onSort,
}: {
  label: string;
  value: SortKey;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const isActive = sortKey === value;
  const Icon = !isActive ? ArrowUpDown : sortDirection === "asc" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={() => onSort(value)}
      className="inline-flex items-center gap-1 text-left text-[12px] font-medium text-[#6B7280] hover:text-[#111827]"
    >
      {label}
      <Icon className={`h-3.5 w-3.5 ${isActive ? "text-[#2563EB]" : "text-[#9CA3AF]"}`} />
    </button>
  );
}

function formatJoiningDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function displayValue(value: string | null | undefined): string {
  return value?.trim() || "—";
}

export default function AdminEmployeeTable({
  employees,
  departments,
  onView,
  onEdit,
  onDeactivate,
  onDelete,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  onClearFilters,
}: AdminEmployeeTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  const sortedEmployees = useMemo(() => {
    if (!sortKey) return employees;

    return [...employees].sort((left, right) => {
      const comparison = sortValue(left, sortKey, departments).localeCompare(sortValue(right, sortKey, departments), undefined, {
        numeric: true,
      });
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [employees, sortDirection, sortKey, departments]);

  const allSelected =
    employees.length > 0 && employees.every((employee) => selectedIds.includes(employee.id));

  if (employees.length === 0) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6] text-[#6B7280]">
          <Eye className="h-5 w-5" />
        </div>
        <h3 className="mt-3 text-[14px] font-semibold text-[#111827]">No employees found</h3>
        <p className="mt-1 text-[12px] text-[#6B7280]">
          Try changing your search or filters.
        </p>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-3 text-[12px] font-medium text-[#2563EB] hover:underline"
          >
            Clear Filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-left">
        <thead className="h-11 bg-[#F9FAFB]">
          <tr className="border-b border-[#E5E7EB]">
            <th className="w-12 px-4">
              <input
                type="checkbox"
                aria-label="Select all employees"
                checked={allSelected}
                onChange={onToggleSelectAll}
                className="h-4 w-4 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB]"
              />
            </th>
            <th className="px-4"><SortButton label="Employee" value="employee" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} /></th>
            <th className="px-4"><SortButton label="Employee ID" value="employee_id" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} /></th>
            <th className="px-4"><SortButton label="Department" value="department" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} /></th>
            <th className="px-4"><SortButton label="Designation" value="designation" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} /></th>
            <th className="px-4"><SortButton label="Status" value="status" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} /></th>
            <th className="px-4"><SortButton label="Joining Date" value="joining_date" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} /></th>
            <th className="px-4 text-right text-[12px] font-medium text-[#6B7280]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E7EB]">
          {sortedEmployees.map((employee) => {
            const fullName = `${employee.first_name} ${employee.last_name}`.trim() || "Employee";
            const isSelected = selectedIds.includes(employee.id);

            return (
              <tr
                key={employee.id}
                className={`h-[60px] transition-colors hover:bg-[#F9FAFB] ${isSelected ? "bg-[#EFF6FF]" : "bg-white"}`}
              >
                <td className="px-4">
                  <input
                    type="checkbox"
                    aria-label={`Select ${fullName}`}
                    checked={isSelected}
                    onChange={() => onToggleSelect?.(employee.id)}
                    className="h-4 w-4 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB]"
                  />
                </td>
                <td className="px-4">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={fullName}
                      src={employee.avatar_url}
                      size="md"
                      className="!h-9 !w-9"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-[#111827]">{fullName}</p>
                      <p className="mt-0.5 max-w-[220px] truncate text-[12px] text-[#6B7280]">
                        {employee.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 font-mono text-[12px] text-[#6B7280]">{employee.employee_id}</td>
                <td className="px-4 text-[13px] text-[#374151]">{departmentLabel(employee, departments)}</td>
                <td className="px-4 text-[13px] text-[#374151]">{displayValue(employee.designation)}</td>
                <td className="px-4">
                  {employee.status === "active" ? (
                    <StatusPill variant="ok" size="sm">Active</StatusPill>
                  ) : employee.status === "on_leave" ? (
                    <StatusPill variant="warn" size="sm">On Leave</StatusPill>
                  ) : (
                    <StatusPill variant="off" size="sm">Inactive</StatusPill>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 text-[13px] text-[#6B7280]">
                  {formatJoiningDate(employee.joining_date)}
                </td>
                <td className="px-4">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onView(employee)}
                      aria-label={`View ${fullName}`}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[#6B7280] transition hover:bg-[#EFF6FF] hover:text-[#2563EB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={`More actions for ${fullName}`}
                        onClick={() => setOpenMenuId((current) => (current === employee.id ? null : employee.id))}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {openMenuId === employee.id && (
                        <div className="absolute right-0 top-9 z-30 w-36 rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg">
                          <button type="button" onClick={() => { setOpenMenuId(null); onView(employee); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[#374151] hover:bg-[#F9FAFB]">
                            <Eye className="h-3.5 w-3.5" /> View
                          </button>
                          <button type="button" onClick={() => { setOpenMenuId(null); onEdit(employee); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[#374151] hover:bg-[#F9FAFB]">
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button type="button" onClick={() => { setOpenMenuId(null); onDeactivate(employee); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[#374151] hover:bg-[#F9FAFB]">
                            {employee.status === "active" ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                            {employee.status === "active" ? "Deactivate" : "Activate"}
                          </button>
                          <div className="my-1 border-t border-[#F3F4F6]" />
                          <button type="button" onClick={() => { setOpenMenuId(null); onDelete(employee); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[#B91C1C] hover:bg-[#FEF2F2]">
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
