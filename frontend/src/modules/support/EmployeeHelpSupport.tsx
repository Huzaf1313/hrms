import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  HelpCircle,
  Mail,
  MessageSquarePlus,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Ticket,
  UserRound,
  X,
} from "lucide-react";

import {
  employeeSupportTicketService,
  type SupportTicket,
  type SupportTicketCategory,
  type SupportTicketPriority,
} from "./employee_support_ticket_service";
import {
  getSupportContactConfig,
  type SupportContactConfig,
} from "./supportConfig";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeading } from "../../components/ui/PageHeading";
import { Skeleton } from "../../components/ui/Skeleton";

interface FAQ {
  question: string;
  answer: string;
  topic: string;
  linkTo?: string;
  linkLabel?: string;
}

type DetailedSupportTicket = SupportTicket & {
  resolution_note?: string | null;
  handled_by?: string | null;
  handled_at?: string | null;
};

type TicketStatusFilter = "all" | "active" | "resolved";
type CopyField = "email" | "phone" | "hours";

export interface EmployeeHelpSupportProps {
  contactConfig?: Partial<SupportContactConfig>;
}

const FAQS: FAQ[] = [
  {
    question: "How can I apply for leave?",
    answer:
      "Open My Leave from the employee portal, select the required leave type and dates, then submit your leave request for approval.",
    topic: "Leave",
    linkTo: "/employee/leave",
    linkLabel: "Open My Leave",
  },
  {
    question: "Where can I view my payslip?",
    answer:
      "You can view your salary information, monthly breakdowns, and downloadable payslips from the My Payslip section.",
    topic: "Payslip",
    linkTo: "/employee/payroll",
    linkLabel: "Open My Payslip",
  },
  {
    question: "How do I update my personal details?",
    answer:
      "Open My Profile to review your personal information. If a field is locked or managed by HR, raise an HR ticket for assistance.",
    topic: "Profile",
    linkTo: "/employee/profile",
    linkLabel: "Open My Profile",
  },
  {
    question: "What are the standard working hours?",
    answer:
      "Standard working hours follow your assigned shift schedule (typically 9:30 AM to 6:30 PM on working days). Check My Attendance for exact shift timings.",
    topic: "Working Hours",
    linkTo: "/employee/attendance",
    linkLabel: "View My Attendance",
  },
  {
    question: "How can I reset my password?",
    answer:
      "Use the password reset option on the login page or visit Security settings under My Profile. If you remain locked out, raise an IT Support ticket.",
    topic: "Password",
    linkTo: "/employee/profile",
    linkLabel: "Go to Profile Security",
  },
];

const QUICK_TOPICS = ["Leave", "Payslip", "Profile", "Working Hours", "Password"];

const TICKET_PRESETS: Array<{
  label: string;
  subject: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
}> = [
  {
    label: "VPN / Laptop Issue",
    subject: "Unable to connect to company VPN or workstation issue",
    category: "IT",
    priority: "High",
  },
  {
    label: "Payslip / Tax Query",
    subject: "Clarification needed on monthly payslip deductions",
    category: "Payroll",
    priority: "Medium",
  },
  {
    label: "Attendance / Leave Fix",
    subject: "Assistance needed with attendance or leave record",
    category: "Attendance",
    priority: "Medium",
  },
  {
    label: "Profile Update",
    subject: "Request update to employee profile information",
    category: "HR",
    priority: "Low",
  },
];

const TICKET_CATEGORIES: Array<{
  value: SupportTicketCategory;
  label: string;
}> = [
  { value: "IT", label: "IT Support" },
  { value: "HR", label: "HR" },
  { value: "Payroll", label: "Payroll" },
  { value: "Attendance", label: "Attendance" },
  { value: "Leave", label: "Leave" },
  { value: "Other", label: "Other" },
];

const TICKET_PRIORITIES: Array<{
  value: SupportTicketPriority;
  hint: string;
}> = [
  { value: "Low", hint: "General inquiry with flexible timeline" },
  { value: "Medium", hint: "Standard workplace support request" },
  { value: "High", hint: "Impacting daily work, needs prompt review" },
  { value: "Urgent", hint: "Critical blocker requiring immediate attention" },
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

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusStyle(status: SupportTicket["status"]) {
  switch (status) {
    case "Open":
      return "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-800/60";
    case "In Progress":
      return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/60";
    case "Waiting for Employee":
      return "bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-800/60";
    case "Resolved":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60";
    case "Closed":
      return "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300";
  }
}

function getPriorityDotStyle(priority: SupportTicket["priority"]) {
  switch (priority) {
    case "Urgent":
      return "bg-rose-500";
    case "High":
      return "bg-orange-500";
    case "Medium":
      return "bg-blue-500";
    case "Low":
      return "bg-slate-400";
    default:
      return "bg-slate-400";
  }
}

function EmployeeHelpSupport({ contactConfig }: EmployeeHelpSupportProps = {}) {
  const user = useMemo(() => readUser(), []);
  const fullName = user?.full_name ?? "Employee";
  const contact = useMemo(
    () => getSupportContactConfig(contactConfig),
    [contactConfig],
  );
  const telHref = `tel:${contact.phone.replace(/[^\d+]/g, "")}`;

  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [openFaqIndices, setOpenFaqIndices] = useState<number[]>([0]);
  const [statusFilter, setStatusFilter] = useState<TicketStatusFilter>("all");

  // Raise Ticket Modal
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<SupportTicketCategory>("IT");
  const [priority, setPriority] = useState<SupportTicketPriority>("Medium");
  const [description, setDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [pageSuccessNotice, setPageSuccessNotice] = useState("");

  // Ticket history
  const [tickets, setTickets] = useState<DetailedSupportTicket[]>([]);
  const [accountSummaryTickets, setAccountSummaryTickets] = useState<
    DetailedSupportTicket[]
  >([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ticketsError, setTicketsError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Ticket details modal
  const [selectedTicket, setSelectedTicket] =
    useState<DetailedSupportTicket | null>(null);
  const [loadingTicketDetail, setLoadingTicketDetail] = useState(false);

  // Copy feedback
  const [copiedField, setCopiedField] = useState<CopyField | null>(null);

  const pageSize = 5;

  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return FAQS;

    return FAQS.filter(
      (faq) =>
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        faq.topic.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (statusFilter === "active") {
        return ticket.status !== "Resolved" && ticket.status !== "Closed";
      }
      if (statusFilter === "resolved") {
        return ticket.status === "Resolved" || ticket.status === "Closed";
      }
      return true;
    });
  }, [tickets, statusFilter]);

  const activeTicketCount = useMemo(
    () =>
      accountSummaryTickets.filter(
        (t) => t.status !== "Resolved" && t.status !== "Closed",
      ).length,
    [accountSummaryTickets],
  );

  const resolvedTicketCount = useMemo(
    () =>
      accountSummaryTickets.filter(
        (t) => t.status === "Resolved" || t.status === "Closed",
      ).length,
    [accountSummaryTickets],
  );

  const loadTickets = useCallback(async (page = 1) => {
    setTicketsLoading(true);
    setTicketsError("");

    try {
      const response = await employeeSupportTicketService.list(page, pageSize);

      setTickets(response.tickets);
      setTotalTickets(response.total);
      setTotalPages(response.total_pages);
      setCurrentPage(response.page);

      if (response.total <= response.tickets.length) {
        setAccountSummaryTickets(response.tickets);
      } else {
        try {
          const allRes = await employeeSupportTicketService.list(1, 100);
          setAccountSummaryTickets(allRes.tickets);
        } catch {
          setAccountSummaryTickets(response.tickets);
        }
      }
    } catch {
      setTicketsError(
        "Unable to load your support tickets. Please try again.",
      );
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void employeeSupportTicketService
      .list(1, pageSize)
      .then(async (response) => {
        if (!active) return;
        setTickets(response.tickets);
        setTotalTickets(response.total);
        setTotalPages(response.total_pages);
        setCurrentPage(response.page);
        setTicketsError("");

        if (response.total <= response.tickets.length) {
          setAccountSummaryTickets(response.tickets);
        } else {
          try {
            const allRes = await employeeSupportTicketService.list(1, 100);
            if (active) setAccountSummaryTickets(allRes.tickets);
          } catch {
            if (active) setAccountSummaryTickets(response.tickets);
          }
        }
      })
      .catch(() => {
        if (active) {
          setTicketsError(
            "Unable to load your support tickets. Please try again.",
          );
        }
      })
      .finally(() => {
        if (active) setTicketsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedTicket) {
        setSelectedTicket(null);
      } else if (isTicketModalOpen && !submitting) {
        setIsTicketModalOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedTicket, isTicketModalOpen, submitting]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTickets(currentPage);
    setIsRefreshing(false);
  };

  const openTicketModal = (initialSubject?: string) => {
    setSubmitError("");
    if (initialSubject !== undefined) {
      setSubject(initialSubject);
    }
    setIsTicketModalOpen(true);
  };

  const openTicketDetails = async (ticket: DetailedSupportTicket) => {
    setSelectedTicket(ticket);
    setLoadingTicketDetail(true);
    try {
      const fresh = await employeeSupportTicketService.getById(ticket.id);
      setSelectedTicket(fresh);
    } catch {
      // Keep list payload visible if detail request fails
    } finally {
      setLoadingTicketDetail(false);
    }
  };

  const copyToClipboard = async (value: string, field: CopyField) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => {
        setCopiedField((curr) => (curr === field ? null : curr));
      }, 2000);
    } catch {
      // Ignore clipboard API failure
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndices((prev) =>
      prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index],
    );
  };

  const allFaqsExpanded =
    filteredFaqs.length > 0 &&
    filteredFaqs.every((_, index) => openFaqIndices.includes(index));

  const handleViewAllFaqs = () => {
    if (searchQuery.trim() !== "") {
      setSearchQuery("");
      setOpenFaqIndices(FAQS.map((_, index) => index));
      return;
    }
    setOpenFaqIndices(
      allFaqsExpanded ? [0] : FAQS.map((_, index) => index),
    );
  };

  const handleTicketSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError("");

    const trimmedSubject = subject.trim();
    const trimmedDescription = description.trim();

    if (trimmedSubject.length < 5) {
      setSubmitError("Subject must contain at least 5 characters.");
      return;
    }

    if (trimmedSubject.length > 150) {
      setSubmitError("Subject cannot exceed 150 characters.");
      return;
    }

    if (trimmedDescription.length < 10) {
      setSubmitError("Description must contain at least 10 characters.");
      return;
    }

    if (trimmedDescription.length > 5000) {
      setSubmitError("Description cannot exceed 5,000 characters.");
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
      setIsTicketModalOpen(false);
      setPageSuccessNotice(
        `Support ticket "${trimmedSubject}" submitted successfully.`,
      );

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
    <div className="flex w-full flex-col gap-5 pb-10 text-sm">
      {/* Page Header (Single Primary CTA) */}
      <PageHeading
        title="Find quick answers, track requests, or reach our HR & IT support team."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              leftIcon={
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                />
              }
            >
              Refresh
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => openTicketModal()}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Raise a Ticket
            </Button>
          </>
        }
      />

      {/* Page Success Banner */}
      {pageSuccessNotice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-[2px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">{pageSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setPageSuccessNotice("")}
            aria-label="Dismiss success notice"
            className="rounded p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Compact Light-Tinted Search Hero (140-180px) */}
      <section className="flex min-h-[152px] flex-col justify-center rounded-[2px] border border-blue-200/70 bg-gradient-to-br from-blue-50 via-indigo-50/50 to-white px-5 py-5 dark:border-blue-900/50 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-900 sm:px-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 sm:text-xl">
                Hi {fullName}, how can we help you today?
              </h2>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                setOpenFaqIndices([0]);
                document
                  .getElementById("faq-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="flex w-full max-w-2xl items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-blue-500 dark:focus-within:ring-blue-500/30"
            >
              <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setOpenFaqIndices([0]);
                }}
                placeholder="Search FAQs, policies, or help topics..."
                aria-label="Search frequently asked questions"
                className="h-10 min-w-0 w-full flex-1 border-0 bg-transparent text-sm text-slate-900 shadow-none outline-none placeholder:text-slate-400 focus:outline-none focus:ring-0 focus-visible:outline-none! dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search query"
                  className="shrink-0 cursor-pointer rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none! dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Popular:
              </span>
              {QUICK_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => {
                    setSearchQuery(topic);
                    setOpenFaqIndices([0]);
                    document
                      .getElementById("faq-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                    searchQuery.toLowerCase() === topic.toLowerCase()
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:text-blue-400"
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden shrink-0 flex-col items-end gap-1 rounded-[2px] border border-blue-200/60 bg-white/80 px-4 py-3 text-right dark:border-blue-900/50 dark:bg-slate-800/70 lg:flex">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Support Hours
            </span>
            <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              {contact.workingHours}
            </span>
          </div>
        </div>
      </section>

      {/* 3 Quick Action Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() =>
            document
              .getElementById("faq-section")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          className="group flex cursor-pointer items-center justify-between gap-4 rounded-[2px] border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/30 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-slate-800/70"
        >
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <BookOpen className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                Browse FAQs
              </h3>
              <p className="mt-0.5 truncate text-[13px] text-slate-500 dark:text-slate-400">
                Quick answers to workplace questions
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
        </button>

        <button
          type="button"
          onClick={() => openTicketModal()}
          className="group flex cursor-pointer items-center justify-between gap-4 rounded-[2px] border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/30 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-slate-800/70"
        >
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <MessageSquarePlus className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                Raise a Ticket
              </h3>
              <p className="mt-0.5 truncate text-[13px] text-slate-500 dark:text-slate-400">
                Submit an IT, HR, or payroll request
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
        </button>

        <button
          type="button"
          onClick={() =>
            document
              .getElementById("contact-hr-section")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          className="group flex cursor-pointer items-center justify-between gap-4 rounded-[2px] border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/30 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-slate-800/70"
        >
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <UserRound className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                Contact HR &amp; IT
              </h3>
              <p className="mt-0.5 truncate text-[13px] text-slate-500 dark:text-slate-400">
                Email, helpline &amp; support hours
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
        </button>
      </div>

      {/* Main 2-Column Workspace: Tickets (8 cols) + Snapshot & Contact (4 cols) */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        {/* Left Column: My Support Tickets */}
        <section className="flex min-w-0 flex-col overflow-hidden rounded-[2px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                  <Ticket className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    My Support Tickets
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Click any ticket to view status updates and resolution notes
                  </p>
                </div>
              </div>

              <div
                role="tablist"
                aria-label="Filter tickets by status"
                className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
              >
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "active", label: "Active" },
                    { id: "resolved", label: "Resolved" },
                  ] as const
                ).map((tab) => {
                  const isActive = statusFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setStatusFilter(tab.id)}
                      className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition ${
                        isActive
                          ? "bg-white text-slate-900 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {statusFilter !== "all" && (
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-5 py-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  aria-label="Clear ticket status filter"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-800/60 dark:bg-blue-950/50 dark:text-blue-300"
                >
                  <span>
                    Filtered by:{" "}
                    {statusFilter === "active" ? "Active" : "Resolved"}
                  </span>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {ticketsLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-20 w-full rounded-[2px]" />
                ))}
              </div>
            ) : ticketsError ? (
              <div className="m-5 rounded-[2px] border border-rose-200 bg-rose-50 p-5 text-center dark:border-rose-900/50 dark:bg-rose-950/30">
                <p className="text-sm text-rose-700 dark:text-rose-300">
                  {ticketsError}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadTickets(currentPage)}
                  className="mt-3"
                >
                  Try again
                </Button>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Ticket className="h-5 w-5" />}
                  title={
                    tickets.length === 0
                      ? "No support tickets yet"
                      : `No ${statusFilter === "active" ? "active" : "resolved"} tickets`
                  }
                  description={
                    tickets.length === 0
                      ? "When you raise a request, you can track updates and responses here."
                      : "Switch back to All to view all of your support requests."
                  }
                  action={
                    tickets.length > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setStatusFilter("all")}
                      >
                        Show All Tickets
                      </Button>
                    ) : undefined
                  }
                  className="max-w-none"
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredTickets.map((ticket) => (
                  <li key={ticket.id}>
                    <button
                      type="button"
                      onClick={() => void openTicketDetails(ticket)}
                      className="group flex w-full cursor-pointer items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-mono font-medium">
                            #{ticket.id.slice(-8).toUpperCase()}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{ticket.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <span
                              aria-hidden="true"
                              className={`h-2 w-2 rounded-full ${getPriorityDotStyle(
                                ticket.priority,
                              )}`}
                            />
                            {ticket.priority}
                          </span>
                        </div>

                        <h3 className="mt-1 truncate text-sm font-semibold text-slate-900 transition group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
                          {ticket.subject}
                        </h3>

                        <p className="mt-0.5 truncate text-[13px] text-slate-500 dark:text-slate-400">
                          {ticket.description}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getStatusStyle(
                            ticket.status,
                          )}`}
                        >
                          {ticket.status}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(ticket.created_at)}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Pagination Footer */}
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3.5 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Showing {filteredTickets.length} of {totalTickets} ticket
                {totalTickets === 1 ? "" : "s"}
                {totalPages > 1 ? ` · Page ${currentPage} of ${totalPages}` : ""}
              </p>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={currentPage <= 1 || ticketsLoading}
                    onClick={() => void loadTickets(currentPage - 1)}
                    leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={currentPage >= totalPages || ticketsLoading}
                    onClick={() => void loadTickets(currentPage + 1)}
                    rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
        </section>

        {/* Right Column: Compact Ticket Strip + Unified Light Contact HR & IT Card */}
        <aside className="flex flex-col gap-4 lg:col-span-4">
          {/* Compact Ticket Snapshot Strip */}
          <section className="rounded-[2px] border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            {ticketsLoading ? (
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
                Loading ticket summary...
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <Ticket className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  Tickets
                </span>

                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("active")}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                      statusFilter === "active"
                        ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-800/60"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full bg-blue-500"
                      aria-hidden="true"
                    />
                    {activeTicketCount} Active
                  </button>

                  <span
                    className="text-slate-300 dark:text-slate-700"
                    aria-hidden="true"
                  >
                    ·
                  </span>

                  <button
                    type="button"
                    onClick={() => setStatusFilter("resolved")}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                      statusFilter === "resolved"
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full bg-emerald-500"
                      aria-hidden="true"
                    />
                    {resolvedTicketCount} Resolved
                  </button>

                  <span
                    className="text-slate-300 dark:text-slate-700"
                    aria-hidden="true"
                  >
                    ·
                  </span>

                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                      statusFilter === "all"
                        ? "bg-slate-100 text-slate-900 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    {totalTickets} Total
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Merged Contact HR & IT Card (Light theme, config-driven) */}
          <section
            id="contact-hr-section"
            className="flex flex-1 scroll-mt-6 flex-col rounded-[2px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3 border-b border-slate-200 pb-3.5 dark:border-slate-800">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <UserRound className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Contact HR &amp; IT
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Direct support channels &amp; helpline
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {/* Email */}
              <div className="flex items-center justify-between gap-2 rounded-[2px] border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                <a
                  href={`mailto:${contact.email}`}
                  className="flex min-w-0 items-center gap-3"
                >
                  <Mail className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Email
                    </p>
                    <p className="truncate text-[13px] font-medium text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400">
                      {contact.email}
                    </p>
                  </div>
                </a>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(contact.email, "email")}
                  aria-label="Copy support email"
                  title="Copy email"
                  className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                >
                  {copiedField === "email" ? (
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Helpline */}
              <div className="flex items-center justify-between gap-2 rounded-[2px] border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                <a
                  href={telHref}
                  className="flex min-w-0 items-center gap-3"
                >
                  <Phone className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Helpline
                    </p>
                    <p className="truncate text-[13px] font-medium text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400">
                      {contact.phone}
                    </p>
                  </div>
                </a>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(contact.phone, "phone")}
                  aria-label="Copy helpline phone"
                  title="Copy helpline"
                  className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                >
                  {copiedField === "phone" ? (
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Working Hours */}
              <div className="flex items-center justify-between gap-2 rounded-[2px] border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="flex min-w-0 items-center gap-3">
                  <CalendarCheck2 className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Working Hours
                    </p>
                    <p className="truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
                      {contact.workingHours}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void copyToClipboard(contact.workingHours, "hours")
                  }
                  aria-label="Copy working hours"
                  title="Copy working hours"
                  className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                >
                  {copiedField === "hours" ? (
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="mt-auto pt-4">
              <a
                href={telHref}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <Phone className="h-4 w-4" />
                Call Support
              </a>
            </div>
          </section>
        </aside>
      </div>

      {/* Full-Width Responsive Frequently Asked Questions */}
      <section
        id="faq-section"
        className="scroll-mt-6 overflow-hidden rounded-[2px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Frequently Asked Questions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quick guides and self-service shortcuts for everyday tasks
            </p>
          </div>

          {searchQuery.trim() !== "" && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Clear search
            </button>
          )}
        </div>

        <div className="p-5">
          {searchQuery.trim() !== "" && (
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear FAQ search filter"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-800/60 dark:bg-blue-950/50 dark:text-blue-300"
              >
                <span>Filtered by: {searchQuery.trim()}</span>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {filteredFaqs.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                No FAQs found for &lsquo;{searchQuery.trim()}&rsquo;
              </p>
              <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
                Try another keyword or submit a support ticket directly.
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                >
                  Clear search
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => openTicketModal(searchQuery.trim())}
                >
                  Raise a Ticket
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredFaqs.map((faq, index) => {
                const isOpen = openFaqIndices.includes(index);

                return (
                  <div
                    key={faq.question}
                    className={`rounded-[2px] border transition ${
                      isOpen
                        ? "border-blue-200 bg-blue-50/30 dark:border-blue-900/60 dark:bg-blue-950/20"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                    }`}
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => toggleFaq(index)}
                      className="flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-4 px-4 py-3.5 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {faq.topic}
                        </span>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {faq.question}
                        </span>
                      </div>

                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                          isOpen ? "rotate-180 text-blue-600 dark:text-blue-400" : ""
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-200/70 px-4 pb-4 pt-3 text-[13px] leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300">
                        <p>{faq.answer}</p>
                        {faq.linkTo && faq.linkLabel && (
                          <Link
                            to={faq.linkTo}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {faq.linkLabel}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {filteredFaqs.length} of {FAQS.length} topics shown
          </span>
          <button
            type="button"
            onClick={handleViewAllFaqs}
            className="cursor-pointer text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            {searchQuery.trim() !== ""
              ? "View all FAQs"
              : allFaqsExpanded
                ? "Collapse FAQs"
                : "View all FAQs"}
          </button>
        </div>
      </section>

      {/* Raise a Ticket Modal */}
      {isTicketModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              setIsTicketModalOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="raise-ticket-modal-title"
            className="my-auto w-full max-w-xl overflow-hidden rounded-[2px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-white px-6 py-4 dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-900">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <MessageSquarePlus className="h-5 w-5" />
                </span>
                <div>
                  <h2
                    id="raise-ticket-modal-title"
                    className="text-base font-semibold text-slate-900 dark:text-slate-100"
                  >
                    Raise a Support Ticket
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Choose a quick template or describe your issue below.
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close ticket modal"
                disabled={submitting}
                onClick={() => setIsTicketModalOpen(false)}
                className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleTicketSubmit} className="space-y-4 px-6 py-5">
              {/* Quick Templates */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Quick templates</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TICKET_PRESETS.map((preset) => {
                    const isSelected =
                      subject === preset.subject &&
                      category === preset.category &&
                      priority === preset.priority;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setSubject(preset.subject);
                          setCategory(preset.category);
                          setPriority(preset.priority);
                          setSubmitError("");
                        }}
                        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:text-blue-400"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="ticket-subject"
                    className="text-[13px] font-medium text-slate-700 dark:text-slate-300"
                  >
                    Subject <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {subject.length}/150
                  </span>
                </div>
                <input
                  id="ticket-subject"
                  type="text"
                  autoFocus
                  required
                  minLength={5}
                  maxLength={150}
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Briefly summarize your request (min 5 characters)"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-blue-900/40"
                />
              </div>

              {/* Category Chips */}
              <div>
                <span className="mb-1.5 block text-[13px] font-medium text-slate-700 dark:text-slate-300">
                  Category <span className="text-rose-500">*</span>
                </span>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {TICKET_CATEGORIES.map((item) => {
                    const isSelected = category === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setCategory(item.value)}
                        className={`cursor-pointer rounded-[2px] border px-2.5 py-2 text-center text-xs font-medium transition ${
                          isSelected
                            ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority Segmented Selector */}
              <div>
                <span className="mb-1.5 block text-[13px] font-medium text-slate-700 dark:text-slate-300">
                  Priority <span className="text-rose-500">*</span>
                </span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TICKET_PRIORITIES.map((item) => {
                    const isSelected = priority === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setPriority(item.value)}
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-[2px] border px-3 py-2 text-xs font-medium transition ${
                          isSelected
                            ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`h-2 w-2 rounded-full ${getPriorityDotStyle(
                            item.value,
                          )}`}
                        />
                        {item.value}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {TICKET_PRIORITIES.find((item) => item.value === priority)?.hint}
                </p>
              </div>

              {/* Description */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="ticket-description"
                    className="text-[13px] font-medium text-slate-700 dark:text-slate-300"
                  >
                    Description <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={
                        description.trim().length >= 10
                          ? "font-medium text-emerald-600 dark:text-emerald-400"
                          : "text-slate-500 dark:text-slate-400"
                      }
                    >
                      {description.trim().length >= 10
                        ? "Ready"
                        : `${Math.max(0, 10 - description.trim().length)} more chars needed`}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {description.length}/5000
                    </span>
                  </div>
                </div>
                <textarea
                  id="ticket-description"
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Share steps to reproduce, relevant dates, or error messages..."
                  className="w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-blue-900/40"
                />
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-[2px] border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Footer */}
              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Clock3 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Tracked live under My Support Tickets
                </span>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={submitting}
                    onClick={() => setIsTicketModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={submitting}
                    leftIcon={
                      !submitting ? <Send className="h-3.5 w-3.5" /> : undefined
                    }
                  >
                    Submit Ticket
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedTicket(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-details-modal-title"
            className="my-auto w-full max-w-lg overflow-hidden rounded-[2px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                    #{selectedTicket.id.slice(-8).toUpperCase()}
                  </span>
                  <span className="text-slate-400" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {selectedTicket.category}
                  </span>
                  <span className="text-slate-400" aria-hidden="true">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 rounded-full ${getPriorityDotStyle(
                        selectedTicket.priority,
                      )}`}
                    />
                    {selectedTicket.priority}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getStatusStyle(
                      selectedTicket.status,
                    )}`}
                  >
                    {selectedTicket.status}
                  </span>
                </div>
                <h2
                  id="ticket-details-modal-title"
                  className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100"
                >
                  {selectedTicket.subject}
                </h2>
              </div>

              <button
                type="button"
                aria-label="Close ticket details"
                onClick={() => setSelectedTicket(null)}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-2 gap-4 rounded-[2px] border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/50">
                <div>
                  <p className="font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Created
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                    {formatDate(selectedTicket.created_at)}
                  </p>
                </div>
                <div>
                  <p className="font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Last Updated
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                    {loadingTicketDetail
                      ? "Refreshing..."
                      : formatDate(selectedTicket.updated_at)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Description
                </p>
                <div className="mt-1.5 max-h-[36vh] overflow-y-auto whitespace-pre-wrap break-words rounded-[2px] border border-slate-200 bg-white p-3.5 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200">
                  {selectedTicket.description}
                </div>
              </div>

              {selectedTicket.resolution_note && (
                <div className="rounded-[2px] border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Support Resolution Note
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] text-emerald-900 dark:text-emerald-200">
                    {selectedTicket.resolution_note}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setSelectedTicket(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmployeeHelpSupport;
