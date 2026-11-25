import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  PlayCircle,
  Wallet,
} from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Panel } from "./ExitUi";
import { pickActionable } from "./exitUiUtils";
import { downloadExitCsv } from "./exitRequestService";
import type { ExitRequest } from "./types";

const CHECKLIST_TONE: Record<string, { pill: string; dot: string }> = {
  Pending: {
    pill: "bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]",
    dot: "bg-[#92400E]",
  },
  "In Progress": {
    pill: "bg-[#E8EEFB] text-[#2F5FD0]",
    dot: "bg-[#2F5FD0]",
  },
  Completed: {
    pill: "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]",
    dot: "bg-[#03543F]",
  },
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
      tone: "border-[#BCF0DA] bg-[#DEF7EC] text-[#03543F]",
      enabled: actionable?.status === "Pending",
      onClick: () => actionable && onOpenRequest(actionable),
    },
    {
      label: "Update Clearance Status",
      icon: ClipboardCheck,
      tone: "border-[#E8EEFB] bg-[#E8EEFB] text-[#2F5FD0]",
      enabled: actionable?.status === "In Progress",
      onClick: () => actionable && onOpenRequest(actionable),
    },
    {
      label: "Process Final Settlement",
      icon: Wallet,
      tone: "border-[#F3E8FF] bg-[#F3E8FF] text-[#7E22CE]",
      enabled: actionable?.status === "In Progress",
      onClick: () => actionable && onOpenRequest(actionable),
    },
    {
      label: "Download Exit Report",
      icon: FileSpreadsheet,
      tone: "border-[#E4E6E1] bg-white text-[#1F2933] hover:bg-[#F0F1EE]",
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
        bodyClassName="p-0"
      >
        {tasks.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#6B7280]">
            No clearance checklist has been recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] table-fixed border-collapse text-left text-[12px]">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#4B5563] text-[11px] font-semibold uppercase tracking-wider">
                <tr className="h-10">
                  <th className="w-[8%] px-4 py-0 bg-[#F9FAFB] align-middle font-semibold">#</th>
                  <th className="w-[38%] px-4 py-0 bg-[#F9FAFB] align-middle font-semibold">Step</th>
                  <th className="w-[34%] px-4 py-0 bg-[#F9FAFB] align-middle font-semibold">Description</th>
                  <th className="w-[20%] px-4 py-0 bg-[#F9FAFB] align-middle font-semibold">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#111827]">
                {tasks.map((task, index) => {
                  const tone = CHECKLIST_TONE[task.status] ?? {
                    pill: "bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]",
                    dot: "bg-[#7B8794]",
                  };

                  return (
                    <tr key={`${task.task}-${index}`} className="min-h-[48px] h-12 hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-4 py-2 text-[#6B7280] tabular-nums">{index + 1}.</td>
                      <td className="truncate px-4 py-2 font-medium text-[#111827]">
                        {task.task}
                      </td>
                      <td className="truncate px-4 py-2 text-[#4B5563]">
                        {task.remarks ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1.5 h-[22px] whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-normal ${tone.pill}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${tone.dot}`} />
                          <span>{task.status}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

          {requests.length === 0 && (
            <p className="mt-3 text-[11px] leading-4 text-[#6B7280]">
              Actions stay disabled until there is a request to act on.
            </p>
          )}
        </Panel>

        <div className="rounded-lg border border-[#E8EEFB] bg-[#E8EEFB] p-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#2F5FD0]" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#111827]">Note</p>
              <p className="mt-1 text-xs leading-5 text-[#2F5FD0]">
                Once the final settlement is processed the employee&apos;s account is
                marked inactive and all system access is revoked.
              </p>
            </div>
          </div>
        </div>

        {actionable && (
          <div className="flex items-start gap-2.5 rounded-lg border border-[#BCF0DA] bg-[#DEF7EC] p-4">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#03543F]" />
            <p className="min-w-0 text-xs leading-5 text-[#03543F]">
              {actionable.employee_name} is currently{" "}
              <strong>{actionable.status.toLowerCase()}</strong>. Open the request to
              advance it.
            </p>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={requests.length === 0}
          onClick={exportCsv}
          leftIcon={<Download className="h-3.5 w-3.5 shrink-0" />}
          className="h-9 w-full text-[12px] font-medium shadow-none"
        >
          Export visible rows
        </Button>
      </div>
    </div>
  );
}