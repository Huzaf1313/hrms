import React from "react";
import { DataTable, type Column } from "../../../components/ui/DataTable";
import { StatusPill } from "../../../components/ui/Badge";
import { Select } from "../../../components/ui/Select";
import { getLeaveTypeMeta } from "../services/leaveTypes";
import type { EmployeeLeaveBalance, LeaveRequest } from "../services/leaveService";
import { Ban } from "lucide-react";

export interface LeaveBalanceHistoryProps {
  balances: EmployeeLeaveBalance[];
  requests: LeaveRequest[];
  isLoading?: boolean;
  statusFilter?: string;
  onStatusChange?: (status: string) => void;
  typeFilter?: string;
  onTypeChange?: (type: string) => void;
  yearFilter?: string;
  onYearChange?: (year: string) => void;
  onCancelRequest?: (requestId: string) => void;
  className?: string;
}

export const LeaveBalanceHistory: React.FC<LeaveBalanceHistoryProps> = ({
  balances,
  requests,
  isLoading = false,
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
  yearFilter,
  onYearChange,
  onCancelRequest,
  className = "",
}) => {
  const [internalStatus, setInternalStatus] = React.useState("all");
  const [internalType, setInternalType] = React.useState("all");
  const [internalYear, setInternalYear] = React.useState("all");

  const currentStatus = statusFilter ?? internalStatus;
  const handleStatusChange = onStatusChange ?? setInternalStatus;
  const currentType = typeFilter ?? internalType;
  const handleTypeChange = onTypeChange ?? setInternalType;
  const currentYear = yearFilter ?? internalYear;
  const handleYearChange = onYearChange ?? setInternalYear;

  const filteredRequests = React.useMemo(() => {
    return requests.filter((r) => {
      const s = r.status.toLowerCase();
      const matchStatus = currentStatus === "all" || s === currentStatus.toLowerCase();
      const matchType = currentType === "all" || r.leave_type.toLowerCase() === currentType.toLowerCase();
      const matchYear = currentYear === "all" || (r.start_date && r.start_date.startsWith(currentYear));
      return matchStatus && matchType && matchYear;
    });
  }, [requests, currentStatus, currentType, currentYear]);
  const historyColumns: Column<LeaveRequest>[] = [
    {
      key: "leave_type",
      header: "Leave Type",
      sortable: true,
      render: (row) => {
        const meta = getLeaveTypeMeta(row.leave_type);
        return (
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: meta.accent }}
            />
            <span className="font-medium text-[#1F2933]">{row.leave_type}</span>
          </div>
        );
      },
    },
    {
      key: "dates",
      header: "Date Range",
      render: (row) => (
        <div>
          <span className="text-[#1F2933] block font-mono text-[13.5px]">
            {row.start_date} to {row.end_date}
          </span>
          <span className="text-xs text-[#7B8794]">
            {row.total_days ?? 1} working {Number(row.total_days) === 1 ? "day" : "days"}
          </span>
        </div>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      render: (row) => (
        <span className="text-[#52606D] max-w-xs truncate block" title={row.reason || ""}>
          {row.reason || "-"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Applied On",
      sortable: true,
      render: (row) => (
        <span className="text-[#7B8794] text-[12px]">
          {row.created_at ? row.created_at.slice(0, 10) : "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        const s = row.status.toLowerCase();
        const variant =
          s === "approved"
            ? "ok"
            : s === "pending"
            ? "warn"
            : s === "rejected"
            ? "bad"
            : "off";

        return (
          <StatusPill variant={variant}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </StatusPill>
        );
      },
    },
    {
      key: "actions",
      header: "Action",
      align: "right",
      render: (row) => {
        if (row.status.toLowerCase() !== "pending" || !onCancelRequest) return null;
        return (
          <button
            type="button"
            onClick={() => onCancelRequest(row.id)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[#A12D22] hover:text-[#801D13] p-1 rounded hover:bg-[#FBE4E1] transition-colors cursor-pointer"
            title="Cancel this pending leave request"
          >
            <Ban className="w-3.5 h-3.5" />
            Cancel
          </button>
        );
      },
    },
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. Leave Balance Summary Table */}
      <div className="rounded-[8px] bg-white border border-[#E4E6E1] overflow-hidden shadow-none">
        <div className="px-5 py-3.5 border-b border-[#E4E6E1] bg-white">
          <h3 className="text-[14px] font-semibold text-[#1F2933]">
            Annual Leave Entitlement & Balances (2026)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13.5px] border-collapse">
            <thead className="bg-[#F6F7F5] border-b border-[#E4E6E1] text-[#7B8794] font-semibold text-[12px] normal-case tracking-normal h-[40px]">
              <tr className="h-[40px]">
                <th className="px-4 py-0 bg-[#F6F7F5]">Leave Category</th>
                <th className="px-4 py-0 bg-[#F6F7F5] text-right">Entitled</th>
                <th className="px-4 py-0 bg-[#F6F7F5] text-right">Taken / Consumed</th>
                <th className="px-4 py-0 bg-[#F6F7F5] text-right">Pending Approval</th>
                <th className="px-4 py-0 bg-[#F6F7F5] text-right">Available Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E6E1] bg-white text-[#1F2933]">
              {balances.map((b) => {
                const meta = getLeaveTypeMeta(b.leave_type);
                return (
                  <tr key={b.leave_type} className="h-[48px] hover:bg-[#FAFAF8] transition-colors">
                    <td className="px-4 py-0 align-middle">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: meta.accent }}
                        />
                        <span className="font-medium text-[#1F2933]">{b.leave_type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-0 align-middle text-right font-mono text-[#52606D]">
                      {b.allocated} days
                    </td>
                    <td className="px-4 py-0 align-middle text-right font-mono text-[#8A5A00]">
                      {b.used} days
                    </td>
                    <td className="px-4 py-0 align-middle text-right font-mono text-[#274C9E]">
                      0 days
                    </td>
                    <td className="px-4 py-0 align-middle text-right font-mono font-semibold text-[#1E6B45]">
                      {b.available} days
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Leave History Table with Filters */}
      <DataTable<LeaveRequest>
        title="Leave Application History"
        columns={historyColumns}
        data={filteredRequests}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        emptyTitle="No leave applications found"
        emptyDescription="You have not submitted any leave applications matching the filters."
        filters={
          <div className="flex items-center gap-2 flex-nowrap">
            <Select
              value={currentStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="h-[34px] text-[13.5px] w-32"
              wrapperClassName="w-auto"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </Select>

            <Select
              value={currentType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="h-[34px] text-[13.5px] w-36"
              wrapperClassName="w-auto"
            >
              <option value="all">All Leave Types</option>
              <option value="Casual Leave">Casual Leave</option>
              <option value="Sick Leave">Sick Leave</option>
              <option value="Earned Leave">Earned Leave</option>
              <option value="Comp Off">Comp Off</option>
              <option value="Unpaid Leave">Unpaid Leave</option>
            </Select>

            <Select
              value={currentYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="h-[34px] text-[13.5px] w-28"
              wrapperClassName="w-auto"
            >
              <option value="all">All Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </Select>
          </div>
        }
      />
    </div>
  );
};

export default LeaveBalanceHistory;
