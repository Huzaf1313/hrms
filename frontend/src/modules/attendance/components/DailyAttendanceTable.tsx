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
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelectAll?.();
                }}
                className="text-slate-500 hover:text-slate-800"
                aria-label="Select all rows"
              >
                {selectedIds.size > 0 && selectedIds.size === records.length ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
            ),
            width: "36px",
            render: (row: AttendanceRecord) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelectRow(row.id);
                }}
                className="text-slate-400 hover:text-slate-700"
                aria-label={`Select ${row.employee.first_name}`}
              >
                {selectedIds.has(row.id) ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
            ),
          },
        ]
      : []),

    {
      key: "employee",
      header: "Employee",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar
            name={`${row.employee.first_name} ${row.employee.last_name}`}
            src={row.employee.avatar_url}
            size="sm"
          />
          <div>
            <span className="font-semibold text-slate-900 block leading-tight">
              {row.employee.first_name} {row.employee.last_name}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {row.employee.employee_code}
            </span>
          </div>
        </div>
      ),
    },

    {
      key: "department",
      header: "Department",
      sortable: true,
      render: (row) => (
        <span className="text-slate-600">{row.employee.department_name ?? "--"}</span>
      ),
    },

    {
      key: "shift",
      header: "Shift",
      render: (row) => (
        <div>
          <span className="text-slate-700 font-medium block">
            {row.shift || "General Shift"}
          </span>
          {row.shift_start && row.shift_end && (
            <span className="text-[11px] text-slate-400 block font-mono">
              {row.shift_start} - {row.shift_end}
            </span>
          )}
        </div>
      ),
    },

    {
      key: "check_in",
      header: "Check In",
      sortable: true,
      render: (row) => {
        const inVal = row.in_time || row.check_in;
        return (
          <div>
            <span className="font-mono text-slate-800">{inVal || "--"}</span>
            {row.is_late && (
              <span className="block text-[10px] font-medium text-amber-600">
                Late ({row.late_minutes ?? 0}m)
              </span>
            )}
          </div>
        );
      },
    },

    {
      key: "check_out",
      header: "Check Out",
      sortable: true,
      render: (row) => {
        const outVal = row.out_time || row.check_out;
        return (
          <div>
            <span className="font-mono text-slate-800">{outVal || "--"}</span>
            {!outVal && (row.in_time || row.check_in) && (
              <span className="block text-[10px] text-rose-500 font-medium">Incomplete</span>
            )}
          </div>
        );
      },
    },

    {
      key: "working_hours",
      header: "Total Hours",
      align: "right",
      sortable: true,
      render: (row) => {
        const val = row.working_hours ?? (row.total_hours != null ? `${row.total_hours}h` : "--");
        return <span className="font-mono font-medium text-slate-900">{formatDurationHours(val)}</span>;
      },
    },

    {
      key: "status",
      header: "Status",
      render: (row) => {
        const variant =
          row.status === "present"
            ? "success"
            : row.status === "late" || row.status === "half_day"
            ? "warning"
            : row.status === "on_leave"
            ? "info"
            : row.status === "absent" || row.status === "missing_punch"
            ? "danger"
            : "neutral";

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
            <StatusPill variant={variant}>{label}</StatusPill>
            {row.is_regularized && (
              <span
                title="Regularized"
                className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-1 rounded font-medium"
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
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onRowClick?.(row)}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="View details"
            aria-label="View details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {canOverride && onOverrideRecord && (
            <button
              type="button"
              onClick={() => onOverrideRecord(row)}
              className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Override attendance"
              aria-label="Override attendance"
            >
              <FileEdit className="w-3.5 h-3.5" />
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
          <div className="flex items-center gap-2 flex-nowrap">
            <DatePicker
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="h-8 text-xs w-36"
              wrapperClassName="w-auto"
            />

            <Select
              value={departmentId}
              onChange={(e) => onDepartmentChange(e.target.value)}
              className="h-8 text-xs w-36"
              wrapperClassName="w-auto"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>

            <Select
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="h-8 text-xs w-32"
              wrapperClassName="w-auto"
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
        }
        actions={
          <div className="flex items-center gap-2 flex-nowrap shrink-0">
            {selectedIds.size > 0 && onBulkMark && (
              <Button
                variant="primary"
                size="xs"
                onClick={onBulkMark}
                className="h-8 text-xs shrink-0"
              >
                Bulk Mark ({selectedIds.size})
              </Button>
            )}
            {onExportCsv && (
              <Button
                variant="outline"
                size="xs"
                onClick={onExportCsv}
                leftIcon={<Download className="w-3.5 h-3.5" />}
                className="h-8 text-xs shrink-0"
              >
                Export CSV
              </Button>
            )}
          </div>
        }
      />
    </div>
  );
};
