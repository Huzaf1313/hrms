import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, MoreHorizontal, PlayCircle, Plus, Trash2 } from "lucide-react";

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
  selectedId?: string | null;
  onSelect?: (request: ExitRequest) => void;
  onOpen: (request: ExitRequest) => void;
  onQuickStatus?: (request: ExitRequest, nextStatus: "In Progress" | "Completed") => void;
  onDelete?: (request: ExitRequest) => void;
  onCreate?: () => void;
  /** Id currently being deleted, so its button can show a busy state. */
  deletingId?: string | null;
  variant?: ExitTableVariant;
  emptyMessage?: string;
}

function ActionsMenu({
  request,
  onOpen,
  onQuickStatus,
  onDelete,
  deleting,
}: {
  request: ExitRequest;
  onOpen: (request: ExitRequest) => void;
  onQuickStatus?: (request: ExitRequest, nextStatus: "In Progress" | "Completed") => void;
  onDelete?: (request: ExitRequest) => void;
  deleting: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const canDelete = DELETABLE_STATUSES.includes(request.status);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  return (
    <div className="relative flex items-center justify-end gap-1.5" ref={menuRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onOpen(request)}
        className="h-8 px-3 py-0 text-[13px] font-medium shadow-none whitespace-nowrap"
      >
        View
      </Button>

      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="More actions"
        aria-expanded={menuOpen}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] cursor-pointer"
      >
        <MoreHorizontal className="h-4 w-4 shrink-0" />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-30 w-48 rounded-[2px] border border-[#E5E7EB] bg-white py-1.5 shadow-lg text-left"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onOpen(request);
            }}
            className="flex w-full items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Eye className="h-4 w-4 text-slate-500" />
            <span>View details</span>
          </button>

          {request.status === "Pending" && onQuickStatus && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onQuickStatus(request, "In Progress");
              }}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-blue-700 hover:bg-blue-50 cursor-pointer"
            >
              <PlayCircle className="h-4 w-4" />
              <span>Approve &amp; Start</span>
            </button>
          )}

          {request.status === "In Progress" && onQuickStatus && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onQuickStatus(request, "Completed");
              }}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-emerald-700 hover:bg-emerald-50 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Mark Completed</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              role="menuitem"
              disabled={!canDelete || deleting}
              title={
                canDelete
                  ? `Delete ${request.employee_name}'s request`
                  : `A ${request.status.toLowerCase()} request cannot be deleted`
              }
              onClick={() => {
                setMenuOpen(false);
                onDelete(request);
              }}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ExitRequestsTable({
  requests,
  loading,
  error,
  selectedId = null,
  onSelect,
  onOpen,
  onQuickStatus,
  onDelete,
  onCreate,
  deletingId = null,
  emptyMessage = "No exit requests found.",
}: ExitRequestsTableProps) {
  if (loading && requests.length === 0) {
    return <LoadingRows className="px-6 pb-5" />;
  }

  if (error && requests.length === 0) {
    return <ErrorState message={error} />;
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        message={emptyMessage}
        action={
          onCreate ? (
            <Button
              variant="primary"
              size="sm"
              onClick={onCreate}
              leftIcon={<Plus className="h-4 w-4 shrink-0" />}
              className="h-9 px-3.5 text-[13px] font-medium shadow-none"
            >
              Create Exit Request
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className={`w-full transition-opacity ${loading ? "opacity-60" : ""}`}>
      {/* Mobile card list (<768px) */}
      <div className="md:hidden divide-y divide-[#E5E7EB]">
        {requests.map((request) => {
          const isSelected = selectedId === request.id;
          const isCancelled = request.status === "Cancelled";

          return (
            <div
              key={request.id}
              onClick={() => (onSelect ? onSelect(request) : onOpen(request))}
              className={`p-4 space-y-3 cursor-pointer transition-colors ${
                isSelected ? "bg-blue-50/70 border-l-2 border-l-[#2F5FD0]" : "hover:bg-slate-50"
              } ${isCancelled ? "opacity-70" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <EmployeeAvatar name={request.employee_name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm text-[#111827] leading-tight">
                      {request.employee_name ?? "—"}
                    </p>
                    <p className="truncate text-xs text-slate-500 mt-0.5 tabular-nums">
                      {request.employee_id} · {request.department_name ?? "—"}
                    </p>
                  </div>
                </div>
                <ExitStatusBadge status={request.status} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <ExitTypeBadge type={request.exit_type} />
                  <span>Req: {formatDate(request.submitted_at)}</span>
                  <span>· LWD: {formatDate(request.last_working_day)}</span>
                </div>

                <div
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <ActionsMenu
                    request={request}
                    onOpen={onOpen}
                    onQuickStatus={onQuickStatus}
                    onDelete={onDelete}
                    deleting={deletingId === request.id}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop / Tablet table (>=768px) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-[23%]" />
          <col className="w-[18%]" />
          <col className="w-[13%]" />
          <col className="w-[13%]" />
          <col className="w-[13%]" />
          <col className="w-[11%]" />
          <col className="w-[104px]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-slate-50 border-b border-[#E5E7EB] text-slate-500 font-medium text-xs uppercase tracking-wider">
          <tr className="h-10">
            <th className="whitespace-nowrap px-6 py-0 bg-slate-50 align-middle font-medium text-slate-500">
              Employee
            </th>
            <th className="whitespace-nowrap px-4 py-0 bg-slate-50 align-middle font-medium text-slate-500">
              Department
            </th>
            <th className="whitespace-nowrap px-4 py-0 bg-slate-50 align-middle font-medium text-slate-500">
              Type
            </th>
            <th className="whitespace-nowrap px-4 py-0 bg-slate-50 align-middle font-medium text-slate-500">
              Request Date
            </th>
            <th className="whitespace-nowrap px-4 py-0 bg-slate-50 align-middle font-medium text-slate-500">
              Last Working Day
            </th>
            <th className="whitespace-nowrap px-4 py-0 bg-slate-50 align-middle font-medium text-slate-500">
              Status
            </th>
            <th className="whitespace-nowrap pl-3 pr-6 py-0 bg-slate-50 text-right align-middle font-medium text-slate-500">
              Actions
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#111827]">
          {requests.map((request) => {
            const isSelected = selectedId === request.id;
            const isCancelled = request.status === "Cancelled";

            return (
              <tr
                key={request.id}
                onClick={() => (onSelect ? onSelect(request) : onOpen(request))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if (onSelect) {
                      onSelect(request);
                    } else {
                      onOpen(request);
                    }
                  }
                }}
                tabIndex={0}
                className={`min-h-[56px] h-[56px] cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2F5FD0] ${
                  isSelected
                    ? "bg-blue-50/70 border-l-2 border-l-[#2F5FD0]"
                    : "hover:bg-slate-50"
                } ${isCancelled ? "opacity-70" : ""}`}
              >
                <td className="px-6 py-2 align-middle">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <EmployeeAvatar name={request.employee_name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm text-[#111827] leading-tight">
                        {request.employee_name ?? "—"}
                      </p>
                      <p className="truncate text-xs text-slate-500 mt-0.5 leading-tight tabular-nums">
                        {request.employee_id}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="truncate px-4 py-2 align-middle text-sm text-slate-700">
                  {request.department_name ?? "—"}
                </td>

                <td className="px-4 py-2 align-middle">
                  <ExitTypeBadge type={request.exit_type} />
                </td>

                <td className="whitespace-nowrap px-4 py-2 align-middle text-sm font-medium text-slate-800 tabular-nums">
                  {formatDate(request.submitted_at)}
                </td>

                <td className="whitespace-nowrap px-4 py-2 align-middle text-sm font-medium text-slate-800 tabular-nums">
                  {formatDate(request.last_working_day)}
                </td>

                <td className="px-4 py-2 align-middle">
                  <ExitStatusBadge status={request.status} />
                </td>

                <td
                  className="pl-3 pr-6 py-2 align-middle text-right"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <ActionsMenu
                    request={request}
                    onOpen={onOpen}
                    onQuickStatus={onQuickStatus}
                    onDelete={onDelete}
                    deleting={deletingId === request.id}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}