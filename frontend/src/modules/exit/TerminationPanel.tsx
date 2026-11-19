import {
  Download,
  FileText,
  Flag,
  RefreshCw,
  Wallet,
} from "lucide-react";

import { Panel } from "./ExitUi";
import { formatDateTime, pickActionable } from "./exitUiUtils";
import { downloadExitCsv } from "./exitRequestService";
import type { ExitRequest, ExitRequestSummary } from "./types";

/** The lifecycle an exit moves through, with the real count behind each stage. */
const STAGES: Array<{
  label: string;
  countKey: keyof ExitRequestSummary | "total";
  tone: string;
}> = [
  { label: "Request", countKey: "total", tone: "bg-blue-500" },
  { label: "In Progress", countKey: "in_progress", tone: "bg-amber-500" },
  { label: "Completed", countKey: "completed", tone: "bg-emerald-500" },
];

interface ActivityRow {
  id: string;
  at: string;
  employee: string;
  action: string;
  by: string;
}

/**
 * Recent activity, derived from the timestamps a request actually carries:
 * when it was raised and when it was last reviewed. There is no separate audit
 * log in the schema, so nothing here is invented.
 */
function buildActivity(requests: ExitRequest[]): ActivityRow[] {
  const rows: ActivityRow[] = [];

  for (const request of requests) {
    if (request.submitted_at) {
      rows.push({
        id: `${request.id}-submitted`,
        at: request.submitted_at,
        employee: request.employee_name ?? request.employee_id,
        action: `${request.exit_type} Request Submitted`,
        by: request.employee_name ?? "Employee",
      });
    }

    if (request.reviewed_at) {
      rows.push({
        id: `${request.id}-reviewed`,
        at: request.reviewed_at,
        employee: request.employee_name ?? request.employee_id,
        action: `Status updated to ${request.status}`,
        by: request.reviewed_by ?? "HR",
      });
    }
  }

  return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
}

interface TerminationPanelProps {
  requests: ExitRequest[];
  summary: ExitRequestSummary | null;
  onOpenRequest: (request: ExitRequest) => void;
  onInitiateTermination: () => void;
}

export default function TerminationPanel({
  requests,
  summary,
  onOpenRequest,
  onInitiateTermination,
}: TerminationPanelProps) {
  const actionable = pickActionable(requests);
  const activity = buildActivity(requests);

  const exportCsv = () => downloadExitCsv(requests, "termination-requests.csv");

  const actions = [
    {
      label: "Initiate Termination",
      icon: Flag,
      tone: "border-blue-200 bg-blue-50 text-blue-700",
      enabled: true,
      onClick: onInitiateTermination,
    },
    {
      label: "Update Status",
      icon: RefreshCw,
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      enabled: Boolean(actionable),
      onClick: () => actionable && onOpenRequest(actionable),
    },
    {
      label: "Process Settlement",
      icon: Wallet,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      enabled: actionable?.status === "In Progress",
      onClick: () => actionable && onOpenRequest(actionable),
    },
    {
      label: "Download Reports",
      icon: Download,
      tone: "border-cyan-200 bg-cyan-50 text-cyan-700",
      enabled: requests.length > 0,
      onClick: exportCsv,
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel title="Termination Pipeline">
          <ol className="flex items-start justify-between gap-2">
            {STAGES.map((stage, index) => {
              const value = summary
                ? stage.countKey === "total"
                  ? summary.total
                  : (summary[stage.countKey] as number)
                : 0;

              return (
                <li key={stage.label} className="flex min-w-0 flex-1 items-start gap-2">
                  <div className="min-w-0 flex-1 text-center">
                    <span
                      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${stage.tone}`}
                    >
                      {value}
                    </span>
                    <p className="mt-2 text-[11px] font-semibold text-slate-700">
                      {stage.label}
                    </p>
                  </div>

                  {index < STAGES.length - 1 && (
                    <span className="mt-4 h-px w-4 shrink-0 bg-slate-200" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ol>
        </Panel>

        <Panel
          title="Recent Termination Activity"
          description="Derived from request submission and review timestamps."
        >
          {activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No termination activity recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] table-fixed text-left text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="w-[26%] px-2 py-2.5">Date &amp; Time</th>
                    <th className="w-[24%] px-2 py-2.5">Employee</th>
                    <th className="w-[32%] px-2 py-2.5">Action</th>
                    <th className="w-[18%] px-2 py-2.5">By</th>
                  </tr>
                </thead>

                <tbody>
                  {activity.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="px-2 py-3 whitespace-nowrap text-slate-500">
                        {formatDateTime(row.at)}
                      </td>
                      <td className="truncate px-2 py-3 font-medium text-slate-900">
                        {row.employee}
                      </td>
                      <td className="truncate px-2 py-3 text-slate-600">{row.action}</td>
                      <td className="truncate px-2 py-3 text-slate-600">{row.by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Quick Actions">
          <div className="space-y-2">
            {actions.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.label}
                  type="button"
                  disabled={!action.enabled}
                  onClick={action.onClick}
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-[13px] font-semibold transition ${
                    action.enabled
                      ? `${action.tone} hover:opacity-90`
                      : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{action.label}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-start gap-2.5">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-blue-900">Notes</p>
              <p className="mt-1 text-xs leading-5 text-blue-700">
                Ensure all documents are collected, access is revoked and final
                settlement is processed before marking the exit as completed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}