import type { CSSProperties } from "react";
import { useState } from "react";
import { Check, X } from "lucide-react";

import DashboardCard, { DashboardViewAllLink } from "./DashboardCard";

import { initialsFor, pendingLeaveRows } from "./dashboardData";

function PersonAvatar({ name }: { name: string }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e0e7ff] text-[10px] font-bold text-[#4338ca]">
      {initialsFor(name)}
    </span>
  );
}

interface PendingLeaveRequestsCardProps {
  onOpenLeave?: () => void;
}

export default function PendingLeaveRequestsCard({
  onOpenLeave,
}: PendingLeaveRequestsCardProps) {
  const [resolved, setResolved] = useState<Record<string, string>>({});

  const rows = pendingLeaveRows.filter((row) => !resolved[row.id]);

  return (
    <DashboardCard
      title="Pending Leave Requests"
      className="col-span-12 xl:col-span-5"
      action={<DashboardViewAllLink onClick={onOpenLeave} />}
    >
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wide text-gray-400">
              <th className="px-1 pb-2 font-semibold">Employee</th>
              <th className="px-1 pb-2 font-semibold">Leave Type</th>
              <th className="px-1 pb-2 font-semibold">From – To</th>
              <th className="px-1 pb-2 font-semibold">Days</th>
              <th className="px-1 pb-2 font-semibold">Status</th>
              <th className="px-1 pb-2 text-right font-semibold">Action</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-[11px] text-gray-400"
                >
                  No pending leave requests.
                </td>
              </tr>
            )}

            {rows.map((row, index) => (
              <tr
                key={row.id}
                className="dashboard-rise border-b border-gray-50 last:border-0"
                style={
                  { "--dashboard-delay": `${index * 80}ms` } as CSSProperties
                }
              >
                <td className="px-1 py-2.5">
                  <div className="flex items-center gap-2">
                    <PersonAvatar name={row.employeeName} />

                    <span className="whitespace-nowrap text-[11px] font-medium text-gray-700">
                      {row.employeeName}
                    </span>
                  </div>
                </td>

                <td className="px-1 py-2.5 text-[11px] text-gray-600">
                  {row.leaveType}
                </td>

                <td className="whitespace-nowrap px-1 py-2.5 text-[11px] text-gray-600">
                  {row.from} – {row.to}
                </td>

                <td className="px-1 py-2.5 text-[11px] font-semibold text-gray-700">
                  {row.days}
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
                      aria-label={`Approve ${row.employeeName}'s leave`}
                      onClick={() =>
                        setResolved((current) => ({
                          ...current,
                          [row.id]: "approved",
                        }))
                      }
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ecfdf5] text-[#16a34a] transition hover:bg-[#d1fae5]"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      aria-label={`Reject ${row.employeeName}'s leave`}
                      onClick={() =>
                        setResolved((current) => ({
                          ...current,
                          [row.id]: "rejected",
                        }))
                      }
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fef2f2] text-[#dc2626] transition hover:bg-[#fee2e2]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}