import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { Check, Inbox, X } from "lucide-react";

import DashboardCard, { DashboardViewAllLink } from "../dashboard/DashboardCard";

import { initialsFor } from "../dashboard/dashboardData";
import {
  leaveService,
  type LeaveRequest,
} from "./admin_leave_service";

/** The card stays compact, so only the newest requests are listed. */
const MAX_ROWS = 5;

function PersonAvatar({ name }: { name: string }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e0e7ff] text-[10px] font-bold text-[#4338ca]">
      {initialsFor(name)}
    </span>
  );
}

function formatDate(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface PendingLeaveRequestsCardProps {
  onOpenLeave?: () => void;
  /** Called after an approval or rejection, so the KPIs pick up the change. */
  onChanged?: () => void;
}

export default function PendingLeaveRequestsCard({
  onOpenLeave,
  onChanged,
}: PendingLeaveRequestsCardProps) {
  const [rows, setRows] = useState<LeaveRequest[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadPending = useCallback(() => {
    leaveService
      .list({ status: "pending", limit: 100 })
      .then((response) => {
        setRows(response.items);
        setTotal(response.total);
        setLoadError("");
      })
      .catch(() => {
        setRows([]);
        setLoadError("Unable to load pending leave requests.");
      });
  }, []);

  useEffect(() => {
    loadPending();

    const interval = window.setInterval(loadPending, 30_000);

    return () => window.clearInterval(interval);
  }, [loadPending]);

  async function updateStatus(
    row: LeaveRequest,
    status: "approved" | "rejected",
  ) {
    setBusyId(row.id);
    setActionError("");

    try {
      await leaveService.updateStatus(row.id, status);

      loadPending();
      onChanged?.();
    } catch {
      setActionError("Unable to update this leave request.");
    } finally {
      setBusyId(null);
    }
  }

  const visibleRows = (rows ?? []).slice(0, MAX_ROWS);

  return (
    <DashboardCard
      title="Pending Leave Requests"
      className="col-span-12 shrink-0"
      action={<DashboardViewAllLink onClick={onOpenLeave} />}
    >
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="h-10 border-b border-[#E5E7EB] text-left text-[11px] text-[#6B7280]">
              <th className="px-1 pb-2 font-medium">Employee</th>
              <th className="px-1 pb-2 font-medium">Leave Type</th>
              <th className="px-1 pb-2 font-medium">From – To</th>
              <th className="px-1 pb-2 font-medium">Days</th>
              <th className="px-1 pb-2 font-medium">Status</th>
              <th className="px-1 pb-2 text-right font-medium">Action</th>
            </tr>
          </thead>

          <tbody>
            {rows === null && (
              <tr>
                <td
                  colSpan={6}
                    className="py-5 text-center text-[11px] text-[#6B7280]"
                >
                  Loading leave requests…
                </td>
              </tr>
            )}

            {rows !== null && visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                    className="py-5 text-center text-[11px] text-[#6B7280]"
                  >
                  {loadError ? (
                    loadError
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Inbox className="h-4 w-4 text-[#9CA3AF]" />
                      No pending leave requests.
                    </span>
                  )}
                </td>
              </tr>
            )}

            {visibleRows.map((row, index) => {
              const name = row.employee_name?.trim() || "Unknown employee";
              const busy = busyId === row.id;

              return (
                <tr
                  key={row.id}
                  className="dashboard-rise h-14 border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAF8]"
                  style={
                    {
                      "--dashboard-delay": `${index * 80}ms`,
                    } as CSSProperties
                  }
                >
                  <td className="px-1 py-2.5">
                    <div className="flex items-center gap-2">
                      <PersonAvatar name={name} />

                      <div className="min-w-0">
                        <span className="block truncate whitespace-nowrap text-[11px] font-medium text-[#1F2937]">
                          {name}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10px] text-[#9CA3AF]">
                          {row.employee_id}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="px-1 py-2.5 text-[11px] text-gray-600">
                    {row.leave_type}
                  </td>

                  <td className="whitespace-nowrap px-1 py-2.5 text-[11px] text-gray-600">
                    {formatDate(row.start_date)} –{" "}
                    {formatDate(row.end_date)}
                  </td>

                  <td className="px-1 py-2.5 text-[11px] font-semibold text-gray-700">
                    {row.total_days ?? 1}
                  </td>

                  <td className="px-1 py-2.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-medium text-[#92400E]">
                      <span aria-hidden="true">•</span>
                      Pending
                    </span>
                  </td>

                  <td className="px-1 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Approve ${name}'s leave`}
                        onClick={() => updateStatus(row, "approved")}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-[#D1FAE5] bg-white px-2 text-[10px] font-medium text-[#047857] transition hover:bg-[#ECFDF5] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Reject ${name}'s leave`}
                        onClick={() => updateStatus(row, "rejected")}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-[#FECACA] bg-white px-2 text-[10px] font-medium text-[#B91C1C] transition hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > visibleRows.length && visibleRows.length > 0 && (
        <p className="mt-3 text-[10px] text-gray-400">
          Showing {visibleRows.length} of {total} pending requests.
        </p>
      )}

      {actionError && (
        <p className="mt-2 text-[10px] font-medium text-[#dc2626]">
          {actionError}
        </p>
      )}
    </DashboardCard>
  );
}
