import type { ExitStatus } from "./types";

const CLASSES: Record<ExitStatus, string> = {
  Pending: "bg-amber-50 text-amber-700 border-amber-100",
  "In Progress": "bg-orange-50 text-orange-700 border-orange-100",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Rejected: "bg-red-50 text-red-700 border-red-100",
  Cancelled: "bg-slate-100 text-slate-600 border-slate-200",
};

function ExitStatusBadge({ status }: { status: ExitStatus }) {
return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${CLASSES[status] ?? CLASSES.Cancelled}`}
    >
      {status}
    </span>
  );
}

export default ExitStatusBadge;