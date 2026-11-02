
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Headphones,
  HelpCircle,
  Laptop,
  LoaderCircle,
  Mail,
  MessageSquarePlus,
  Phone,
  Search,
  Send,
  Ticket,
  UserRound,
  X,
} from "lucide-react";

import {
  employeeSupportTicketService,
  type SupportTicket,
  type SupportTicketCategory,
  type SupportTicketPriority,
} from "../../services/employee_support_ticket_service";

type FAQ = {
  question: string;
  answer: string;
};

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

function getStatusStyle(status: SupportTicket["status"]) {
  switch (status) {
    case "Open":
      return "bg-blue-50 text-blue-700 ring-blue-600/20";
    case "In Progress":
      return "bg-amber-50 text-amber-700 ring-amber-600/20";
    case "Waiting for Employee":
      return "bg-purple-50 text-purple-700 ring-purple-600/20";
    case "Resolved":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
    case "Closed":
      return "bg-gray-100 text-gray-600 ring-gray-500/20";
    default:
      return "bg-gray-100 text-gray-600 ring-gray-500/20";
  }
}

function getPriorityStyle(priority: SupportTicket["priority"]) {
  switch (priority) {
    case "Urgent":
      return "bg-red-50 text-red-700";
    case "High":
      return "bg-orange-50 text-orange-700";
    case "Medium":
      return "bg-blue-50 text-blue-700";
    case "Low":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function EmployeeHelpSupport() {
  const user = useMemo(() => readUser(), []);
  const fullName = user?.full_name ?? "Employee";

  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Ticket form
  const [subject, setSubject] = useState("");
  const [category, setCategory] =
    useState<SupportTicketCategory>("IT");
  const [priority, setPriority] =
    useState<SupportTicketPriority>("Medium");
  const [description, setDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  // Ticket history
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isTicketFormOpen, setIsTicketFormOpen] = useState(false);
  const [shouldScrollToTicketForm, setShouldScrollToTicketForm] =
  useState(false);

  useEffect(() => {
    if (!isTicketFormOpen || !shouldScrollToTicketForm) return;

    document
      .getElementById("support-tickets")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

    setShouldScrollToTicketForm(false);
  }, [isTicketFormOpen, shouldScrollToTicketForm]);

  const pageSize = 5;

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

  const loadTickets = useCallback(async (page = 1) => {
    setTicketsLoading(true);
    setTicketsError("");

    try {
      const response = await employeeSupportTicketService.list(
        page,
        pageSize,
      );

      setTickets(response.tickets);
      setTotalTickets(response.total);
      setTotalPages(response.total_pages);
      setCurrentPage(response.page);
    } catch {
      setTicketsError(
        "Unable to load your support tickets. Please try again.",
      );
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets(1);
  }, [loadTickets]);

  const handleTicketSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setSubmitError("");
    setSubmitSuccess("");

    const trimmedSubject = subject.trim();
    const trimmedDescription = description.trim();

    if (trimmedSubject.length < 5) {
      setSubmitError(
        "Subject must contain at least 5 characters.",
      );
      return;
    }

    if (trimmedSubject.length > 150) {
      setSubmitError(
        "Subject cannot exceed 150 characters.",
      );
      return;
    }

    if (trimmedDescription.length < 10) {
      setSubmitError(
        "Description must contain at least 10 characters.",
      );
      return;
    }

    if (trimmedDescription.length > 5000) {
      setSubmitError(
        "Description cannot exceed 5,000 characters.",
      );
      return;
    }

    setSubmitting(true);

    try {
      await employeeSupportTicketService.create({
        subject: trimmedSubject,
        category,
        priority,
        description: trimmedDescription,
      });

      setSubject("");
      setCategory("IT");
      setPriority("Medium");
      setDescription("");

      setSubmitSuccess(
        "Your support ticket has been created successfully.",
      );

      // Refresh ticket history after successful creation.
      await loadTickets(1);
    } catch {
      setSubmitError(
        "Unable to submit your ticket. Please check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

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
                aria-label="Search frequently asked questions"
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
            <h2 className="text-lg font-bold text-gray-900">
              Quick Actions
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Get help quickly using one of the options below.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("faq-section")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="group rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
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
              onClick={() => {
                setIsTicketFormOpen((prev) => !prev);
              }}
              className="group rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
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
                Create a support ticket and track its progress.
              </p>
            </button>

            <a
              href="mailto:hr@yourcompany.com"
              className="group rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
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
                For HR-related queries, policies or personal matters.
              </p>
            </a>

            <a
              href="tel:+919876543210"
              className="group rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
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
        <div className="mx-auto w-full max-w-5xl space-y-6">
          {/* Raise a Ticket */}
          {isTicketFormOpen && (
          <section
            id="support-tickets"
            className="scroll-mt-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6"
          >
          <div className="mb-6 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#2563eb]">
                <MessageSquarePlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Raise a Support Ticket
                </h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Describe your issue and our support team will review your request.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsTicketFormOpen(false)}
              aria-label="Close ticket form"
              title="Close form"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>


            <form onSubmit={handleTicketSubmit} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="ticket-subject"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="ticket-subject"
                    type="text"
                    required
                    minLength={5}
                    maxLength={150}
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Briefly describe your issue"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Minimum 5 characters, maximum 150.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="ticket-category"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="ticket-category"
                    value={category}
                    onChange={(event) =>
                      setCategory(
                        event.target.value as SupportTicketCategory,
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="IT">IT Support</option>
                    <option value="HR">Human Resources</option>
                    <option value="Payroll">Payroll</option>
                    <option value="Attendance">Attendance</option>
                    <option value="Leave">Leave Management</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ticket-priority"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Priority <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="ticket-priority"
                    value={priority}
                    onChange={(event) =>
                      setPriority(
                        event.target.value as SupportTicketPriority,
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="ticket-description"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="ticket-description"
                    required
                    minLength={10}
                    maxLength={5000}
                    rows={5}
                    value={description}
                    onChange={(event) =>
                      setDescription(event.target.value)
                    }
                    placeholder="Explain the issue, what you were trying to do, and any error messages you encountered..."
                    className="w-full resize-y rounded-xl border border-gray-200 px-3.5 py-3 text-sm leading-6 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <div className="mt-1 flex justify-between gap-3 text-xs text-gray-400">
                    <span>Minimum 10 characters, maximum 5,000.</span>
                    <span>{description.length}/5000</span>
                  </div>
                </div>
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm text-red-700"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {submitSuccess && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3.5 text-sm text-emerald-700"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{submitSuccess}</span>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-500">
                  All fields marked with * are required.
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Submit Ticket
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
          )}

          {/* My Support Tickets */}
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Ticket className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    My Support Tickets
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Track the status of your support requests.
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                {totalTickets}{" "}
                {totalTickets === 1 ? "ticket" : "tickets"}
              </span>
            </div>

            {ticketsLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
                <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" />
                Loading your tickets...
              </div>
            ) : ticketsError ? (
              <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-center">
                <p className="text-sm text-red-700">{ticketsError}</p>
                <button
                  type="button"
                  onClick={() => void loadTickets(currentPage)}
                  className="mt-3 text-sm font-semibold text-blue-700 hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : tickets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center">
                <Ticket className="mx-auto h-8 w-8 text-gray-300" />
                <h3 className="mt-3 text-sm font-semibold text-gray-700">
                  No support tickets yet
                </h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  When you submit a ticket, it will appear here so you can
                  track its status.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <article
                    key={ticket.id}
                    className="rounded-xl border border-gray-100 p-4 transition hover:border-blue-100 hover:bg-gray-50/50"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-blue-700">
                            #{ticket.id.slice(-8).toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-400">
                            {ticket.category}
                          </span>
                        </div>

                        <h3 className="mt-2 break-words text-sm font-semibold text-gray-900">
                          {ticket.subject}
                        </h3>

                        <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-gray-500">
                          {ticket.description}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${getPriorityStyle(ticket.priority)}`}
                          >
                            {ticket.priority} priority
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${getStatusStyle(ticket.status)}`}
                          >
                            <Clock3 className="h-3 w-3" />
                            {ticket.status}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 text-xs text-gray-400 sm:text-right">
                        <p>Created</p>
                        <p className="mt-1 font-medium text-gray-600">
                          {new Date(ticket.created_at).toLocaleDateString(
                            "en-IN",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}

                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                    <p className="text-xs text-gray-500">
                      Page {currentPage} of {totalPages}
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={currentPage <= 1 || ticketsLoading}
                        onClick={() => void loadTickets(currentPage - 1)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </button>

                      <button
                        type="button"
                        disabled={
                          currentPage >= totalPages || ticketsLoading
                        }
                        onClick={() => void loadTickets(currentPage + 1)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* FAQ */}
          <section
            id="faq-section"
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
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
                onClick={() => {
                  setIsTicketFormOpen(true);
                  setShouldScrollToTicketForm(true);
                }}
                className="shrink-0 text-xs font-semibold text-[#2563eb] hover:underline"
              >
                Clear Search
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
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
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
        </div>
      </div>
    </main>
  );
}

export default EmployeeHelpSupport;