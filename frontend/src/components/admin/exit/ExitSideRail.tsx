import { ArrowRight } from "lucide-react";

/** The four-stage lifecycle every exit moves through, per the design. */
const FLOW_STAGES = [
  {
    title: "Submit Request",
    description: "Employee initiates exit request with required details.",
  },
  {
    title: "HR Review",
    description: "HR reviews and verifies the request.",
  },
  {
    title: "Clearance Process",
    description: "Collects approvals, documents and handovers.",
  },
  {
    title: "Final Settlement",
    description: "Payroll processes final settlement and close the exit.",
  },
];

export function ExitProcessFlow() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <ArrowRight className="h-4 w-4 text-blue-600" />
        <h3 className="text-[15px] font-bold text-slate-900">Exit Process Flow</h3>
      </div>

      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FLOW_STAGES.map((stage, index) => (
          <li key={stage.title} className="flex min-w-0 items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {index + 1}
            </span>

            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-slate-900">{stage.title}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                {stage.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}