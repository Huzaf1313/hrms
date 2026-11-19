import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gauge,
  Headphones,
  Inbox,
  Layers,
  LoaderCircle,
  RefreshCw,
  Search,
  Timer,
  Ticket,
  TrendingUp,
  X,
} from "lucide-react";

import { ApiError } from "../../services/api";
import { adminSupportTicketService } from "./adminSupportTicketService";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type SupportTicket,
  type SupportTicketAnalytics,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from "./types";

const PAGE_SIZE = 10;

/** Same status treatment the employee ticket list uses, so both sides of a
 *  ticket read identically. */
function getStatusStyle(status: SupportTicketStatus) {
  switch (status) {
    case "Open":
      return "bg-blue-50 text-blue-700 ring-blue-600/20";
    case "In Progress":
      return "bg-amber-50 text-amber-700 ring-amber-600/20";
    case "Waiting for Employee":
      return "bg-purple-50 text-purple-700 ring-purple-600/20";
    case "Resolved":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
    default:
      return "bg-gray-100 text-gray-600 ring-gray-500/20";
  }
}

function getPriorityStyle(priority: SupportTicketPriority) {
  switch (priority) {
    case "Urgent":
      return "bg-red-50 text-red-700";
    case "High":
      return "bg-orange-50 text-orange-700";
    case "Medium":
      return "bg-blue-50 text-blue-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

/** Small icon tile used by the KPI cards, matching the employee page. */
function Tile({
  icon: Icon,
  tone,
}: {
  icon: typeof Ticket;
  tone: string;
}) {
  return (
    <span
      className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

/** Hours -> a human span. Under a day reads in hours, above it in days. */
function formatDuration(hours: number | null): string {
  if (hours === null) return "--";

  if (hours < 1) {
    const minutes = Math.max(Math.round(hours * 60), 1);

    return `${minutes}m`;
  }

  if (hours < 24) return `${hours.toFixed(1)}h`;

  const days = hours / 24;

  return `${days.toFixed(days < 10 ? 1 : 0)}d`;
}

function formatAge(days: number | null): string {
  if (days === null) return "--";

  if (days < 1) return "<1d";

  return `${days.toFixed(days < 10 ? 1 : 0)}d`;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function AdminSupportTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [analytics, setAnalytics] = useState<SupportTicketAnalytics | null>(
    null,
  );

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalTickets, setTotalTickets] = useState(0);

  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null,
  );
  const [replyStatus, setReplyStatus] =
    useState<SupportTicketStatus>("In Progress");
  const [replyNote, setReplyNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const hasFilters =
    Boolean(search.trim()) ||
    Boolean(statusFilter) ||
    Boolean(categoryFilter) ||
    Boolean(priorityFilter);

  const loadTickets = useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const [pageData, summary] = await Promise.all([
        adminSupportTicketService.list({
          page,
          limit: PAGE_SIZE,
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          category: categoryFilter || undefined,
          priority: priorityFilter || undefined,
        }),
        adminSupportTicketService.summary(),
      ]);

      setTickets(pageData.tickets);
      setTotalPages(pageData.total_pages);
      setTotalTickets(pageData.total);
      setCurrentPage(pageData.page);
      setAnalytics(summary);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to load support tickets.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, categoryFilter, priorityFilter]);

  useEffect(() => {
    // Reading the ticket queue and its KPIs from the API whenever a filter or
    // page changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTickets(currentPage);
  }, [loadTickets, currentPage]);

  /** Biggest count in a breakdown, used to scale the bar widths. */
  const categoryMax = useMemo(
    () => Math.max(1, ...Object.values(analytics?.counts_by_category ?? {})),
    [analytics],
  );

  const statusSegments = useMemo(() => {
    const counts = analytics?.counts_by_status ?? {};

    return TICKET_STATUSES.map((status) => ({
      status,
      count: counts[status] ?? 0,
    })).filter((entry) => entry.count > 0);
  }, [analytics]);

  const resolutionPercent = Math.round(
    (analytics?.resolution_rate ?? 0) * 100,
  );

  function openTicket(ticket: SupportTicket) {
    setSelectedTicket(ticket);
    setReplyStatus(ticket.status);
    setReplyNote(ticket.resolution_note ?? "");
    setReplyError(null);
  }

  function closeTicket() {
    setSelectedTicket(null);
    setReplyError(null);
  }

  async function handleSubmitReply(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedTicket) return;

    try {
      setIsSaving(true);
      setReplyError(null);

      await adminSupportTicketService.respond(selectedTicket.id, {
        status: replyStatus,
        resolution_note: replyNote.trim() || null,
      });

      closeTicket();
      await loadTickets(currentPage);
    } catch (err) {
      setReplyError(
        err instanceof ApiError
          ? err.message
          : "Failed to update the ticket. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setCategoryFilter("");
    setPriorityFilter("");
    setCurrentPage(1);
  }

  /* Changing a filter must send the reader back to page 1, otherwise they land
     on a page that no longer exists for the new result set. Done in the handlers
     rather than an effect so the reset happens in the same update as the
     filter change. */
  function changeFilter(
    setter: (value: string) => void,
    value: string,
  ) {
    setter(value);
    setCurrentPage(1);
  }

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        {/* Page header */}
        <section className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Support Tickets
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Every request raised by your team, with the queues that need
              attention first.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadTickets(currentPage)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </section>

        {/* KPI row */}
        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <Tile icon={Layers} tone="bg-blue-50 text-[#2563eb]" />
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                All time
              </span>
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Total tickets
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {analytics?.total ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <Tile icon={Inbox} tone="bg-amber-50 text-amber-600" />
              {analytics && analytics.urgent_open_count > 0 && (
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
                  {analytics.urgent_open_count} high priority
                </span>
              )}
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Awaiting reply
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-600">
              {analytics?.unhandled_count ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <Tile icon={Timer} tone="bg-emerald-50 text-emerald-600" />
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Avg resolution
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {formatDuration(analytics?.avg_resolution_hours ?? null)}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              across {analytics?.resolved_sample_size ?? 0} handled
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <Tile icon={Gauge} tone="bg-purple-50 text-purple-600" />
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Resolution rate
            </p>
            <p className="mt-1 text-2xl font-bold text-purple-600">
              {resolutionPercent}%
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {analytics?.resolved_count ?? 0} of {analytics?.total ?? 0} closed
            </p>
          </div>
        </section>

        {/* Breakdown + aging */}
        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Status distribution */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Tile icon={TrendingUp} tone="bg-blue-50 text-[#2563eb]" />
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  By status
                </h2>
                <p className="text-xs text-gray-500">Where the queue sits.</p>
              </div>
            </div>

            {statusSegments.length === 0 ? (
              <p className="mt-5 text-sm text-gray-400">No tickets yet.</p>
            ) : (
              <>
                <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-gray-100">
                  {statusSegments.map((segment) => (
                    <div
                      key={segment.status}
                      title={`${segment.status}: ${segment.count}`}
                      className={
                        segment.status === "Open"
                          ? "bg-blue-500"
                          : segment.status === "In Progress"
                            ? "bg-amber-500"
                            : segment.status === "Waiting for Employee"
                              ? "bg-purple-500"
                              : segment.status === "Resolved"
                                ? "bg-emerald-500"
                                : "bg-gray-400"
                      }
                      style={{
                        width: `${
                          (segment.count /
                            Math.max(1, analytics?.total ?? 0)) *
                          100
                        }%`,
                      }}
                    />
                  ))}
                </div>

                <ul className="mt-4 space-y-2">
                  {statusSegments.map((segment) => (
                    <li
                      key={segment.status}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="inline-flex items-center gap-2 text-gray-600">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ring-1 ring-inset ${getStatusStyle(
                            segment.status,
                          )}`}
                        >
                          {segment.status}
                        </span>
                      </span>
                      <span className="font-semibold text-gray-900">
                        {segment.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Category + priority */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Tile icon={Headphones} tone="bg-indigo-50 text-indigo-600" />
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  By category
                </h2>
                <p className="text-xs text-gray-500">Which team is loaded.</p>
              </div>
            </div>

            <ul className="mt-5 space-y-3">
              {TICKET_CATEGORIES.map((category) => {
                const total = analytics?.counts_by_category[category] ?? 0;
                const open = analytics?.open_by_category[category] ?? 0;

                return (
                  <li key={category}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-700">
                        {category}
                      </span>
                      <span className="text-gray-500">
                        <span className="font-semibold text-gray-900">
                          {open}
                        </span>{" "}
                        open / {total}
                      </span>
                    </div>

                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-[#2563eb]"
                        style={{
                          width: `${(total / categoryMax) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 border-t border-gray-100 pt-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                By priority
              </p>

              <ul className="grid grid-cols-2 gap-2">
                {TICKET_PRIORITIES.map((priority) => {
                  const total = analytics?.counts_by_priority[priority] ?? 0;

                  return (
                    <li
                      key={priority}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-2 text-xs"
                    >
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${getPriorityStyle(priority)}`}
                      >
                        {priority}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {total}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Aging */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <Tile icon={Clock3} tone="bg-orange-50 text-orange-600" />
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Aging
                </h2>
                <p className="text-xs text-gray-500">
                  How long replies are taking.
                </p>
              </div>
            </div>

            <dl className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3.5 py-3">
                <dt className="text-xs font-medium text-gray-600">
                  Oldest unanswered
                </dt>
                <dd className="text-sm font-bold text-gray-900">
                  {formatAge(analytics?.oldest_open_age_days ?? null)}
                </dd>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3.5 py-3">
                <dt className="text-xs font-medium text-gray-600">
                  Average age
                </dt>
                <dd className="text-sm font-bold text-gray-900">
                  {formatAge(analytics?.avg_open_age_days ?? null)}
                </dd>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3.5 py-3">
                <dt className="text-xs font-medium text-gray-600">
                  Older than {analytics?.stale_after_days ?? 3} days
                </dt>
                <dd className="text-sm font-bold text-gray-900">
                  {analytics?.stale_open_count ?? 0}
                </dd>
              </div>
            </dl>

            {(analytics?.stale_open_count ?? 0) > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="leading-5">
                  {analytics?.stale_open_count} ticket
                  {analytics?.stale_open_count === 1 ? " has" : "s have"} been
                  waiting longer than {analytics?.stale_after_days} days.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Filters */}
        <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <input
                type="text"
                value={search}
onChange={(event) => changeFilter(setSearch, event.target.value)}
              placeholder="Search subject, description or employee..."
                className="h-11 w-full rounded-xl border border-gray-200 pl-10 pr-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => changeFilter(setStatusFilter, event.target.value)}
              className="h-11 rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-700 outline-none focus:border-blue-500"
            >
              <option value="">All statuses</option>
              {TICKET_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(event) => changeFilter(setCategoryFilter, event.target.value)}
              className="h-11 rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-700 outline-none focus:border-blue-500"
            >
              <option value="">All categories</option>
              {TICKET_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) => changeFilter(setPriorityFilter, event.target.value)}
              className="h-11 rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-700 outline-none focus:border-blue-500"
            >
              <option value="">All priorities</option>
              {TICKET_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-11 rounded-xl px-3.5 text-sm font-semibold text-gray-500 transition hover:bg-gray-100"
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {/* Ticket queue */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Tile icon={Ticket} tone="bg-indigo-50 text-indigo-600" />
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Ticket queue
                </h2>
                <p className="text-xs text-gray-500">
                  {hasFilters
                    ? "Filtered to matching tickets."
                    : "Every request raised by employees."}
                </p>
              </div>
            </div>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {totalTickets} {totalTickets === 1 ? "ticket" : "tickets"}
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
              <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" />
              Loading tickets...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-center">
              <p className="text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => loadTickets(currentPage)}
                className="mt-3 text-sm font-semibold text-blue-700 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-12 text-center">
              <Ticket className="mx-auto h-8 w-8 text-gray-300" />
              <h3 className="mt-3 text-sm font-semibold text-gray-700">
                No tickets found
              </h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                {hasFilters
                  ? "Try adjusting or clearing the filters."
                  : "When an employee raises a request, it appears here."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => openTicket(ticket)}
                  className="block w-full rounded-xl border border-gray-100 p-4 text-left transition hover:border-blue-100 hover:bg-gray-50/50"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-blue-700">
                          #{ticket.id.slice(-8).toUpperCase()}
                        </span>

                        <span className="text-xs text-gray-400">
                          {ticket.employee_id}
                        </span>

                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
                          {ticket.category}
                        </span>
                      </div>

                      <h3 className="mt-2 break-words text-sm font-semibold text-gray-900">
                        {ticket.subject}
                      </h3>

                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs leading-5 text-gray-500">
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

                        {ticket.handled_by && (
                          <span className="text-[11px] text-gray-400">
                            handled by {ticket.handled_by}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-xs text-gray-400 sm:text-right">
                      <p>Created</p>
                      <p className="mt-1 font-medium text-gray-600">
                        {formatDate(ticket.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}

              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <p className="text-xs text-gray-500">
                    Page {currentPage} of {totalPages}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentPage <= 1 || isLoading}
                      onClick={() => setCurrentPage((page) => page - 1)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>

                    <button
                      type="button"
                      disabled={currentPage >= totalPages || isLoading}
                      onClick={() => setCurrentPage((page) => page + 1)}
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
      </div>

      {/* Reply drawer */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${getStatusStyle(selectedTicket.status)}`}
                  >
                    <Clock3 className="h-3 w-3" />
                    {selectedTicket.status}
                  </span>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${getPriorityStyle(selectedTicket.priority)}`}
                  >
                    {selectedTicket.priority}
                  </span>

                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                    {selectedTicket.category}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-gray-900">
                  {selectedTicket.subject}
                </h2>

                <p className="mt-1 text-xs text-gray-400">
                  #{selectedTicket.id.slice(-8).toUpperCase()} &middot; raised by{" "}
                  {selectedTicket.employee_id} on{" "}
                  {formatDate(selectedTicket.created_at)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeTicket}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                aria-label="Close ticket"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Employee&apos;s message
                </p>

                <p className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700">
                  {selectedTicket.description}
                </p>
              </div>

              {selectedTicket.resolution_note && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Previous reply
                    {selectedTicket.handled_by
                      ? ` by ${selectedTicket.handled_by}`
                      : ""}
                  </p>

                  <p className="mt-2 whitespace-pre-wrap rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-gray-700">
                    {selectedTicket.resolution_note}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmitReply} className="space-y-4">
                <div>
                  <label
                    htmlFor="ticket-status"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Update status
                  </label>

                  <select
                    id="ticket-status"
                    value={replyStatus}
                    onChange={(event) =>
                      setReplyStatus(
                        event.target.value as SupportTicketStatus,
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {TICKET_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ticket-note"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Reply to employee
                  </label>

                  <textarea
                    id="ticket-note"
                    value={replyNote}
                    onChange={(event) => setReplyNote(event.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="Shown to the employee on their ticket, and sent as a notification."
                    className="w-full resize-y rounded-xl border border-gray-200 px-3.5 py-3 text-sm leading-6 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                  <div className="mt-1 flex justify-between text-xs text-gray-400">
                    <span>Visible to the employee.</span>
                    <span>{replyNote.length}/2000</span>
                  </div>
                </div>

                {replyError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm text-red-700"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{replyError}</span>
                  </div>
                )}

                <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Saving notifies the employee automatically.
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={closeTicket}
                      className="rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving && (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      )}
                      {isSaving ? "Saving..." : "Save & Notify Employee"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default AdminSupportTickets;