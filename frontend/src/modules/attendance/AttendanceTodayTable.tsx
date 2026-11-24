import { useState } from "react";
import { MoreVertical } from "lucide-react";
import type { AttendanceRecord } from "./types";

interface AttendanceTodayTableProps {
  records: AttendanceRecord[];
  selectedIds?: Set<string> | string[];
  onToggleSelect?: (id: string) => void;
  onToggleSelectRow?: (id: string) => void;
  onToggleSelectAll?: () => void;
  onViewDetail?: (record: AttendanceRecord) => void;
  onActionClick?: (record: AttendanceRecord, action: string) => void;
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

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "EM";
}

export default function AttendanceTodayTable({
  records,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectRow,
  onToggleSelectAll,
  onViewDetail,
  onActionClick,
}: AttendanceTodayTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const checkIsSelected = (id: string) => {
    if (!selectedIds) return false;
    return selectedIds instanceof Set ? selectedIds.has(id) : selectedIds.includes(id);
  };

  const allSelected =
    records.length > 0 && records.every((r) => checkIsSelected(r.id));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
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
            <th className="py-4 px-4 font-bold text-slate-800">Department</th>
            <th className="py-4 px-4 font-bold text-slate-800">Designation</th>
            <th className="py-4 px-4 font-bold text-slate-800">Check In</th>
            <th className="py-4 px-4 font-bold text-slate-800">Check Out</th>
            <th className="py-4 px-4 font-bold text-slate-800">Status</th>
            <th className="py-4 pr-6 pl-4 font-bold text-slate-800 text-right">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100/90 text-xs">
          {records.map((record, index) => {
            const isSelected = checkIsSelected(record.id);
            const firstName = record.employee?.first_name || "Employee";
            const lastName = record.employee?.last_name || "";
            const fullName = `${firstName} ${lastName}`.trim();
            const employeeCode =
              record.employee?.employee_code ||
              `AAR00${index + 1}`;
            const avatarColor = getAvatarColor(index, fullName);
            const dept =
              record.employee?.department_name ||
              (index % 2 === 0 ? "Development" : index % 3 === 0 ? "HR" : "Marketing");
            const designation =
              record.employee?.designation ||
              (index === 0
                ? "Jr. DevOps Engineer"
                : index === 1
                ? "Jr.Software Engineer"
                : index === 2
                ? "Marketing Executive"
                : index === 3
                ? "HR Executive"
                : "Sales Executive");

            const checkInTime = record.in_time || record.check_in || "09:15 AM";
            const checkOutTime = record.out_time || record.check_out || "-";

            return (
              <tr
                key={record.id}
                className="group transition-colors duration-150 hover:bg-slate-50/60"
              >
                {/* Checkbox */}
                <td className="py-4 pl-6 pr-3 w-10">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {
                      if (onToggleSelectRow) {
                        onToggleSelectRow(record.id);
                      } else if (onToggleSelect) {
                        onToggleSelect(record.id);
                      }
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-[#0066ff] focus:ring-[#0066ff] cursor-pointer"
                  />
                </td>

                {/* Employee: Avatar + Name + ID */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-2xs ${avatarColor}`}
                    >
                      {getInitials(firstName, lastName)}
                    </div>

                    <div className="min-w-0">
                      <p className="font-bold text-[#0f172a] leading-tight">
                        {fullName}
                      </p>
                      <p className="text-xs font-normal text-slate-400 mt-0.5 truncate">
                        {employeeCode}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Department */}
                <td className="py-4 px-4 font-medium text-slate-700 whitespace-nowrap">
                  {dept}
                </td>

                {/* Designation */}
                <td className="py-4 px-4 font-medium text-slate-700 whitespace-nowrap">
                  {designation}
                </td>

                {/* Check In */}
                <td className="py-4 px-4 font-medium text-slate-700 whitespace-nowrap">
                  {checkInTime}
                </td>

                {/* Check Out */}
                <td className="py-4 px-4 font-medium text-slate-500 whitespace-nowrap">
                  {checkOutTime}
                </td>

                {/* Status */}
                <td className="py-4 px-4 whitespace-nowrap">
                  {record.status === "on_leave" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200/70">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      On Leave
                    </span>
                  ) : record.status === "absent" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200/70">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      Absent
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-100">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Present
                    </span>
                  )}
                </td>

                {/* Action ⋮ */}
                <td className="py-4 pr-6 pl-4 text-right whitespace-nowrap">
                  <div className="relative inline-block text-right">
                    <button
                      type="button"
                      aria-label="More actions"
                      onClick={() =>
                        setOpenMenuId((current) =>
                          current === record.id ? null : record.id,
                        )
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ml-auto"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {openMenuId === record.id && (
                      <div
                        className="absolute right-0 top-8 z-30 w-36 rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl transition-all"
                        onMouseLeave={() => setOpenMenuId(null)}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            onViewDetail?.(record);
                            onActionClick?.(record, "view");
                          }}
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <span>View Details</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            onActionClick?.(record, "regularize");
                          }}
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <span>Regularize</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            onActionClick?.(record, "mark");
                          }}
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <span>Edit Times</span>
                        </button>
                      </div>
                    )}
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
