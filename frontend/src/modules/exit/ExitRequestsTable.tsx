import { Trash2 } from "lucide-react";

import { Button } from "../../components/ui/Button";
import {
  EmptyState,
  EmployeeAvatar,
  ErrorState,
  ExitStatusBadge,
  ExitTypeBadge,
  LoadingRows,
} from "./ExitUi";
import { formatDate } from "./exitUiUtils";
import type { ExitRequest } from "./types";

export type ExitTableVariant = "overview" | "typed";

/** Mirrors the server rule: only requests that never progressed can be removed. */
const DELETABLE_STATUSES: ExitRequest["status"][] = ["Pending", "Cancelled"];

interface ExitRequestsTableProps {
  requests: ExitRequest[];
  loading: boolean;
  error: string | null;
  onOpen: (request: ExitRequest) => void;
  onDelete?: (request: ExitRequest) => void;
  /** Id currently being deleted, so its button can show a busy state. */
  deletingId?: string | null;
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
  onDelete,
  deleting,
}: {
  request: ExitRequest;
  onOpen: (request: ExitRequest) => void;
  onDelete?: (request: ExitRequest) => void;
  deleting: boolean;
}) {
  const canDelete = DELETABLE_STATUSES.includes(request.status);

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onOpen(request)}
        className="h-7 px-2.5 py-0 text-[12px] font-medium shadow-none whitespace-nowrap"
      >
        View
      </Button>

      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(request)}
          disabled={!canDelete || deleting}
          title={
            canDelete
              ? `Delete ${request.employee_name}'s request`
              : `A ${request.status.toLowerCase()} request cannot be deleted`
          }
          aria-label="Delete exit request"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-[#9B1C1C] transition hover:bg-[#FDE8E8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] cursor-pointer disabled:cursor-not-allowed disabled:text-[#7B8794]/50 disabled:hover:bg-transparent"
        >
          <Trash2 className="h-4 w-4 shrink-0" />
        </button>
      )}
    </div>
  );
}

export default function ExitRequestsTable({
  requests,
  loading,
  error,
  onOpen,
  onDelete,
  deletingId = null,
  variant = "overview",
  emptyMessage = "No exit requests found.",
}: ExitRequestsTableProps) {
  if (loading) {
    return <LoadingRows className="px-6 pb-5" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (requests.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  const typed = variant === "typed";

  return (
    <div className="overflow-x-auto w-full">
      <table
        className={`w-full table-fixed border-collapse text-left text-[12px] ${
          typed ? "min-w-[1140px]" : "min-w-[1040px]"
        }`}
      >
        <colgroup>
          <col className="w-[220px]" />
          {typed ? (
            <>
              <col className="w-[140px]" />
              <col className="w-[140px]" />
            </>
          ) : (
            <col className="w-[130px]" />
          )}
          <col />
          <col className="w-[150px]" />
          <col className="w-[130px]" />
          <col className="w-[140px]" />
          <col className="w-[120px]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#4B5563] font-semibold text-[11px] uppercase tracking-wider">
          <tr className="h-10">
            <th className="whitespace-nowrap px-6 py-0 bg-[#F9FAFB] align-middle font-semibold">
              Employee
            </th>

            {typed ? (
              <>
                <th className="whitespace-nowrap px-4 py-0 bg-[#F9FAFB] align-middle font-semibold">
                  Department
                </th>
                <th className="whitespace-nowrap px-4 py-0 bg-[#F9FAFB] align-middle font-semibold">
                  Designation
                </th>
              </>
            ) : (
              <th className="whitespace-nowrap px-4 py-0 bg-[#F9FAFB] align-middle font-semibold">
                Type
              </th>
            )}

            <th className="whitespace-nowrap px-4 py-0 bg-[#F9FAFB] align-middle font-semibold">
              Reason
            </th>
            <th className="whitespace-nowrap px-4 py-0 bg-[#F9FAFB] align-middle font-semibold">
              Last Working Day
            </th>
            <th className="whitespace-nowrap px-4 py-0 bg-[#F9FAFB] align-middle font-semibold">
              Status
            </th>
            <th className="whitespace-nowrap px-4 py-0 bg-[#F9FAFB] align-middle font-semibold">
              Requested On
            </th>
            <th className="whitespace-nowrap pl-3 pr-4 py-0 bg-[#F9FAFB] text-right align-middle font-semibold">
              Action
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#111827]">
          {requests.map((request) => (
            <tr
              key={request.id}
              onClick={() => onOpen(request)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen(request);
                }
              }}
              tabIndex={0}
              className="min-h-[56px] h-[56px] cursor-pointer transition-colors hover:bg-[#F9FAFB] focus:outline-none focus-visible:bg-[#F9FAFB] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2F5FD0]"
            >
              <td className="px-6 py-2 align-middle">
                <div className="flex items-center gap-2.5 min-w-0">
                  <EmployeeAvatar name={request.employee_name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[12px] text-[#111827] leading-tight">
                      {request.employee_name ?? "—"}
                    </p>
                    <p className="truncate text-[11px] text-[#6B7280] mt-0.5 leading-tight tabular-nums">
                      {request.employee_id}
                    </p>
                  </div>
                </div>
              </td>

              {typed ? (
                <>
                  <td className="truncate px-4 py-2 align-middle text-[#4B5563]">
                    {request.department_name ?? "—"}
                  </td>
                  <td className="truncate px-4 py-2 align-middle text-[#4B5563]">
                    {request.designation ?? "—"}
                  </td>
                </>
              ) : (
                <td className="px-4 py-2 align-middle">
                  <ExitTypeBadge type={request.exit_type} />
                </td>
              )}

              <td
                title={request.reason}
                className="truncate px-4 py-2 align-middle text-[#4B5563]"
              >
                {request.reason}
              </td>
              <td className="whitespace-nowrap px-4 py-2 align-middle text-[12px] font-medium text-[#111827] tabular-nums">
                {formatDate(request.last_working_day)}
              </td>
              <td className="px-4 py-2 align-middle">
                <ExitStatusBadge status={request.status} />
              </td>
              <td className="whitespace-nowrap px-4 py-2 align-middle text-[12px] font-medium text-[#111827] tabular-nums">
                {formatDate(request.submitted_at)}
              </td>

              <td
                className="pl-3 pr-4 py-2 align-middle text-right"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <ActionsMenu
                  request={request}
                  onOpen={onOpen}
                  onDelete={onDelete}
                  deleting={deletingId === request.id}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}