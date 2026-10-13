import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Clock3,
  FileText,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  UserCheck,
  Wallet,
} from "lucide-react";
import ExitStatusBadge from "../../components/employee/ExitStatusBadge";
import { ApiError } from "../../services/api";
import { exitRequestService, formatExitDate } from "../../services/exitRequestService";
import type { ExitRequest } from "../../types/exitRequest";

// Edit these to your company's HR contact details.
const HR_EMAIL = "hr@yourcompany.com";
const HR_PHONE = "+91 98765 43210";
const HR_HOURS = "Mon - Fri, 9:30 AM - 6:30 PM";

const OTHER_EXIT_TYPES = [
  { title: "Termination", text: "For terminated employees. This will help us complete the formal exit process." },
  { title: "Retirement", text: "If you are retiring from the organization, submit your retirement request." },
  { title: "Contract End", text: "For contract-based employees whose contract period has ended." },
];

const STEPS = [
  { icon: FileText, title: "1. Submit Request", text: "Fill in the required details and submit your request." },
  { icon: UserCheck, title: "2. HR Review", text: "HR team will review and verify the information." },
  { icon: ShieldCheck, title: "3. Clearance Process", text: "Complete all pending tasks and handovers." },
  { icon: Wallet, title: "4. Final Settlement", text: "Get your dues and final documents." },
];

function EmployeeExit() {
  const [requests, setRequests] = useState<ExitRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    exitRequestService
      .listMine({ page: 1, limit: 5 })
      .then((data) => {
        if (!cancelled) setRequests(data.items);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Unable to load your exit requests.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const hasActive = requests.some(
    (r) => r.status === "Pending" || r.status === "In Progress",
  );

  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <LogOut className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Exit / Offboarding</h1>
            <p className="text-sm text-slate-500">
              Manage your resignation, termination or other exit process related requests.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
          <h2 className="font-semibold text-slate-900">Thinking of moving on?</h2>
          <p className="mt-1 text-sm text-slate-500">
            Whether it&apos;s a new opportunity, career break or any other reason — we&apos;re
            here to support you through the exit process.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Select Exit Type</h2>
          <p className="text-sm text-slate-500">Choose the type of exit request you want to initiate.</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-5">
              <h3 className="font-semibold text-slate-900">Resignation</h3>
              <p className="mt-1 text-sm text-slate-500">
                Submit your resignation request. Please provide notice period and reason for leaving.
              </p>
              {hasActive ? (
                <p className="mt-4 text-sm font-medium text-amber-700">
                  You already have an active resignation request.
                </p>
              ) : (
                <Link
                  to="/employee/exit/resignation"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-blue-600 px-4 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
                >
                  Start Request <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>

            {OTHER_EXIT_TYPES.map((type) => (
              <div key={type.title} className="rounded-xl border border-slate-200 bg-slate-50 p-5 opacity-70">
                <h3 className="font-semibold text-slate-900">{type.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{type.text}</p>
                <span className="mt-4 inline-block rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
                  Coming soon
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">What Happens Next?</h2>
          <p className="text-sm text-slate-500">Here&apos;s how the exit process works:</p>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900">{title}</p>
                <p className="text-xs text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">My Exit Requests</h2>

          {loading && <p className="mt-4 text-sm text-slate-500">Loading…</p>}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          {!loading && !error && requests.length === 0 && (
            <p className="mt-4 text-sm text-slate-500">You have not submitted any exit requests.</p>
          )}

          <ul className="mt-4 divide-y divide-slate-100">
            {requests.map((request) => (
              <li key={request.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{request.exit_type}</p>
                  <p className="text-xs text-slate-500">
                    Submitted on {formatExitDate(request.submitted_at)}
                  </p>
                </div>
                <ExitStatusBadge status={request.status} />
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
          <h2 className="font-semibold text-slate-900">Need Help?</h2>
          <p className="mt-1 text-sm text-slate-500">
            For any queries related to the exit process, please contact our HR team.
          </p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {HR_EMAIL}</p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {HR_PHONE}</p>
            <p className="flex items-center gap-2"><Clock3 className="h-4 w-4" /> {HR_HOURS}</p>
          </div>
        </section>
      </aside>
    </div>
  );
}

export default EmployeeExit;