import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  PlayCircle,
  Wallet,
} from "lucide-react";

import { Panel } from "./ExitUi";
import { pickActionable } from "./exitUiUtils";
import { downloadExitCsv } from "../../../services/exitRequestService";
import type { ExitRequest } from "../../../types/exitRequest";

const CHECKLIST_TONE: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-700",
  "In Progress": "bg-blue-50 text-blue-700",
  Completed: "bg-emerald-50 text-emerald-700",
};

interface ResignationPanelProps {
  requests: ExitRequest[];
  onOpenRequest: (request: ExitRequest) => void;
}

export default function ResignationPanel({
  requests,
  onOpenRequest,
}: ResignationPanelProps) {
  const actionable = pickActionable(requests);
  const checklistSource = actionable ?? requests[0] ?? null;
  const tasks = checklistSource?.handover_tasks ?? [];

  const exportCsv = () => downloadExitCsv(requests, "resignation-requests.csv");

  const actions = [
    {
      label: "Approve Resignation",
      icon: PlayCircle,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      enabled: actionable?.status === "Pending",
      onClick: () => actionable && onOpenRequest(actionable),
    },
    {
      label: "Update Clearance Status",
      icon: ClipboardCheck,
      tone: "border-blue-200 bg-blue-50 text-blue-700",
      enabled: actionable?.status === "In Progress",
      onClick: () => actionable && onOpenRequest(actionable),
    },
    {
      label: "Process Final Settlement",
      icon: Wallet,
      tone: "border-purple-200 bg-purple-50 text-purple-700",
      enabled: actionable?.status === "In Progress",
      onClick: () => actionable && onOpenRequest(actionable),
    },
    {
      label: "Download Exit Report",
      icon: FileSpreadsheet,
      tone: "border-cyan-200 bg-cyan-50 text-cyan-700",
      enabled: requests.length > 0,
      onClick: exportCsv,
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Panel
        title="Exit Process Checklist"
        description={
          checklistSource
            ? `Clearance steps for ${checklistSource.employee_name}.`
            : "Ensure all steps are completed for a smooth exit."
        }
      >
        {tasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No clearance checklist has been recorded yet.
          </p>
        ) : (
          <table className="w-full table-fixed text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="w-[6%] px-2 py-2.5">#</th>
                <th className="w-[40%] px-2 py-2.5">Step</th>
                <th className="w-[34%] px-2 py-2.5">Description</th>
                <th className="w-[20%] px-2 py-2.5">Status</th>
              </tr>
            </thead>

            <tbody>
              {tasks.map((task, index) => (
                <tr key={`${task.task}-${index}`} className="border-b border-slate-50 last:border-0">
                  <td className="px-2 py-3 text-slate-400">{index + 1}.</td>
                  <td className="truncate px-2 py-3 font-medium text-slate-900">
                    {task.task}
                  </td>
                  <td className="truncate px-2 py-3 text-slate-600">
                    {task.remarks ?? "—"}
                  </td>
                  <td className="px-2 py-3">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        CHECKLIST_TONE[task.status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {task.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

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

          {requests.length === 0 && (
            <p className="mt-3 text-[11px] leading-4 text-slate-400">
              Actions stay disabled until there is a request to act on.
            </p>
          )}
        </Panel>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-blue-900">Note</p>
              <p className="mt-1 text-xs leading-5 text-blue-700">
                Once the final settlement is processed the employee&apos;s account is
                marked inactive and all system access is revoked.
              </p>
            </div>
          </div>
        </div>

        {actionable && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="min-w-0 text-xs leading-5 text-emerald-800">
              {actionable.employee_name} is currently{" "}
              <strong>{actionable.status.toLowerCase()}</strong>. Open the request to
              advance it.
            </p>
          </div>
        )}

        <button
          type="button"
          disabled={requests.length === 0}
          onClick={exportCsv}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          Export visible rows
        </button>
      </div>
    </div>
  );
}