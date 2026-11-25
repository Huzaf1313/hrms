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
    <div className="rounded-lg border border-[#E5E7EB] bg-white overflow-hidden shadow-none">
      <div className="flex items-center gap-2 border-b border-[#E5E7EB] bg-white px-6 py-3.5">
        <ArrowRight className="h-4 w-4 shrink-0 text-[#2F5FD0]" />
        <h3 className="text-[13px] font-semibold text-[#111827]">Exit Process Flow</h3>
      </div>

      <ol className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {FLOW_STAGES.map((stage, index) => (
          <li key={stage.title} className="flex min-w-0 items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2F5FD0] text-[12px] font-semibold text-white tabular-nums">
              {index + 1}
            </span>

            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[#111827]">{stage.title}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-[#6B7280]">
                {stage.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}