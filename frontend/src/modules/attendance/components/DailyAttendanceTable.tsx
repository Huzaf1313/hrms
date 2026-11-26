import React, { useState } from "react";
import {
  DataTable,
  type Column,
} from "../../../components/ui/DataTable";
import { Avatar } from "../../../components/ui/Avatar";
import { StatusPill } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { DatePicker } from "../../../components/ui/DatePicker";
import { canCurrentUser } from "../../../lib/permissions";
import { formatDurationHours } from "../../../utils/dateKeys";
import {
  Download,
  CheckSquare,
  Square,
  FileEdit,
  Eye,
} from "lucide-react";
import type { AttendanceRecord } from "../types";

export interface DailyAttendanceTableProps {
  records: AttendanceRecord[];
  isLoading?: boolean;
  totalRecords?: number;
  page?: number;
  onPageChange?: (newPage: number) => void;
  date: string;
  onDateChange: (newDate: string) => void;
  departmentId: string;
  onDepartmentChange: (deptId: string) => void;
  departments: Array<{ id: string; name: string }>;
  status: string;
  onStatusChange: (status: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  onRowClick?: (record: AttendanceRecord) => void;
  onOverrideRecord?: (record: AttendanceRecord) => void;
  onExportCsv?: () => void;
  selectedIds?: Set<string>;
  onToggleSelectRow?: (id: string) => void;
  onToggleSelectAll?: () => void;
  onBulkMark?: () => void;
  className?: string;
}

export const DailyAttendanceTable: React.FC<DailyAttendanceTableProps> = ({
  records,
  isLoading = false,
  totalRecords,
  page = 1,
  onPageChange,
  date,
  onDateChange,
  departmentId,
  onDepartmentChange,
  departments,
  status,
  onStatusChange,
  search,
  onSearchChange,
  onRowClick,
  onOverrideRecord,
  onExportCsv,
  selectedIds = new Set(),
  onToggleSelectRow,
  onToggleSelectAll,
  onBulkMark,
  className = "",
}) => {
  const [sortKey, setSortKey] = useState<string>("employee");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const canOverride = canCurrentUser("attendance:override");

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  const columns: Column<AttendanceRecord>[] = [
    ...(onToggleSelectRow
      ? [
          {
            key: "selection",
            header: (
              <div className="flex items-center justify-center w-full">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelectAll?.();
                  }}
                  className="text-slate-500 hover:text-slate-800 flex items-center justify-center p-1 cursor-pointer"
                  aria-label="Select all rows"
                >
                  {selectedIds.size > 0 && selectedIds.size === records.length ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </div>
            ),
            width: "48px",
            align: "center" as const,
            render: (row: AttendanceRecord) => (
              <div className="flex items-center justify-center w-full">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelectRow(row.id);
                  }}
                  className="text-slate-400 hover:text-slate-700 flex items-center justify-center p-1 cursor-pointer"
                  aria-label={`Select ${row.employee.first_name}`}
                >
                  {selectedIds.has(row.id) ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </div>
            ),
          },
        ]
      : []),

    {
      key: "employee",
      header: "Employee",
      width: "240px",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar
            name={`${row.employee.first_name} ${row.employee.last_name}`}
            src={row.employee.avatar_url}
            className="!w-9 !h-9 text-xs shrink-0"
          />
          <div className="min-w-0">
            <span className="font-medium text-[#1F2933] block leading-tight text-sm truncate">
              {row.employee.first_name} {row.employee.last_name}
            </span>
            <span className="text-xs text-[#7B8794] font-mono block mt-0.5 leading-tight">
              {row.employee.employee_code}
            </span>
          </div>
        </div>
      ),
    },

    {
      key: "department",
      header: "Department",
      width: "200px",
      sortable: true,
      render: (row) => (
        <span className="text-[#52606D] text-sm">{row.employee.department_name ?? "-"}</span>
      ),
    },

    {
      key: "shift",
      header: "Shift",
      width: "160px",
      render: (row) => (
        <div>
          <span className="text-[#1F2933] font-medium block capitalize text-sm leading-tight">
            {row.shift || "General Shift"}
          </span>
          {row.shift_start && row.shift_end && (
            <span className="text-xs text-[#7B8794] block font-mono mt-0.5 leading-tight">
              {row.shift_start} - {row.shift_end}
            </span>
          )}
        </div>
      ),
    },

    {
      key: "check_in",
      header: "Punch In",
      width: "120px",
      sortable: true,
      render: (row) => {
        if (row.status === "absent") {
          return <span className="font-mono text-[#7B8794] text-sm">-</span>;
        }
        const inVal = row.in_time || row.check_in;
        return (
          <div>
            <span className="font-mono text-[#1F2933] text-sm block leading-tight">{inVal || "-"}</span>
            {row.is_late && (
              <span className="block text-xs font-medium text-[#8A5A00] mt-0.5 leading-tight">
                Late ({row.late_minutes ?? 0}m)
              </span>
            )}
          </div>
        );
      },
    },

    {
      key: "check_out",
      header: "Punch Out",
      width: "120px",
      sortable: true,
      render: (row) => {
        if (row.status === "absent") {
          return <span className="font-mono text-[#7B8794] text-sm">-</span>;
        }
        const outVal = row.out_time || row.check_out;
        return (
          <span className="font-mono text-[#1F2933] text-sm block leading-tight">{outVal || "-"}</span>
        );
      },
    },

    {
      key: "working_hours",
      header: "Total Hours",
      width: "110px",
      align: "right",
      sortable: true,
      render: (row) => {
        if (row.status === "absent") {
          return <span className="font-mono text-[#7B8794] text-sm block">-</span>;
        }
        const val = row.working_hours ?? (row.total_hours != null ? `${row.total_hours}h` : "-");
        return (
          <span className="font-mono font-medium text-[#1F2933] text-sm block">
            {formatDurationHours(val)}
          </span>
        );
      },
    },

    {
      key: "status",
      header: "Status",
      width: "120px",
      align: "left",
      render: (row) => {
        const variant =
          row.status === "present"
            ? "ok"
            : row.status === "late" || row.status === "half_day"
            ? "warn"
            : row.status === "on_leave"
            ? "leave"
            : row.status === "absent" || row.status === "missing_punch"
            ? "bad"
            : "off";

        const label =
          row.status === "on_leave"
            ? "On Leave"
            : row.status === "missing_punch"
            ? "Missing Punch"
            : row.status === "half_day"
            ? "Half Day"
            : row.status.charAt(0).toUpperCase() + row.status.slice(1);

        return (
          <div className="flex items-center gap-1.5">
            <StatusPill variant={variant} className="py-1 px-3 gap-1.5 h-auto text-xs leading-normal font-medium">
              {label}
            </StatusPill>
            {row.is_regularized && (
              <span
                title="Regularized"
                className="text-xs bg-[#E8EEFB] text-[#2F5FD0] px-1.5 py-0.5 rounded-[4px] font-medium"
              >
                Reg
              </span>
            )}
          </div>
        );
      },
    },

    {
      key: "actions",
      header: "Actions",
      width: "100px",
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onRowClick?.(row)}
            className="w-8 h-8 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="View details"
            aria-label="View details"
          >
            <Eye className="w-[18px] h-[18px] shrink-0" />
          </button>
          {canOverride && onOverrideRecord && (
            <button
              type="button"
              onClick={() => onOverrideRecord(row)}
              className="w-8 h-8 flex items-center justify-center rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
              title="Override attendance"
              aria-label="Override attendance"
            >
              <FileEdit className="w-[18px] h-[18px] shrink-0" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className={`w-full ${className}`}>
      <DataTable<AttendanceRecord>
        title="Daily attendance"
        columns={columns}
        data={records}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        emptyTitle="No attendance logs found"
        emptyDescription="No employees have punch records for the selected filters."
        searchQuery={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search employee..."
        sortColumn={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        page={page}
        pageSize={10}
        totalItems={totalRecords ?? records.length}
        onPageChange={onPageChange}
        onRowClick={onRowClick}
        /* Single horizontal toolbar row: search | date | department | status | Export CSV */
        filters={
          <>
            <div className="w-full sm:w-[160px] shrink-0">
              <DatePicker
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                className="h-10 text-sm px-3 w-full"
                wrapperClassName="w-full sm:w-[160px]"
              />
            </div>

            <div className="w-full sm:w-[180px] shrink-0">
              <Select
                value={departmentId}
                onChange={(e) => onDepartmentChange(e.target.value)}
                className="h-10 text-sm px-3 w-full"
                wrapperClassName="w-full sm:w-[180px]"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="w-full sm:w-[160px] shrink-0">
              <Select
                value={status}
                onChange={(e) => onStatusChange(e.target.value)}
                className="h-10 text-sm px-3 w-full"
                wrapperClassName="w-full sm:w-[160px]"
              >
                <option value="">All Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="half_day">Half Day</option>
                <option value="on_leave">On Leave</option>
                <option value="absent">Absent</option>
                <option value="missing_punch">Missing Punch</option>
              </Select>
            </div>
          </>
        }
        actions={
          <>
            {selectedIds.size > 0 && onBulkMark && (
              <Button
                variant="primary"
                onClick={onBulkMark}
                className="h-10 px-3.5 py-0 text-[13px] gap-2 shrink-0 font-medium"
              >
                Bulk Mark ({selectedIds.size})
              </Button>
            )}
            {onExportCsv && (
              <Button
                variant="outline"
                onClick={onExportCsv}
                leftIcon={<Download className="w-4 h-4 shrink-0" />}
                className="h-10 px-3.5 py-0 text-[13px] gap-2 shrink-0 font-medium"
              >
                Export CSV
              </Button>
            )}
          </>
        }
      />
    </div>
  );
};
