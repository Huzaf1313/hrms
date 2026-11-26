import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
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
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { PageHeading } from "../../components/ui/PageHeading";
import { EmptyState } from "../../components/ui/EmptyState";
import { TableRowSkeleton } from "../../components/ui/Skeleton";
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
      return "bg-[#E8EEFB] text-[#2F5FD0]";
    case "In Progress":
      return "bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]";
    case "Waiting for Employee":
      return "bg-[#F2EDFB] text-[#6D4AB5]";
    case "Resolved":
      return "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]";
    default:
      return "bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]";
  }
}

function getStatusDotColor(status: SupportTicketStatus) {
  switch (status) {
    case "Open":
      return "bg-[#2F5FD0]";
    case "In Progress":
      return "bg-[#92400E]";
    case "Waiting for Employee":
      return "bg-[#6D4AB5]";
    case "Resolved":
      return "bg-[#03543F]";
    default:
      return "bg-[#7B8794]";
  }
}

function getPriorityStyle(priority: SupportTicketPriority) {
  switch (priority) {
    case "Urgent":
      return "bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4]";
    case "High":
      return "bg-[#FFF1EC] text-[#C2410C]";
    case "Medium":
      return "bg-[#E8EEFB] text-[#2F5FD0]";
    default:
      return "bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]";
  }
}

function getPriorityDotColor(priority: SupportTicketPriority) {
  switch (priority) {
    case "Urgent":
      return "bg-[#9B1C1C]";
    case "High":
      return "bg-[#C2410C]";
    case "Medium":
      return "bg-[#2F5FD0]";
    default:
      return "bg-[#6B7280]";
  }
}

/** Small icon tile used by cards, matching the Leave theme. */
function Tile({
  icon: Icon,
  tone,
}: {
  icon: typeof Ticket;
  tone: string;
}) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${tone}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
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
    <div className="flex flex-col gap-5 w-full pb-10">
      {/* Page header */}
      <PageHeading
        title="Every request raised by your team, with the queues that need attention first."
        actions={
          <Button
            variant="outline"
            onClick={() => loadTickets(currentPage)}
            disabled={isLoading}
            leftIcon={
              <RefreshCw
                className={`h-4 w-4 shrink-0 ${isLoading ? "animate-spin" : ""}`}
              />
            }
            className="whitespace-nowrap shadow-none"
          >
            Refresh
          </Button>
        }
      />

      {/* Ticket Overview KPI Strip */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
            TICKET OVERVIEW
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 h-[108px] shadow-kpi flex flex-col justify-between min-w-0 transition-all duration-150 hover:border-[#CBD5E1] hover:shadow-sm">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs font-medium text-[#4B5563] truncate">
                Total tickets
              </span>
              <Tile icon={Layers} tone="bg-[#E8EEFB] text-[#2F5FD0]" />
            </div>
            <div>
              <span className="text-[24px] font-semibold text-[#111827] tabular-nums tracking-tight leading-none block">
                {analytics?.total ?? 0}
              </span>
              <div className="mt-1 flex items-center justify-between gap-2 min-w-0">
                <span className="text-[11px] text-[#6B7280] leading-none truncate" />
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#4B5563] font-medium border border-[#E5E7EB] leading-none shrink-0">
                  All time
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 h-[108px] shadow-kpi flex flex-col justify-between min-w-0 transition-all duration-150 hover:border-[#CBD5E1] hover:shadow-sm">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs font-medium text-[#4B5563] truncate">
                Awaiting reply
              </span>
              <Tile icon={Inbox} tone="bg-[#FEF3C7] text-[#92400E]" />
            </div>
            <div>
              <span className="text-[24px] font-semibold text-[#111827] tabular-nums tracking-tight leading-none block">
                {analytics?.unhandled_count ?? 0}
              </span>
              <div className="mt-1 flex items-center justify-between gap-2 min-w-0">
                <span className="text-[11px] text-[#6B7280] leading-none truncate" />
                {analytics && analytics.urgent_open_count > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4] font-medium leading-none shrink-0 tabular-nums">
                    {analytics.urgent_open_count} high priority
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 h-[108px] shadow-kpi flex flex-col justify-between min-w-0 transition-all duration-150 hover:border-[#CBD5E1] hover:shadow-sm">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs font-medium text-[#4B5563] truncate">
                Avg resolution
              </span>
              <Tile icon={Timer} tone="bg-[#DEF7EC] text-[#03543F]" />
            </div>
            <div>
              <span className="text-[24px] font-semibold text-[#111827] tabular-nums tracking-tight leading-none block">
                {formatDuration(analytics?.avg_resolution_hours ?? null)}
              </span>
              <div className="mt-1 flex items-center justify-between gap-2 min-w-0">
                <span className="text-[11px] text-[#6B7280] truncate block leading-none tabular-nums">
                  across {analytics?.resolved_sample_size ?? 0} handled
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 h-[108px] shadow-kpi flex flex-col justify-between min-w-0 transition-all duration-150 hover:border-[#CBD5E1] hover:shadow-sm">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs font-medium text-[#4B5563] truncate">
                Resolution rate
              </span>
              <Tile icon={Gauge} tone="bg-[#F3E8FF] text-[#7E22CE]" />
            </div>
            <div>
              <span className="text-[24px] font-semibold text-[#111827] tabular-nums tracking-tight leading-none block">
                {resolutionPercent}%
              </span>
              <div className="mt-1 flex items-center justify-between gap-2 min-w-0">
                <span className="text-[11px] text-[#6B7280] truncate block leading-none tabular-nums">
                  {analytics?.resolved_count ?? 0} of {analytics?.total ?? 0} closed
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown + aging */}
      <section className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Status distribution + By priority */}
        <div className="flex h-full flex-col rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3">
              <Tile icon={TrendingUp} tone="bg-[#E8EEFB] text-[#2F5FD0]" />
              <div>
                <h3 className="text-[13px] font-semibold text-[#111827]">
                  By status
                </h3>
                <p className="text-xs text-[#4B5563]">Click a status or priority to filter.</p>
              </div>
            </div>
          </div>

          <div className="flex-1 p-5 flex flex-col justify-between">
            <div>
            {statusSegments.length === 0 ? (
              <p className="text-[12px] text-[#6B7280]">No tickets yet.</p>
            ) : (
              <>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-[#E5E7EB]">
                  {statusSegments.map((segment) => (
                    <div
                      key={segment.status}
                      title={`${segment.status}: ${segment.count}`}
                      className={
                        segment.status === "Open"
                          ? "bg-[#2F5FD0]"
                          : segment.status === "In Progress"
                            ? "bg-[#92400E]"
                            : segment.status === "Waiting for Employee"
                              ? "bg-[#6D4AB5]"
                              : segment.status === "Resolved"
                                ? "bg-[#03543F]"
                                : "bg-[#7B8794]"
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

                <ul className="mt-4 space-y-1.5">
                  {statusSegments.map((segment) => {
                    const isSelected = statusFilter === segment.status;
                    return (
                      <li key={segment.status}>
                        <button
                          type="button"
                          onClick={() =>
                            changeFilter(
                              setStatusFilter,
                              isSelected ? "" : segment.status,
                            )
                          }
                          className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-[12px] transition cursor-pointer ${
                            isSelected
                              ? "bg-[#EFF6FF] ring-1 ring-[#2F5FD0]/30"
                              : "hover:bg-[#F8FAFC]"
                          }`}
                        >
                          <span className="inline-flex items-center gap-2 text-[#4B5563]">
                            <span
                              className={`inline-flex items-center gap-1.5 h-[22px] rounded-full px-2.5 py-0.5 font-medium ${getStatusStyle(
                                segment.status,
                              )}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full shrink-0 ${getStatusDotColor(segment.status)}`}
                              />
                              <span>{segment.status}</span>
                            </span>
                          </span>
                          <span className="font-semibold text-[#111827] tabular-nums">
                            {segment.count}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            </div>

            <div className="mt-4 border-t border-[#E5E7EB] pt-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                By priority
              </p>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TICKET_PRIORITIES.map((priority) => {
                  const total = analytics?.counts_by_priority[priority] ?? 0;
                  const isSelected = priorityFilter === priority;

                  return (
                    <li key={priority}>
                      <button
                        type="button"
                        onClick={() =>
                          changeFilter(
                            setPriorityFilter,
                            isSelected ? "" : priority,
                          )
                        }
                        className={`w-full flex items-center justify-between rounded-lg border px-2.5 py-2 text-[12px] transition cursor-pointer ${
                          isSelected
                            ? "border-[#2F5FD0] bg-[#EFF6FF] ring-1 ring-[#2F5FD0]/20"
                            : "border-[#E5E7EB] bg-white hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        <span
                          className={`inline-flex items-center gap-1.5 h-[22px] rounded-full px-2.5 py-0.5 font-medium ${getPriorityStyle(priority)}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${getPriorityDotColor(priority)}`}
                          />
                          <span>{priority}</span>
                        </span>
                        <span className="font-semibold text-[#111827] tabular-nums">
                          {total}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>

        {/* Category */}
        <div className="flex h-full flex-col rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#E5E7EB]">
            <Tile icon={Headphones} tone="bg-[#F3E8FF] text-[#7E22CE]" />
            <div>
              <h3 className="text-[13px] font-semibold text-[#111827]">
                By category
              </h3>
              <p className="text-xs text-[#4B5563]">Click a category to filter.</p>
            </div>
          </div>

          <div className="flex-1 p-5">
            <ul className="space-y-2.5">
              {TICKET_CATEGORIES.map((category) => {
                const total = analytics?.counts_by_category[category] ?? 0;
                const open = analytics?.open_by_category[category] ?? 0;
                const isSelected = categoryFilter === category;

                return (
                  <li key={category}>
                    <button
                      type="button"
                      onClick={() =>
                        changeFilter(
                          setCategoryFilter,
                          isSelected ? "" : category,
                        )
                      }
                      className={`w-full text-left rounded-lg px-2.5 py-2 transition cursor-pointer ${
                        isSelected
                          ? "bg-[#EFF6FF] ring-1 ring-[#2F5FD0]/30"
                          : "hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-medium text-[#111827]">
                          {category}
                        </span>
                        <span className="text-[#4B5563] tabular-nums">
                          <span className="font-semibold text-[#111827]">
                            {open}
                          </span>{" "}
                          open / {total}
                        </span>
                      </div>

                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
                        <div
                          className="h-full rounded-full bg-[#2F5FD0] transition-all duration-300"
                          style={{
                            width: `${(total / categoryMax) * 100}%`,
                          }}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Aging */}
        <div className="flex h-full flex-col rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)] md:col-span-2 xl:col-span-1">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#E5E7EB]">
            <Tile icon={Clock3} tone="bg-[#FEF3C7] text-[#92400E]" />
            <div>
              <h3 className="text-[13px] font-semibold text-[#111827]">
                Aging
              </h3>
              <p className="text-xs text-[#4B5563]">
                How long replies are taking.
              </p>
            </div>
          </div>

          <div className="flex-1 p-5 flex flex-col justify-between gap-4">
            <dl className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-3.5 py-2.5">
                <dt className="text-[12px] font-medium text-[#4B5563]">
                  Oldest unanswered
                </dt>
                <dd className="text-[13px] font-semibold text-[#111827] tabular-nums">
                  {formatAge(analytics?.oldest_open_age_days ?? null)}
                </dd>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-3.5 py-2.5">
                <dt className="text-[12px] font-medium text-[#4B5563]">
                  Average age
                </dt>
                <dd className="text-[13px] font-semibold text-[#111827] tabular-nums">
                  {formatAge(analytics?.avg_open_age_days ?? null)}
                </dd>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-3.5 py-2.5">
                <dt className="text-[12px] font-medium text-[#4B5563]">
                  Older than {analytics?.stale_after_days ?? 3} days
                </dt>
                <dd className="text-[13px] font-semibold text-[#111827] tabular-nums">
                  {analytics?.stale_open_count ?? 0}
                </dd>
              </div>
            </dl>

            {(analytics?.stale_open_count ?? 0) > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-[12px] text-[#92400E]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="leading-5">
                  {analytics?.stale_open_count} ticket
                  {analytics?.stale_open_count === 1 ? " has" : "s have"} been
                  waiting longer than {analytics?.stale_after_days} days.
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Filter bar + Ticket queue */}
      <div className="flex flex-col gap-4">
        {/* Filters */}
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-col gap-2.5 min-[900px]:flex-row min-[900px]:items-center">
            <div className="relative w-full min-[900px]:flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]"
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={search}
                onChange={(event) => changeFilter(setSearch, event.target.value)}
                placeholder="Search subject, description or employee..."
                aria-label="Search subject, description or employee"
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-3 text-[12px] text-[#111827] placeholder:text-[#7B8794] transition hover:border-[#D1D5DB] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0] focus:outline-none"
              />
            </div>

            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 min-[900px]:flex min-[900px]:w-auto min-[900px]:items-center">
              <div className="relative w-full min-[900px]:w-[160px] min-[900px]:shrink-0">
                <select
                  value={statusFilter}
                  onChange={(event) => changeFilter(setStatusFilter, event.target.value)}
                  aria-label="Filter by status"
                  className="h-9 w-full appearance-none rounded-lg border border-[#E5E7EB] bg-white pl-3 pr-8 text-[12px] text-[#111827] transition hover:border-[#D1D5DB] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0] focus:outline-none cursor-pointer truncate"
                >
                  <option value="">All statuses</option>
                  {TICKET_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]"
                  strokeWidth={1.5}
                />
              </div>

              <div className="relative w-full min-[900px]:w-[160px] min-[900px]:shrink-0">
                <select
                  value={categoryFilter}
                  onChange={(event) => changeFilter(setCategoryFilter, event.target.value)}
                  aria-label="Filter by category"
                  className="h-9 w-full appearance-none rounded-lg border border-[#E5E7EB] bg-white pl-3 pr-8 text-[12px] text-[#111827] transition hover:border-[#D1D5DB] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0] focus:outline-none cursor-pointer truncate"
                >
                  <option value="">All categories</option>
                  {TICKET_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]"
                  strokeWidth={1.5}
                />
              </div>

              <div className="relative w-full min-[900px]:w-[160px] min-[900px]:shrink-0">
                <select
                  value={priorityFilter}
                  onChange={(event) => changeFilter(setPriorityFilter, event.target.value)}
                  aria-label="Filter by priority"
                  className="h-9 w-full appearance-none rounded-lg border border-[#E5E7EB] bg-white pl-3 pr-8 text-[12px] text-[#111827] transition hover:border-[#D1D5DB] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0] focus:outline-none cursor-pointer truncate"
                >
                  <option value="">All priorities</option>
                  {TICKET_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]"
                  strokeWidth={1.5}
                />
              </div>
            </div>

            {hasFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="h-9 px-3 text-[12px] shrink-0"
              >
                Clear
              </Button>
            )}
          </div>
        </section>

        {/* Ticket queue */}
        <section className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3">
              <Tile icon={Ticket} tone="bg-[#E8EEFB] text-[#2F5FD0]" />
              <div>
                <h3 className="text-[13px] font-semibold text-[#111827]">
                  Ticket queue
                </h3>
                <p className="text-xs text-[#4B5563]">
                  {hasFilters
                    ? "Filtered to matching tickets."
                    : "Every request raised by employees."}
                </p>
              </div>
            </div>

            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] tabular-nums shrink-0">
              {totalTickets} {totalTickets === 1 ? "ticket" : "tickets"}
            </span>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="min-w-[1140px] w-full table-fixed border-collapse text-left text-[12px]">
              <colgroup>
                <col />
                <col className="w-[155px]" />
                <col className="w-[120px]" />
                <col className="w-[165px]" />
                <col className="w-[205px]" />
                <col className="w-[165px]" />
                <col className="w-[125px]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#4B5563] font-semibold text-[11px] uppercase tracking-wider">
                <tr className="h-10">
                  <th className="px-6 py-0 bg-[#F9FAFB] align-middle font-semibold whitespace-nowrap">
                    TICKET
                  </th>
                  <th className="px-6 py-0 bg-[#F9FAFB] align-middle font-semibold whitespace-nowrap">
                    EMPLOYEE
                  </th>
                  <th className="px-6 py-0 bg-[#F9FAFB] align-middle font-semibold whitespace-nowrap">
                    CATEGORY
                  </th>
                  <th className="px-6 py-0 bg-[#F9FAFB] align-middle font-semibold whitespace-nowrap">
                    PRIORITY
                  </th>
                  <th className="px-6 py-0 bg-[#F9FAFB] align-middle font-semibold whitespace-nowrap">
                    STATUS
                  </th>
                  <th className="px-6 py-0 bg-[#F9FAFB] align-middle font-semibold whitespace-nowrap">
                    HANDLED BY
                  </th>
                  <th className="px-6 py-0 bg-[#F9FAFB] text-right align-middle font-semibold whitespace-nowrap">
                    CREATED
                  </th>
                </tr>
              </thead>
              <tbody
                className="divide-y divide-[#E5E7EB] bg-white text-[#111827]"
                aria-busy={isLoading}
              >
                {isLoading ? (
                  <TableRowSkeleton rows={3} columns={7} />
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8">
                      <div
                        role="alert"
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-[#F8B4B4] bg-[#FDE8E8] p-4 text-center sm:text-left"
                      >
                        <div className="flex items-center gap-2 text-[13px] text-[#9B1C1C]">
                          <AlertCircle className="h-4 w-4 shrink-0 text-[#9B1C1C]" />
                          <span>{error}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadTickets(currentPage)}
                          className="border-[#F8B4B4] text-[#9B1C1C] hover:bg-[#FDE8E8] shrink-0"
                        >
                          Retry
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <EmptyState
                        icon={<Ticket className="h-6 w-6 shrink-0 stroke-[1.5]" />}
                        title={
                          hasFilters
                            ? "No tickets match your filters"
                            : "No tickets found"
                        }
                        description={
                          hasFilters
                            ? "Try adjusting or clearing the filters."
                            : "When an employee raises a request, it appears here."
                        }
                        action={
                          hasFilters ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={clearFilters}
                            >
                              Clear filters
                            </Button>
                          ) : undefined
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => openTicket(ticket)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openTicket(ticket);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      className="min-h-[60px] h-[60px] hover:bg-[#F8FAFC] transition-colors cursor-pointer group focus:outline-none focus-visible:bg-[#F8FAFC] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2F5FD0]"
                    >
                      <td className="px-6 py-2 align-middle">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] font-medium tabular-nums text-[#2F5FD0] shrink-0">
                            #{ticket.id.slice(-8).toUpperCase()}
                          </span>
                          <span className="font-medium text-[12px] text-[#111827] truncate group-hover:underline leading-tight">
                            {ticket.subject}
                          </span>
                        </div>
                        <p
                          title={ticket.description}
                          className="mt-0.5 truncate text-[11px] text-[#6B7280] leading-tight"
                        >
                          {ticket.description}
                        </p>
                      </td>

                      <td className="px-6 py-2 align-middle">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar
                            name={ticket.employee_id}
                            className="!w-8 !h-8 text-[11px] shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="font-medium text-[#111827] block truncate text-[12px] leading-tight tabular-nums">
                              {ticket.employee_id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-2 align-middle">
                        <span className="inline-flex items-center rounded-full bg-[#F3F4F6] border border-[#E5E7EB] px-2 py-0.5 text-[11px] font-medium text-[#4B5563] whitespace-nowrap">
                          {ticket.category}
                        </span>
                      </td>

                      <td className="px-6 py-2 align-middle">
                        <span
                          className={`inline-flex items-center gap-1.5 h-[22px] rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-normal whitespace-nowrap ${getPriorityStyle(ticket.priority)}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${getPriorityDotColor(ticket.priority)}`}
                          />
                          <span>{ticket.priority} priority</span>
                        </span>
                      </td>

                      <td className="px-6 py-2 align-middle">
                        <span
                          className={`inline-flex items-center gap-1.5 h-[22px] rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-normal whitespace-nowrap ${getStatusStyle(ticket.status)}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${getStatusDotColor(ticket.status)}`}
                          />
                          <span>{ticket.status}</span>
                        </span>
                      </td>

                      <td className="px-6 py-2 align-middle">
                        {ticket.handled_by ? (
                          <span
                            title={ticket.handled_by}
                            className="text-[12px] text-[#4B5563] truncate block"
                          >
                            {ticket.handled_by}
                          </span>
                        ) : (
                          <span className="text-[12px] text-[#6B7280]">—</span>
                        )}
                      </td>

                      <td className="px-6 py-2 align-middle text-right">
                        <span className="text-[12px] font-medium text-[#111827] tabular-nums whitespace-nowrap">
                          {formatDate(ticket.created_at)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] bg-white px-6 py-4">
              <p className="text-[13px] text-[#6B7280] tabular-nums">
                Page <span className="font-medium text-[#111827]">{currentPage}</span>{" "}
                of <span className="font-medium text-[#111827]">{totalPages}</span>
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => setCurrentPage((page) => page - 1)}
                  leftIcon={<ChevronLeft className="h-4 w-4" />}
                >
                  Previous
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages || isLoading}
                  onClick={() => setCurrentPage((page) => page + 1)}
                  rightIcon={<ChevronRight className="h-4 w-4" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Reply drawer */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] px-6 py-5">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyle(selectedTicket.status)}`}
                  >
                    <Clock3 className="h-3 w-3" />
                    {selectedTicket.status}
                  </span>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${getPriorityStyle(selectedTicket.priority)}`}
                  >
                    {selectedTicket.priority}
                  </span>

                  <span className="rounded-full bg-[#F3F4F6] border border-[#E5E7EB] px-2.5 py-1 text-xs font-medium text-[#4B5563]">
                    {selectedTicket.category}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-[#111827]">
                  {selectedTicket.subject}
                </h2>

                <p className="mt-1 text-xs text-[#6B7280]">
                  #{selectedTicket.id.slice(-8).toUpperCase()} &middot; raised by{" "}
                  {selectedTicket.employee_id} on{" "}
                  {formatDate(selectedTicket.created_at)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeTicket}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[#E5E7EB] text-[#6B7280] transition hover:border-[#F8B4B4] hover:bg-[#FDE8E8] hover:text-[#9B1C1C]"
                aria-label="Close ticket"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                  Employee&apos;s message
                </p>

                <p className="mt-2 whitespace-pre-wrap rounded bg-[#F9FAFB] px-4 py-3 text-sm leading-6 text-[#4B5563]">
                  {selectedTicket.description}
                </p>
              </div>

              {selectedTicket.resolution_note && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                    Previous reply
                    {selectedTicket.handled_by
                      ? ` by ${selectedTicket.handled_by}`
                      : ""}
                  </p>

                  <p className="mt-2 whitespace-pre-wrap rounded bg-[#DEF7EC] px-4 py-3 text-sm leading-6 text-[#4B5563]">
                    {selectedTicket.resolution_note}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmitReply} className="space-y-4">
                <div>
                  <label
                    htmlFor="ticket-status"
                    className="mb-1.5 block text-sm font-medium text-[#4B5563]"
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
                    className="w-full rounded border border-[#E5E7EB] bg-white px-3.5 py-3 text-sm text-[#111827] outline-none focus:border-[#2F5FD0] focus:ring-2 focus:ring-[#2F5FD0]/20"
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
                    className="mb-1.5 block text-sm font-medium text-[#4B5563]"
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
                    className="w-full resize-y rounded border border-[#E5E7EB] px-3.5 py-3 text-sm leading-6 text-[#111827] outline-none transition placeholder:text-[#7B8794] focus:border-[#2F5FD0] focus:ring-2 focus:ring-[#2F5FD0]/20"
                  />

                  <div className="mt-1 flex justify-between text-xs text-[#6B7280]">
                    <span>Visible to the employee.</span>
                    <span>{replyNote.length}/2000</span>
                  </div>
                </div>

                {replyError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded border border-[#F8B4B4] bg-[#FDE8E8] p-3.5 text-sm text-[#9B1C1C]"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{replyError}</span>
                  </div>
                )}

                <div className="flex flex-col-reverse gap-3 border-t border-[#E5E7EB] pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="inline-flex items-center gap-1.5 text-xs text-[#6B7280]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#03543F]" />
                    Saving notifies the employee automatically.
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={closeTicket}
                      className="rounded px-4 py-2.5 text-sm font-semibold text-[#4B5563] transition hover:bg-[#F3F4F6]"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex items-center justify-center gap-2 rounded bg-[#2F5FD0] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#264FB0] disabled:cursor-not-allowed disabled:opacity-60"
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
    </div>
  );
}

export default AdminSupportTickets;