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
      {rows === null ? (
        <p className="py-5 text-center text-[12px] text-[#6B7280]">
          Loading leave requests…
        </p>
      ) : visibleRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-center text-[12px] text-[#6B7280]">
          {loadError ? (
            <span>{loadError}</span>
          ) : (
            <>
              <Inbox className="h-5 w-5 text-[#9CA3AF]" />
              <span>No pending leave requests.</span>
            </>
          )}
        </div>
      ) : (
        <div className="-mx-5 divide-y divide-[#F3F4F6]">
          {visibleRows.map((row, index) => {
            const name = row.employee_name?.trim() || "Unknown employee";
            const busy = busyId === row.id;
            const days = row.total_days ?? 1;

            return (
              <div
                key={row.id}
                className="dashboard-rise flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-[#FAFAF8]"
                style={
                  {
                    "--dashboard-delay": `${index * 80}ms`,
                  } as CSSProperties
                }
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <PersonAvatar name={name} />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-[#111827]">
                      {name}
                    </p>
                    <p className="truncate text-[11px] text-[#6B7280]">
                      {row.leave_type} · {formatDate(row.start_date)} – {formatDate(row.end_date)} ({days}d)
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    title="Approve"
                    aria-label={`Approve ${name}'s leave`}
                    onClick={() => updateStatus(row, "approved")}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] text-[#047857] transition hover:border-[#A7F3D0] hover:bg-[#ECFDF5] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    title="Reject"
                    aria-label={`Reject ${name}'s leave`}
                    onClick={() => updateStatus(row, "rejected")}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] text-[#B91C1C] transition hover:border-[#FECACA] hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {total > visibleRows.length && visibleRows.length > 0 && (
        <p className="mt-3 text-[11px] text-[#6B7280]">
          Showing {visibleRows.length} of {total} pending requests.
        </p>
      )}

      {actionError && (
        <p className="mt-2 text-[11px] font-medium text-[#dc2626]">
          {actionError}
        </p>
      )}
    </DashboardCard>
  );
}
