import React from "react";
import { DataTable, type Column } from "../../../components/ui/DataTable";
import { getLeaveTypeMeta } from "../services/leaveTypes";
import type { EmployeeLeaveBalance, LeaveRequest } from "../services/leaveService";

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

function formatDays(count: number): string {
  const rounded = Math.round(count * 10) / 10;
  return `${rounded} ${rounded === 1 ? "day" : "days"}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const clean = dateStr.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[monthIdx]} ${year}`;
}

function formatDateRange(startStr: string, endStr: string): string {
  if (!startStr) return "-";
  if (!endStr || startStr === endStr) return formatDate(startStr);
  const sParts = startStr.slice(0, 10).split("-");
  const eParts = endStr.slice(0, 10).split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (sParts.length === 3 && eParts.length === 3) {
    const sDay = parseInt(sParts[2], 10);
    const sMonth = months[parseInt(sParts[1], 10) - 1];
    const sYear = sParts[0];

    const eDay = parseInt(eParts[2], 10);
    const eMonth = months[parseInt(eParts[1], 10) - 1];
    const eYear = eParts[0];

    if (sYear === eYear) {
      return `${sDay} ${sMonth} - ${eDay} ${eMonth} ${sYear}`;
    }
    return `${sDay} ${sMonth} ${sYear} - ${eDay} ${eMonth} ${eYear}`;
  }
  return `${startStr} - ${endStr}`;
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
  const [requestToCancel, setRequestToCancel] = React.useState<LeaveRequest | null>(null);
  const [isCancelling, setIsCancelling] = React.useState(false);

  const currentStatus = statusFilter ?? internalStatus;
  const handleStatusChange = onStatusChange ?? setInternalStatus;
  const currentType = typeFilter ?? internalType;
  const handleTypeChange = onTypeChange ?? setInternalType;
  const currentYear = yearFilter ?? internalYear;
  const handleYearChange = onYearChange ?? setInternalYear;

  // Derive pending days per leave type from pending applications in requests
  const pendingDaysByType = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of requests) {
      if (r.status.toLowerCase() === "pending") {
        const typeKey = r.leave_type.trim().toLowerCase();
        map[typeKey] = (map[typeKey] || 0) + (Number(r.total_days) || 0);
      }
    }
    return map;
  }, [requests]);

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
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: meta.accent }}
            />
            <span className="font-medium text-[12px] text-[#111827]">{row.leave_type}</span>
          </div>
        );
      },
    },
    {
      key: "dates",
      header: "Date Range",
      render: (row) => (
        <div>
          <span className="text-[#111827] block text-[12px] font-medium leading-tight">
            {formatDateRange(row.start_date, row.end_date)}
          </span>
          <span className="text-[11px] text-[#6B7280] block mt-0.5 leading-tight tabular-nums">
            {formatDays(row.total_days ?? 1)}
          </span>
        </div>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      render: (row) => (
        <span className="text-[#4B5563] text-[12px] max-w-xs truncate block" title={row.reason || ""}>
          {row.reason || "-"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Applied On",
      sortable: true,
      render: (row) => (
        <span className="text-[#6B7280] text-[12px] tabular-nums">
          {formatDate(row.created_at)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        const s = row.status.toLowerCase();
        let badgeCls = "bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]";
        let label = "Cancelled";
        if (s === "approved") {
          badgeCls = "bg-[#DEF7EC] text-[#03543F] border-[#BCF0DA]";
          label = "Approved";
        } else if (s === "pending") {
          badgeCls = "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]";
          label = "Pending";
        } else if (s === "rejected") {
          badgeCls = "bg-[#FDE8E8] text-[#9B1C1C] border-[#F8B4B4]";
          label = "Rejected";
        }

        return (
          <span className={`inline-flex items-center h-5 px-2 text-[11px] font-medium rounded-full border ${badgeCls}`}>
            {label}
          </span>
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
            onClick={() => setRequestToCancel(row)}
            className="text-[12px] font-medium text-[#DC2626] hover:text-[#991B1B] hover:underline cursor-pointer"
          >
            Cancel
          </button>
        );
      },
    },
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. Leave Balance Summary Table */}
      <div className="rounded-[2px] bg-white border border-[#E5E7EB] overflow-hidden shadow-none">
        <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-white flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-[#111827]">
            Annual Leave Entitlement & Balances (2026)
          </h3>
          <span className="text-[11px] text-[#6B7280]">
            Available = Entitled − Taken − Pending
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-[12px] border-collapse">
            <thead className="sticky top-0 z-10 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#4B5563] font-semibold text-[11px] uppercase tracking-wider">
              <tr className="h-10">
                <th className="px-4 py-0 bg-[#F9FAFB]">Leave Category</th>
                <th className="w-[120px] px-4 py-0 bg-[#F9FAFB] text-right">Entitled</th>
                <th className="w-[120px] px-4 py-0 bg-[#F9FAFB] text-right">Taken</th>
                <th className="w-[120px] px-4 py-0 bg-[#F9FAFB] text-right">Pending Approval</th>
                <th className="w-[120px] px-4 py-0 bg-[#F9FAFB] text-right">Available Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#111827]">
              {balances.map((b) => {
                const meta = getLeaveTypeMeta(b.leave_type);
                const typeKey = b.leave_type.trim().toLowerCase();
                const pending = pendingDaysByType[typeKey] || 0;
                const entitled = Number(b.allocated) || 0;
                const taken = Number(b.used) || 0;
                const available = Math.max(0, entitled - taken - pending);
                const percentTaken = entitled > 0 ? Math.min(100, Math.round((taken / entitled) * 100)) : 0;

                return (
                  <tr key={b.leave_type} className="h-11 hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-4 py-2 align-middle">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: meta.accent }}
                          />
                          <span className="font-medium text-[12px] text-[#111827]">{b.leave_type}</span>
                        </div>
                        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                          <div className="w-16 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${percentTaken}%`,
                                backgroundColor: meta.accent || "#2F5FD0",
                              }}
                            />
                          </div>
                          <span className="text-[11px] text-[#6B7280] tabular-nums w-8 text-right">
                            {percentTaken}%
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="w-[120px] px-4 py-0 align-middle text-right tabular-nums text-[#4B5563]">
                      {formatDays(entitled)}
                    </td>
                    <td className="w-[120px] px-4 py-0 align-middle text-right tabular-nums text-[#92400E]">
                      {formatDays(taken)}
                    </td>
                    <td className="w-[120px] px-4 py-0 align-middle text-right tabular-nums text-[#2563EB]">
                      {formatDays(pending)}
                    </td>
                    <td className="w-[120px] px-4 py-0 align-middle text-right tabular-nums font-semibold text-[#059669]">
                      {formatDays(available)}
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
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full">
            <select
              value={currentStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="h-8 px-2.5 text-[12px] rounded-md border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#2F5FD0] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={currentType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="h-8 px-2.5 text-[12px] rounded-md border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#2F5FD0] cursor-pointer"
            >
              <option value="all">All Leave Types</option>
              <option value="Casual Leave">Casual Leave</option>
              <option value="Sick Leave">Sick Leave</option>
              <option value="Earned Leave">Earned Leave</option>
              <option value="Comp Off">Comp Off</option>
              <option value="Unpaid Leave">Unpaid Leave</option>
            </select>

            <select
              value={currentYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="h-8 px-2.5 text-[12px] rounded-md border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#2F5FD0] cursor-pointer"
            >
              <option value="all">All Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>

            <span className="text-[12px] text-[#6B7280] font-medium ml-auto tabular-nums">
              {filteredRequests.length} {filteredRequests.length === 1 ? "record" : "records"}
            </span>
          </div>
        }
      />

      {/* Confirmation Dialog for Cancel */}
      {requestToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[2px] border border-[#E5E7EB] bg-white p-6 shadow-xl">
            <h3 className="text-[16px] font-semibold text-[#111827]">Cancel Leave Request</h3>
            <p className="mt-2 text-[13px] text-[#4B5563] leading-relaxed">
              Are you sure you want to cancel your leave request for{" "}
              <span className="font-semibold text-[#111827]">
                {formatDateRange(requestToCancel.start_date, requestToCancel.end_date)}
              </span>{" "}
              ({requestToCancel.leave_type})? This action cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setRequestToCancel(null)}
                className="h-9 px-4 rounded border border-[#E5E7EB] bg-white text-[13px] font-medium text-[#4B5563] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
              >
                Keep Request
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={async () => {
                  if (!onCancelRequest || !requestToCancel) return;
                  setIsCancelling(true);
                  try {
                    await onCancelRequest(requestToCancel.id);
                    setRequestToCancel(null);
                  } finally {
                    setIsCancelling(false);
                  }
                }}
                className="h-9 px-4 rounded bg-[#DC2626] text-[13px] font-medium text-white hover:bg-[#B91C1C] transition-colors cursor-pointer"
              >
                {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveBalanceHistory;
