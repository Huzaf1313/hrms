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
  { label: "Request", countKey: "total", tone: "bg-[#2F5FD0]" },
  { label: "In Progress", countKey: "in_progress", tone: "bg-[#92400E]" },
  { label: "Completed", countKey: "completed", tone: "bg-[#03543F]" },
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
      tone: "border-[#E8EEFB] bg-[#E8EEFB] text-[#2F5FD0]",
      enabled: true,
      onClick: onInitiateTermination,
    },
    {
      label: "Update Status",
      icon: RefreshCw,
      tone: "border-[#FCD34D] bg-[#FEF3C7] text-[#92400E]",
      enabled: Boolean(actionable),
      onClick: () => actionable && onOpenRequest(actionable),
    },
    {
      label: "Process Settlement",
      icon: Wallet,
      tone: "border-[#BCF0DA] bg-[#DEF7EC] text-[#03543F]",
      enabled: actionable?.status === "In Progress",
      onClick: () => actionable && onOpenRequest(actionable),
    },
    {
      label: "Download Reports",
      icon: Download,
      tone: "border-[#E4E6E1] bg-white text-[#1F2933] hover:bg-[#F0F1EE]",
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
                      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white tabular-nums ${stage.tone}`}
                    >
                      {value}
                    </span>
                    <p className="mt-2 text-[11px] font-medium text-[#4B5563]">
                      {stage.label}
                    </p>
                  </div>

                  {index < STAGES.length - 1 && (
                    <span className="mt-4 h-px w-4 shrink-0 bg-[#E5E7EB]" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ol>
        </Panel>

        <Panel
          title="Recent Termination Activity"
          description="Derived from request submission and review timestamps."
          bodyClassName="p-0"
        >
          {activity.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#6B7280]">
              No termination activity recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] table-fixed border-collapse text-left text-[12px]">
                <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#4B5563] text-[11px] font-semibold uppercase tracking-wider">
                  <tr className="h-10">
                    <th className="w-[26%] px-4 py-0 bg-[#F9FAFB] align-middle font-semibold">Date &amp; Time</th>
                    <th className="w-[24%] px-4 py-0 bg-[#F9FAFB] align-middle font-semibold">Employee</th>
                    <th className="w-[32%] px-4 py-0 bg-[#F9FAFB] align-middle font-semibold">Action</th>
                    <th className="w-[18%] px-4 py-0 bg-[#F9FAFB] align-middle font-semibold">By</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#111827]">
                  {activity.map((row) => (
                    <tr
                      key={row.id}
                      className="min-h-[48px] h-12 hover:bg-[#F9FAFB] transition-colors"
                    >
                      <td className="px-4 py-2 whitespace-nowrap text-[#6B7280] tabular-nums">
                        {formatDateTime(row.at)}
                      </td>
                      <td className="truncate px-4 py-2 font-medium text-[#111827]">
                        {row.employee}
                      </td>
                      <td className="truncate px-4 py-2 text-[#4B5563]">{row.action}</td>
                      <td className="truncate px-4 py-2 text-[#4B5563]">{row.by}</td>
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
                  className={`flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-[12px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] ${
                    action.enabled
                      ? `${action.tone} cursor-pointer`
                      : "cursor-not-allowed border-[#E5E7EB] bg-[#F9FAFB] text-[#7B8794]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">{action.label}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <div className="rounded-lg border border-[#E8EEFB] bg-[#E8EEFB] p-4">
          <div className="flex items-start gap-2.5">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#2F5FD0]" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#111827]">Notes</p>
              <p className="mt-1 text-xs leading-5 text-[#2F5FD0]">
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