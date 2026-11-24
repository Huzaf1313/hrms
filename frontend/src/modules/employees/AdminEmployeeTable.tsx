import { useState } from "react";
import {
  Eye,
  MoreVertical,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";

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
}

const AVATAR_COLORS = [
  "bg-[#0066ff] text-white", // Blue (AM)
  "bg-[#7c3aed] text-white", // Purple (SU)
  "bg-[#16a34a] text-white", // Green (RK)
  "bg-[#f97316] text-white", // Orange (PS)
  "bg-[#8b5cf6] text-white", // Violet (AK)
  "bg-[#0284c7] text-white",
  "bg-[#ea580c] text-white",
];

function getAvatarColor(index: number, name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
  }
  return AVATAR_COLORS[Math.abs(hash + index) % AVATAR_COLORS.length];
}

function initialsFor(employee: Employee): string {
  const first = employee.first_name?.charAt(0) ?? "";
  const last = employee.last_name?.charAt(0) ?? "";
  return `${first}${last}`.toUpperCase() || "EM";
}

function formatJoiningDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
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
}: AdminEmployeeTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  function departmentName(employee: Employee): string {
    const dept = departments.find((d) => d.id === employee.department_id);
    if (dept) return dept.name;

    // Fallback based on common mock IDs or designations
    if (employee.department_id === "dep-dev" || employee.designation?.toLowerCase().includes("engineer")) {
      return "Development";
    }
    if (employee.department_id === "dep-mkt" || employee.designation?.toLowerCase().includes("market")) {
      return "Marketing";
    }
    if (employee.department_id === "dep-hr" || employee.designation?.toLowerCase().includes("hr")) {
      return "HR";
    }
    if (employee.department_id === "dep-sales" || employee.designation?.toLowerCase().includes("sales")) {
      return "Sales";
    }
    return employee.department_id || "Development";
  }

  const allSelected =
    employees.length > 0 && employees.every((e) => selectedIds.includes(e.id));

  if (employees.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
        No employees found matching the criteria.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[850px] border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-100 bg-transparent text-xs font-bold text-slate-800">
            <th className="py-4 pl-6 pr-3 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 text-[#0066ff] focus:ring-[#0066ff] cursor-pointer"
              />
            </th>
            <th className="py-4 px-4 font-bold text-slate-800">Employee</th>
            <th className="py-4 px-4 font-bold text-slate-800">Employee ID</th>
            <th className="py-4 px-4 font-bold text-slate-800">Department</th>
            <th className="py-4 px-4 font-bold text-slate-800">Designation</th>
            <th className="py-4 px-4 font-bold text-slate-800">Status</th>
            <th className="py-4 px-4 font-bold text-slate-800">Joining Date</th>
            <th className="py-4 pr-6 pl-4 font-bold text-slate-800 text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100/90 text-xs">
          {employees.map((employee, index) => {
            const isSelected = selectedIds.includes(employee.id);
            const fullName = `${employee.first_name} ${employee.last_name}`.trim();
            const avatarColor = getAvatarColor(index, fullName);

            return (
              <tr
                key={employee.id}
                className="group transition-colors duration-150 hover:bg-slate-50/60"
              >
                {/* Checkbox */}
                <td className="py-4 pl-6 pr-3 w-10">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect?.(employee.id)}
                    className="h-4 w-4 rounded border-slate-300 text-[#0066ff] focus:ring-[#0066ff] cursor-pointer"
                  />
                </td>

                {/* Employee Name & Avatar & Email */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    {employee.avatar_url ? (
                      <img
                        src={employee.avatar_url}
                        alt={fullName}
                        className="h-9 w-9 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-2xs ${avatarColor}`}
                      >
                        {initialsFor(employee)}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="font-bold text-[#0f172a] leading-tight">
                        {fullName}
                      </p>
                      <p className="text-[11px] font-normal text-slate-400 mt-0.5 truncate">
                        {employee.email}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Employee ID */}
                <td className="py-4 px-4 font-medium text-slate-700 whitespace-nowrap">
                  {employee.employee_id}
                </td>

                {/* Department */}
                <td className="py-4 px-4 font-medium text-slate-700 whitespace-nowrap">
                  {departmentName(employee)}
                </td>

                {/* Designation */}
                <td className="py-4 px-4 font-medium text-slate-700 whitespace-nowrap">
                  {employee.designation}
                </td>

                {/* Status Badge */}
                <td className="py-4 px-4 whitespace-nowrap">
                  {employee.status === "active" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-100">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  ) : employee.status === "on_leave" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200/70">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      On Leave
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      Inactive
                    </span>
                  )}
                </td>

                {/* Joining Date */}
                <td className="py-4 px-4 font-medium text-slate-700 whitespace-nowrap">
                  {formatJoiningDate(employee.joining_date)}
                </td>

                {/* Actions: View + ⋮ */}
                <td className="py-4 pr-6 pl-4 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onView(employee)}
                      className="text-xs font-semibold text-slate-800 transition hover:text-[#0066ff] hover:underline"
                    >
                      View
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        aria-label="More actions"
                        onClick={() =>
                          setOpenMenuId((current) =>
                            current === employee.id ? null : employee.id,
                          )
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {openMenuId === employee.id && (
                        <div
                          className="absolute right-0 top-8 z-30 w-36 rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl transition-all"
                          onMouseLeave={() => setOpenMenuId(null)}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onView(employee);
                            }}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-500" />
                            <span>View Details</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onEdit(employee);
                            }}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Pencil className="h-3.5 w-3.5 text-slate-500" />
                            <span>Edit</span>
                          </button>

                          {employee.status === "active" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onDeactivate(employee);
                              }}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-amber-700 hover:bg-amber-50"
                            >
                              <UserX className="h-3.5 w-3.5 text-amber-600" />
                              <span>Deactivate</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onDeactivate(employee);
                              }}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                            >
                              <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Activate</span>
                            </button>
                          )}

                          <div className="my-1 border-t border-slate-100" />

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onDelete(employee);
                            }}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                            <span>Delete</span>
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
