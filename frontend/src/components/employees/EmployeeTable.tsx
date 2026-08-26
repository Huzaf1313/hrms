import { useState } from "react";
import {
  Eye,
  Pencil,
  EllipsisVertical,
  UserX,
  Trash2,
} from "lucide-react";

import type { Department } from "../../types/department";
import type { Employee } from "../../types/employee";

interface EmployeeTableProps {
  employees: Employee[];
  departments: Department[];
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDeactivate: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "on_leave":
      return "bg-orange-100 text-orange-700";
    case "inactive":
      return "bg-stone-100 text-stone-700";
    case "terminated":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function statusLabel(status: string): string {
  if (status === "on_leave") {
    return "On Leave";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function initialsFor(employee: Employee): string {
  const first = employee.first_name?.charAt(0) ?? "";
  const last = employee.last_name?.charAt(0) ?? "";

  return `${first}${last}`.toUpperCase() || "?";
}

function EmployeeTable({
  employees,
  departments,
  onView,
  onEdit,
  onDeactivate,
  onDelete,
}: EmployeeTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  function departmentName(departmentId: string): string {
    return (
      departments.find((department) => department.id === departmentId)?.name ??
      "—"
    );
  }

  if (employees.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-500">
        No employees found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {employees.map((employee) => (
        <div
          key={employee.id}
          className="relative rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
        >
          {/* Employee Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dce8df] text-sm font-semibold text-[#2563eb]">
                {initialsFor(employee)}
              </div>

              {/* Name + ID */}
              <div>
                <p className="font-semibold text-gray-800">
                  {employee.first_name} {employee.last_name}
                </p>

                <p className="text-xs text-gray-500">
                  ID: {employee.employee_id}
                </p>
              </div>
            </div>

            {/* More Actions */}
            <div className="relative">
              <button
                type="button"
                aria-label="More actions"
                onClick={() =>
                  setOpenMenuId((current) =>
                    current === employee.id ? null : employee.id,
                  )
                }
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-50 hover:text-gray-600"
              >
                <EllipsisVertical size={18} strokeWidth={2} />
              </button>

              {/* Dropdown */}
              {openMenuId === employee.id && (
                <div className="absolute right-0 top-9 z-10 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white text-sm shadow-lg">
                  {/* Deactivate */}
                  {employee.status === "active" && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuId(null);
                        onDeactivate(employee);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-stone-600 transition hover:bg-gray-50"
                    >
                      <UserX size={16} strokeWidth={2} />
                      <span>Deactivate</span>
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenuId(null);
                      onDelete(employee);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 size={16} strokeWidth={2} />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Employee Information */}
          <div className="mt-4 space-y-2 text-sm">
            {/* Role */}
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Role</span>

              <span className="font-medium text-gray-800">
                {employee.designation}
              </span>
            </div>

            {/* Department */}
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Department</span>

              <span className="font-medium text-gray-800">
                {departmentName(employee.department_id)}
              </span>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Status</span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(
                  employee.status,
                )}`}
              >
                {statusLabel(employee.status)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 flex gap-2">
            {/* View */}
            <button
              type="button"
              onClick={() => onView(employee)}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
            >
              <Eye size={15} strokeWidth={2} />
              <span>View</span>
            </button>

            {/* Edit */}
            <button
              type="button"
              onClick={() => onEdit(employee)}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
            >
              <Pencil size={15} strokeWidth={2} />
              <span>Edit</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default EmployeeTable;
