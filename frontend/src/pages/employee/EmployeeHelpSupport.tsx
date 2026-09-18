import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  ChevronDown,
  FileText,
  Headphones,
  HelpCircle,
  Laptop,
  Mail,
  MessageSquarePlus,
  Phone,
  Search,
  UserRound,
  Wallet,
} from "lucide-react";

type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: "In Progress" | "Resolved";
  createdOn: string;
};

type HelpTopic = {
  title: string;
  description: string;
  icon: typeof CalendarCheck2;
};

type FAQ = {
  question: string;
  answer: string;
};

const tickets: Ticket[] = [
  {
    id: "#TKT-1003",
    subject: "Login issue with HRMS portal",
    category: "IT & System",
    status: "In Progress",
    createdOn: "May 12, 2025",
  },
  {
    id: "#TKT-1002",
    subject: "Payslip not available for April",
    category: "Payroll & Salary",
    status: "Resolved",
    createdOn: "May 08, 2025",
  },
  {
    id: "#TKT-1001",
    subject: "Leave balance clarification",
    category: "Leave & Attendance",
    status: "Resolved",
    createdOn: "May 03, 2025",
  },
];

const helpTopics: HelpTopic[] = [
  {
    title: "Leave & Attendance",
    description: "How to apply for leave, attendance rules, and more.",
    icon: CalendarCheck2,
  },
  {
    title: "Payroll & Salary",
    description: "Salary details, payslips, deductions, and more.",
    icon: Wallet,
  },
  {
    title: "Documents",
    description: "Access important documents and certificates.",
    icon: FileText,
  },
  {
    title: "Performance",
    description: "Goals, reviews, feedback, and performance queries.",
    icon: BookOpen,
  },
  {
    title: "Assets",
    description: "Request or track company assets.",
    icon: Laptop,
  },
  {
    title: "IT & System",
    description: "Login issues, software access, and system problems.",
    icon: Headphones,
  },
];

const faqs: FAQ[] = [
  {
    question: "How can I apply for leave?",
    answer:
      "Open My Leave from the employee portal, select the required leave type and dates, then submit your leave request for approval.",
  },
  {
    question: "Where can I view my payslip?",
    answer:
      "You can view your salary information and available payslips from the My Payslip section.",
  },
  {
    question: "How do I update my personal details?",
    answer:
      "Open My Profile to review your personal information. If a field cannot be edited, contact HR for assistance.",
  },
  {
    question: "What is the company's working hours?",
    answer:
      "The standard working hours are Monday to Friday, 9:30 AM to 6:30 PM.",
  },
  {
    question: "How can I reset my password?",
    answer:
      "Use the password reset option on the login page. If you continue to have problems, contact the IT support team.",
  },
];

function readUser() {
  try {
    const raw = localStorage.getItem("user");

    return raw
      ? (JSON.parse(raw) as {
          full_name?: string;
          employee_id?: string | null;
        })
      : null;
  } catch {
    return null;
  }
}

function EmployeeHelpSupport() {
  const user = useMemo(() => readUser(), []);
  const fullName = user?.full_name ?? "Employee";

  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return faqs;
    }

    return faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  const filteredTopics = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return helpTopics;
    }

    return helpTopics.filter(
      (topic) =>
        topic.title.toLowerCase().includes(query) ||
        topic.description.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        {/* Page Header */}
        <section className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Help &amp; Support
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Find answers to common questions, raise a request or get in touch
            with our support team.
          </p>
        </section>

        {/* Search Banner */}
        <section className="relative mb-7 overflow-hidden rounded-2xl bg-[#0d1e3e] px-6 py-7 shadow-sm sm:px-8 sm:py-8">
          <div className="relative z-10 max-w-3xl">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-200">
              <HelpCircle className="h-4 w-4" />
              <span>Support Center</span>
            </div>

            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Hi {fullName}, How can we help you today?
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Search our help resources or connect with the right support team
              for assistance.
            </p>

            <div className="mt-5 flex max-w-2xl items-center rounded-xl bg-white px-4 shadow-lg">
              <Search className="h-5 w-5 shrink-0 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search for FAQs, policies, or type your issue..."
                className="h-12 w-full bg-transparent px-3 text-sm text-gray-800 outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Support Illustration */}
          <div className="pointer-events-none absolute right-8 top-1/2 hidden -translate-y-1/2 lg:block">
            <div className="relative flex h-44 w-52 items-center justify-center">
              <div className="absolute h-36 w-36 rounded-full bg-blue-500/10" />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white/10">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#2563eb] shadow-xl">
                  <Headphones className="h-10 w-10 text-white" />
                </div>
              </div>

              <div className="absolute right-0 top-5 flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-lg">
                <MessageSquarePlus className="h-5 w-5 text-[#2563eb]" />
              </div>

              <div className="absolute bottom-4 left-2 flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-lg">
                <Laptop className="h-5 w-5 text-[#2563eb]" />
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">Quick Actions</h2>
            <p className="mt-1 text-sm text-gray-500">
              Get help quickly using one of the options below.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => {
                document
                  .getElementById("faq-section")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#2563eb]">
                  <BookOpen className="h-5 w-5" />
                </span>
                <ArrowRight className="h-4 w-4 text-gray-300 transition group-hover:translate-x-1 group-hover:text-[#2563eb]" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-gray-900">
                View FAQs
              </h3>
              <p className="mt-1.5 text-xs leading-5 text-gray-500">
                Find quick answers to common questions.
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("support-tickets")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#2563eb]">
                  <MessageSquarePlus className="h-5 w-5" />
                </span>
                <ArrowRight className="h-4 w-4 text-gray-300 transition group-hover:translate-x-1 group-hover:text-[#2563eb]" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-gray-900">
                Raise a Ticket
              </h3>
              <p className="mt-1.5 text-xs leading-5 text-gray-500">
                Need help? Create a support ticket and we&apos;ll get back to
                you.
              </p>
            </button>

            <a
              href="mailto:hr@yourcompany.com"
              className="group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#2563eb]">
                  <UserRound className="h-5 w-5" />
                </span>
                <ArrowRight className="h-4 w-4 text-gray-300 transition group-hover:translate-x-1 group-hover:text-[#2563eb]" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-gray-900">
                Contact HR
              </h3>
              <p className="mt-1.5 text-xs leading-5 text-gray-500">
                For HR related queries, policies or personal matters.
              </p>
            </a>

            <a
              href="tel:+919876543210"
              className="group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#2563eb]">
                  <Phone className="h-5 w-5" />
                </span>
                <ArrowRight className="h-4 w-4 text-gray-300 transition group-hover:translate-x-1 group-hover:text-[#2563eb]" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-gray-900">
                Call Support
              </h3>
              <p className="mt-1.5 text-xs leading-5 text-gray-500">
                Talk to our support team during office hours.
              </p>
            </a>
          </div>
        </section>

        {/* Main Content */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            {/* Popular Help Topics */}
            <section className="mb-7">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  Popular Help Topics
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Browse common topics to find the information you need.
                </p>
              </div>

              {filteredTopics.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredTopics.map((topic) => {
                    const Icon = topic.icon;

                    return (
                      <button
                        key={topic.title}
                        type="button"
                        onClick={() => setSearchQuery(topic.title)}
                        className="group rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#2563eb]">
                          <Icon className="h-5 w-5" />
                        </div>

                        <h3 className="mt-4 text-sm font-bold text-gray-900">
                          {topic.title}
                        </h3>

                        <p className="mt-1.5 text-xs leading-5 text-gray-500">
                          {topic.description}
                        </p>

                        <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#2563eb]">
                          Explore
                          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
                  <Search className="mx-auto h-7 w-7 text-gray-300" />
                  <p className="mt-3 text-sm font-semibold text-gray-700">
                    No help topics found
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Try a different search term.
                  </p>
                </div>
              )}
            </section>

            {/* Support Tickets */}
            <section id="support-tickets" className="mb-7">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    My Support Tickets
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Your most recent support requests.
                  </p>
                </div>

                <button
                  type="button"
                  className="shrink-0 text-sm font-semibold text-[#2563eb] hover:underline"
                >
                  View All
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Ticket ID
                        </th>
                        <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Subject
                        </th>
                        <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Category
                        </th>
                        <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Status
                        </th>
                        <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Created On
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {tickets.map((ticket) => (
                        <tr
                          key={ticket.id}
                          className="transition hover:bg-gray-50"
                        >
                          <td className="px-5 py-4 text-sm font-semibold text-[#2563eb]">
                            {ticket.id}
                          </td>

                          <td className="px-5 py-4 text-sm font-medium text-gray-800">
                            {ticket.subject}
                          </td>

                          <td className="px-5 py-4 text-sm text-gray-600">
                            {ticket.category}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                ticket.status === "In Progress"
                                  ? "bg-orange-50 text-orange-600"
                                  : "bg-green-50 text-green-600"
                              }`}
                            >
                              {ticket.status}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-sm text-gray-500">
                            {ticket.createdOn}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>

          {/* Right Sidebar */}
          <aside className="space-y-6">
            {/* FAQ */}
            <section
              id="faq-section"
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Frequently Asked Questions
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Find answers to common questions.
                  </p>
                </div>

                <button
                  type="button"
                  className="shrink-0 text-xs font-semibold text-[#2563eb] hover:underline"
                >
                  View All
                </button>
              </div>

              <div className="divide-y divide-gray-100">
                {filteredFaqs.map((faq, index) => {
                  const isOpen = openFaq === index;

                  return (
                    <div key={faq.question}>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenFaq(isOpen ? null : index)
                        }
                        className="flex w-full items-center justify-between gap-4 py-3.5 text-left"
                      >
                        <span className="text-sm font-medium text-gray-700">
                          {faq.question}
                        </span>

                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-gray-400 transition ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {isOpen && (
                        <div className="pb-3.5 pr-5 text-xs leading-5 text-gray-500">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredFaqs.length === 0 && (
                  <div className="py-6 text-center">
                    <p className="text-xs text-gray-500">
                      No matching FAQs found.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Contact HR */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#2563eb]">
                  <UserRound className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Contact HR
                  </h2>
                  <p className="text-xs text-gray-500">
                    Need assistance from HR?
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3.5">
                <a
                  href="mailto:hr@yourcompany.com"
                  className="flex items-center gap-3 rounded-xl bg-gray-50 px-3.5 py-3 transition hover:bg-blue-50"
                >
                  <Mail className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-[11px] text-gray-400">Email</p>
                    <p className="text-sm font-medium text-gray-700">
                      hr@yourcompany.com
                    </p>
                  </div>
                </a>

                <a
                  href="tel:+919876543210"
                  className="flex items-center gap-3 rounded-xl bg-gray-50 px-3.5 py-3 transition hover:bg-blue-50"
                >
                  <Phone className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-[11px] text-gray-400">Phone</p>
                    <p className="text-sm font-medium text-gray-700">
                      +91 98765 43210
                    </p>
                  </div>
                </a>

                <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-3.5 py-3">
                  <CalendarCheck2 className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-[11px] text-gray-400">
                      Working Hours
                    </p>
                    <p className="text-sm font-medium text-gray-700">
                      Mon - Fri, 9:30 AM - 6:30 PM
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Immediate Help */}
            <section className="overflow-hidden rounded-2xl bg-[#0d1e3e] p-5 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300">
                <Headphones className="h-5 w-5" />
              </div>

              <h2 className="mt-4 text-base font-bold text-white">
                Need Immediate Help?
              </h2>

              <p className="mt-2 text-xs leading-5 text-slate-300">
                For urgent issues, please call our support helpline or raise a
                ticket with high priority.
              </p>

              <a
                href="tel:+919876543210"
                className="mt-5 flex h-10 items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                <Phone className="h-4 w-4" />
                Call Support
              </a>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default EmployeeHelpSupport;