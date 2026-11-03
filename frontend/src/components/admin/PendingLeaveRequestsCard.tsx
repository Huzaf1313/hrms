import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";

import DashboardCard, { DashboardViewAllLink } from "./DashboardCard";

import { initialsFor } from "./dashboardData";
import {
  leaveService,
  type LeaveRequest,
} from "../../services/admin_leave_service";

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
      className="col-span-12 xl:col-span-5"
      action={<DashboardViewAllLink onClick={onOpenLeave} />}
    >
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wide text-black">
              <th className="px-1 pb-2 font-bold">Employee</th>
              <th className="px-1 pb-2 font-bold">Leave Type</th>
              <th className="px-1 pb-2 font-bold">From – To</th>
              <th className="px-1 pb-2 font-bold">Days</th>
              <th className="px-1 pb-2 font-bold">Status</th>
              <th className="px-1 pb-2 text-right font-bold">Action</th>
            </tr>
          </thead>

          <tbody>
            {rows === null && (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-[11px] text-gray-400"
                >
                  Loading leave requests…
                </td>
              </tr>
            )}

            {rows !== null && visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-[11px] text-gray-400"
                >
                  {loadError || "No pending leave requests."}
                </td>
              </tr>
            )}

            {visibleRows.map((row, index) => {
              const name = row.employee_name?.trim() || "Unknown employee";
              const busy = busyId === row.id;

              return (
                <tr
                  key={row.id}
                  className="dashboard-rise border-b border-gray-50 last:border-0"
                  style={
                    {
                      "--dashboard-delay": `${index * 80}ms`,
                    } as CSSProperties
                  }
                >
                  <td className="px-1 py-2.5">
                    <div className="flex items-center gap-2">
                      <PersonAvatar name={name} />

                      <span className="whitespace-nowrap text-[11px] font-medium text-gray-700">
                        {name}
                      </span>
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
                    <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[10px] font-medium text-[#c2410c]">
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
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ecfdf5] text-[#16a34a] transition hover:bg-[#d1fae5] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Reject ${name}'s leave`}
                        onClick={() => updateStatus(row, "rejected")}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fef2f2] text-[#dc2626] transition hover:bg-[#fee2e2] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
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
