import { MoreVertical } from "lucide-react";

import {
  EmptyState,
  EmployeeAvatar,
  ErrorState,
  ExitStatusBadge,
  ExitTypeBadge,
  LoadingRows,
} from "./ExitUi";
import { formatDate } from "./exitUiUtils";
import type { ExitRequest } from "../../../types/exitRequest";

export type ExitTableVariant = "overview" | "typed";

interface ExitRequestsTableProps {
  requests: ExitRequest[];
  loading: boolean;
  error: string | null;
  onOpen: (request: ExitRequest) => void;
  /**
   * `overview` keeps the Type column, which is meaningful while the list mixes
   * types. A single-type tab drops it (every row would repeat it) and shows the
   * employee's department and designation instead.
   */
  variant?: ExitTableVariant;
  emptyMessage?: string;
}

function ActionsMenu({
  request,
  onOpen,
}: {
  request: ExitRequest;
  onOpen: (request: ExitRequest) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={() => onOpen(request)}
        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100"
      >
        View
      </button>
      <button
        type="button"
        onClick={() => onOpen(request)}
        aria-label={`Actions for ${request.employee_name}`}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function ExitRequestsTable({
  requests,
  loading,
  error,
  onOpen,
  variant = "overview",
  emptyMessage = "No exit requests found.",
}: ExitRequestsTableProps) {
  if (loading) {
    return <LoadingRows className="px-5 pb-5" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (requests.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  const typed = variant === "typed";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <th className="whitespace-nowrap px-5 py-3">Employee</th>

            {typed ? (
              <>
                <th className="whitespace-nowrap px-3 py-3">Department</th>
                <th className="whitespace-nowrap px-3 py-3">Designation</th>
              </>
            ) : (
              <th className="whitespace-nowrap px-3 py-3">Type</th>
            )}

            <th className="whitespace-nowrap px-3 py-3">Reason</th>
            <th className="whitespace-nowrap px-3 py-3">Last Working Day</th>
            <th className="whitespace-nowrap px-3 py-3">Status</th>
            <th className="whitespace-nowrap px-3 py-3">Requested On</th>
            <th className="whitespace-nowrap px-5 py-3 text-right">Action</th>
          </tr>
        </thead>

        <tbody>
          {requests.map((request) => (
            <tr
              key={request.id}
              onClick={() => onOpen(request)}
              className="cursor-pointer border-b border-slate-50 transition last:border-0 hover:bg-slate-50/70"
            >
              <td className="px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <EmployeeAvatar name={request.employee_name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {request.employee_name ?? "—"}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {request.employee_id}
                    </p>
                  </div>
                </div>
              </td>

              {typed ? (
                <>
                  <td className="truncate px-3 py-3 text-slate-600">
                    {request.department_name ?? "—"}
                  </td>
                  <td className="truncate px-3 py-3 text-slate-600">
                    {request.designation ?? "—"}
                  </td>
                </>
              ) : (
                <td className="px-3 py-3">
                  <ExitTypeBadge type={request.exit_type} />
                </td>
              )}

              <td className="max-w-[220px] truncate px-3 py-3 text-slate-600">
                {request.reason}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                {formatDate(request.last_working_day)}
              </td>
              <td className="px-3 py-3">
                <ExitStatusBadge status={request.status} />
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                {formatDate(request.submitted_at)}
              </td>

              <td className="px-5 py-3" onClick={(event) => event.stopPropagation()}>
                <ActionsMenu request={request} onOpen={onOpen} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}