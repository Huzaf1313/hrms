import {
  ArrowRight,
  ChevronRight,
  ClipboardList,
  Headphones,
  Link2,
  Mail,
  Phone,
  Scale,
  Clock,
} from "lucide-react";

/**
 * Placeholder contact details from the design. Swap these for the real HR
 * desk before this ships - there is no backend source for them yet.
 */
const HR_CONTACT = {
  phone: "+91 98765 43210",
  email: "hr@yourcompany.com",
  hours: "Mon - Fri, 9:30 AM - 6:30 PM",
};

const LINKS = [
  { label: "Exit Policy & Guidelines", icon: Scale },
  { label: "Notice Period Rules", icon: Clock },
  { label: "Final Settlement Process", icon: ClipboardList },
  { label: "Document Checklist", icon: Link2 },
];

export function ImportantLinks() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Link2 className="h-4 w-4 text-blue-600" />
        <h3 className="text-[15px] font-bold text-slate-900">Important Links</h3>
      </div>

      <ul className="divide-y divide-slate-100">
        {LINKS.map((link) => {
          const Icon = link.icon;

          return (
            <li key={link.label}>
              <button
                type="button"
                className="group flex w-full items-center gap-2.5 py-2.5 text-left text-[13px] font-medium text-slate-700 transition hover:text-blue-600"
              >
                <Icon className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-blue-500" />
                <span className="min-w-0 flex-1 truncate">{link.label}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function HrSupport() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Headphones className="h-4 w-4 text-blue-600" />
        <h3 className="text-[15px] font-bold text-slate-900">HR Support</h3>
      </div>

      <p className="text-xs leading-5 text-slate-500">
        Need help with an exit process? Contact the HR team for assistance.
      </p>

      <ul className="mt-4 space-y-2.5 text-[13px] text-slate-600">
        <li className="flex items-center gap-2.5">
          <Phone className="h-4 w-4 shrink-0 text-blue-600" />
          {HR_CONTACT.phone}
        </li>
        <li className="flex items-center gap-2.5">
          <Clock className="h-4 w-4 shrink-0 text-blue-600" />
          {HR_CONTACT.hours}
        </li>
        <li className="flex items-center gap-2.5">
          <Mail className="h-4 w-4 shrink-0 text-blue-600" />
          <span className="min-w-0 break-all">{HR_CONTACT.email}</span>
        </li>
      </ul>
    </div>
  );
}

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