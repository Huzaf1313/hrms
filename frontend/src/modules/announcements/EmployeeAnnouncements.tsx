import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  Megaphone,
  Paperclip,
  Pin,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import {
  announcementService,
  type EmployeeAnnouncement,
} from "./announcementService";
import { ApiError } from "../../services/api";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeading } from "../../components/ui/PageHeading";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { Tabs } from "../../components/ui/Tabs";

const CATEGORIES = [
  "All",
  "Company News",
  "HR & Policy",
  "Events",
  "IT & System",
] as const;

const READ_STORAGE_KEY = "hrms_read_announcements";

const BACKEND_ORIGIN = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8000/api/v1"
).replace(/\/api\/v1\/?$/, "");

const priorityStyles: Record<string, string> = {
  Urgent:
    "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800/60",
  Important:
    "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/60",
  Normal:
    "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
};

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function resolveAttachmentUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const normalized = url.startsWith("/") ? url : `/${url}`;
  return `${BACKEND_ORIGIN}${normalized}`;
}

function loadReadIds(): string[] {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function saveReadIds(ids: string[]): void {
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

function EmployeeAnnouncements() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [nowTimestamp] = useState(() => Date.now());

  const [announcements, setAnnouncements] = useState<EmployeeAnnouncement[]>([]);
  const [summaryCatalog, setSummaryCatalog] = useState<EmployeeAnnouncement[]>([]);
  const [important, setImportant] = useState<EmployeeAnnouncement[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [readIds, setReadIds] = useState<string[]>(() => loadReadIds());
  const [activeAnnouncement, setActiveAnnouncement] =
    useState<EmployeeAnnouncement | null>(null);
  const [copiedNoticeId, setCopiedNoticeId] = useState<string | null>(null);

  const readSet = useMemo(() => new Set(readIds), [readIds]);

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveReadIds(next);
      return next;
    });
  }, []);

  const markAsUnread = useCallback((id: string) => {
    setReadIds((prev) => {
      if (!prev.includes(id)) return prev;
      const next = prev.filter((item) => item !== id);
      saveReadIds(next);
      return next;
    });
  }, []);

  const copyAnnouncementText = async (item: EmployeeAnnouncement) => {
    try {
      await navigator.clipboard.writeText(`${item.title}\n\n${item.description}`);
      setCopiedNoticeId(item.id);
      window.setTimeout(() => {
        setCopiedNoticeId((curr) => (curr === item.id ? null : curr));
      }, 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const loadAnnouncements = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await announcementService.list({
        page: currentPage,
        page_size: 10,
        category: selectedCategory === "All" ? undefined : selectedCategory,
        search: searchQuery.trim() || undefined,
        pinned: pinnedOnly ? true : undefined,
      });

      setAnnouncements(result.announcements);
      setTotal(result.total);
      setTotalPages(result.total_pages);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not load announcements.",
      );
      setAnnouncements([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, currentPage, searchQuery, pinnedOnly]);

  const loadSidebarAndSummary = useCallback(async () => {
    try {
      const [pinnedRes, catalogRes] = await Promise.all([
        announcementService.list({ pinned: true, page_size: 6 }),
        announcementService.list({ page: 1, page_size: 100 }),
      ]);
      setImportant(pinnedRes.announcements);
      setSummaryCatalog(catalogRes.announcements);
    } catch {
      // Keep UI functional even if summary fails independently
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAnnouncements();
    }, 200);

    return () => window.clearTimeout(timer);
  }, [loadAnnouncements]);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      announcementService.list({ pinned: true, page_size: 6 }),
      announcementService.list({ page: 1, page_size: 100 }),
    ])
      .then(([pinnedRes, catalogRes]) => {
        if (!isMounted) return;
        setImportant(pinnedRes.announcements);
        setSummaryCatalog(catalogRes.announcements);
      })
      .catch(() => {
        // Keep UI functional even if summary fails independently
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeAnnouncement) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveAnnouncement(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeAnnouncement]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadAnnouncements(), loadSidebarAndSummary()]);
    setIsRefreshing(false);
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: summaryCatalog.length,
      "Company News": 0,
      "HR & Policy": 0,
      Events: 0,
      "IT & System": 0,
    };
    for (const item of summaryCatalog) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  }, [summaryCatalog]);

  const unreadCount = useMemo(
    () => summaryCatalog.filter((item) => !readSet.has(item.id)).length,
    [summaryCatalog, readSet],
  );

  const urgentCount = useMemo(
    () => summaryCatalog.filter((item) => item.priority === "Urgent").length,
    [summaryCatalog],
  );

  const visibleAnnouncements = useMemo(() => {
    const days = filterDate === "all" ? 0 : Number(filterDate);
    const cutoff =
      !Number.isNaN(days) && days > 0
        ? nowTimestamp - days * 24 * 60 * 60 * 1000
        : null;

    return announcements.filter((item) => {
      if (cutoff !== null) {
        const parsed = Date.parse(item.publish_date || item.created_at || "");
        if (!Number.isNaN(parsed) && parsed < cutoff) return false;
      }
      if (priorityFilter !== "all" && item.priority !== priorityFilter) {
        return false;
      }
      if (unreadOnly && readSet.has(item.id)) {
        return false;
      }
      return true;
    });
  }, [
    announcements,
    filterDate,
    nowTimestamp,
    priorityFilter,
    unreadOnly,
    readSet,
  ]);

  const hasClientSideFiltering =
    filterDate !== "all" || priorityFilter !== "all" || unreadOnly;

  const hasActiveFilters =
    selectedCategory !== "All" ||
    searchQuery.trim() !== "" ||
    pinnedOnly ||
    hasClientSideFiltering;

  const from =
    visibleAnnouncements.length === 0 ? 0 : (currentPage - 1) * 10 + 1;
  const to = (currentPage - 1) * 10 + visibleAnnouncements.length;

  const resetFilters = () => {
    setFilterDate("all");
    setPriorityFilter("all");
    setUnreadOnly(false);
    setPinnedOnly(false);
    setSelectedCategory("All");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const openAnnouncement = (item: EmployeeAnnouncement) => {
    setActiveAnnouncement(item);
    markAsRead(item.id);
  };

  const markAllRead = () => {
    const allIds = Array.from(
      new Set([
        ...readIds,
        ...summaryCatalog.map((item) => item.id),
        ...announcements.map((item) => item.id),
        ...important.map((item) => item.id),
      ]),
    );
    setReadIds(allIds);
    saveReadIds(allIds);
  };

  const activeModalIndex = activeAnnouncement
    ? visibleAnnouncements.findIndex((item) => item.id === activeAnnouncement.id)
    : -1;

  return (
    <div className="flex w-full flex-col gap-5 pb-10">
      {/* Slim Page Header */}
      <PageHeading
        title="Stay updated with the latest company announcements and notices."
        actions={
          <>
            {unreadCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={markAllRead}
                leftIcon={<CheckCheck className="h-3.5 w-3.5 text-[#2563EB]" />}
              >
                Mark all read
              </Button>
            )}
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
          </>
        }
      />

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={resetFilters}
          className="flex min-h-[116px] cursor-pointer flex-col rounded-[2px] border-2 border-[#E5E7EB] bg-white p-5 text-left shadow-kpi shadow-kpi-hover transition hover:border-[#CBD5E1] dark:border-[#243247] dark:bg-[#111827]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-[#6B7280] dark:text-[#94A3B8]">
                Total Notices
              </p>
              <p className="mt-2 text-[26px] font-semibold leading-none text-[#111827] dark:text-[#F8FAFC]">
                {isLoading && summaryCatalog.length === 0
                  ? "—"
                  : Math.max(summaryCatalog.length, total)}
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB] dark:bg-blue-950/50 dark:text-blue-300">
              <Bell className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-auto pt-3 text-[12px] text-[#6B7280] dark:text-[#94A3B8]">
            {hasActiveFilters
              ? "Click to clear active filters"
              : "Active company announcements"}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setUnreadOnly((prev) => !prev);
            setCurrentPage(1);
          }}
          className={`flex min-h-[116px] cursor-pointer flex-col rounded-[2px] border-2 bg-white p-5 text-left shadow-kpi shadow-kpi-hover transition dark:bg-[#111827] ${
            unreadOnly
              ? "border-[#2563EB] ring-1 ring-[#2563EB]/20"
              : "border-[#E5E7EB] hover:border-[#CBD5E1] dark:border-[#243247]"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-[#6B7280] dark:text-[#94A3B8]">
                Unread Notices
              </p>
              <p className="mt-2 text-[26px] font-semibold leading-none text-[#111827] dark:text-[#F8FAFC]">
                {unreadCount}
              </p>
            </div>
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                unreadCount > 0
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
              }`}
            >
              <Sparkles className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-auto pt-3 text-[12px] text-[#6B7280] dark:text-[#94A3B8]">
            {unreadOnly
              ? "Showing unread only"
              : unreadCount > 0
                ? "Click to filter unread"
                : "You are all caught up"}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setPinnedOnly((prev) => !prev);
            setCurrentPage(1);
          }}
          className={`flex min-h-[116px] cursor-pointer flex-col rounded-[2px] border-2 bg-white p-5 text-left shadow-kpi shadow-kpi-hover transition dark:bg-[#111827] ${
            pinnedOnly
              ? "border-amber-500 ring-1 ring-amber-500/20"
              : "border-[#E5E7EB] hover:border-[#CBD5E1] dark:border-[#243247]"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-[#6B7280] dark:text-[#94A3B8]">
                Pinned Notices
              </p>
              <p className="mt-2 text-[26px] font-semibold leading-none text-[#111827] dark:text-[#F8FAFC]">
                {important.length}
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
              <Pin className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-auto pt-3 text-[12px] text-[#6B7280] dark:text-[#94A3B8]">
            {pinnedOnly ? "Filtered to pinned notices" : "Highlighted by HR"}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setPriorityFilter((prev) => (prev === "Urgent" ? "all" : "Urgent"));
            setCurrentPage(1);
          }}
          className={`flex min-h-[116px] cursor-pointer flex-col rounded-[2px] border-2 bg-white p-5 text-left shadow-kpi shadow-kpi-hover transition dark:bg-[#111827] ${
            priorityFilter === "Urgent"
              ? "border-rose-500 ring-1 ring-rose-500/20"
              : "border-[#E5E7EB] hover:border-[#CBD5E1] dark:border-[#243247]"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-[#6B7280] dark:text-[#94A3B8]">
                Urgent Priority
              </p>
              <p className="mt-2 text-[26px] font-semibold leading-none text-[#111827] dark:text-[#F8FAFC]">
                {urgentCount}
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
              <AlertCircle className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-auto pt-3 text-[12px] text-[#6B7280] dark:text-[#94A3B8]">
            {priorityFilter === "Urgent"
              ? "Filtered to urgent notices"
              : "Click to filter urgent"}
          </p>
        </button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        {/* Announcements Feed */}
        <section className="flex min-w-0 flex-col overflow-hidden rounded-[2px] border border-[#E5E7EB] bg-white dark:border-[#243247] dark:bg-[#111827] lg:col-span-8">
          {/* Feed Header & Category Tabs */}
          <div className="border-b border-[#E5E7EB] px-5 pt-4 dark:border-[#243247]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                  All Announcements
                </h2>
                <p className="mt-0.5 text-[12px] text-[#6B7280] dark:text-[#94A3B8]">
                  Browse company updates, HR policies, events, and system notices.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {visibleAnnouncements.length} shown
              </span>
            </div>

            <div className="overflow-x-auto [&_[role=tablist]]:gap-5 [&_[role=tab]]:whitespace-nowrap">
              <Tabs
                variant="underline"
                activeTab={selectedCategory}
                onChange={(tab) => {
                  setSelectedCategory(tab);
                  setCurrentPage(1);
                }}
                tabs={CATEGORIES.map((category) => ({
                  id: category,
                  label: category,
                  badge:
                    summaryCatalog.length > 0
                      ? (categoryCounts[category] ?? 0)
                      : undefined,
                }))}
              />
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col gap-2.5 border-b border-[#E5E7EB] bg-[#F9FAFB]/60 px-5 py-3.5 dark:border-[#243247] dark:bg-[#0F172A]/40 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search title, summary, or keyword..."
                aria-label="Search announcements"
                className="h-9 w-full rounded-lg border border-[#D1D5DB] bg-white pl-9 pr-8 text-[13px] text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#DBEAFE] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#F8FAFC]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  aria-label="Clear search query"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
              <Select
                aria-label="Filter by priority"
                value={priorityFilter}
                onChange={(event) => {
                  setPriorityFilter(event.target.value);
                  setCurrentPage(1);
                }}
                wrapperClassName="w-[132px]"
                className="h-9 text-[12px]"
                options={[
                  { value: "all", label: "All Priorities" },
                  { value: "Urgent", label: "Urgent" },
                  { value: "Important", label: "Important" },
                  { value: "Normal", label: "Normal" },
                ]}
              />

              <Select
                aria-label="Filter by date range"
                value={filterDate}
                onChange={(event) => {
                  setFilterDate(event.target.value);
                  setCurrentPage(1);
                }}
                wrapperClassName="w-[130px]"
                className="h-9 text-[12px]"
                options={[
                  { value: "all", label: "All Time" },
                  { value: "7", label: "Last 7 Days" },
                  { value: "30", label: "Last 30 Days" },
                  { value: "90", label: "Last 90 Days" },
                ]}
              />

              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                  className="h-9 shrink-0"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center justify-between gap-3 border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => void loadAnnouncements()}
              >
                Retry
              </Button>
            </div>
          )}

          {/* Feed Body */}
          <div className="flex flex-1 flex-col">
            {isLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-28 w-full rounded-[2px]" />
                ))}
              </div>
            ) : visibleAnnouncements.length === 0 ? (
              <div className="flex min-h-[260px] flex-1 items-center justify-center p-8">
                <EmptyState
                  icon={<Bell className="h-5 w-5" />}
                  title="No announcements match"
                  description={
                    hasActiveFilters
                      ? "Try adjusting your category, priority, or date filter."
                      : "Announcements published by HR for you will appear here."
                  }
                  action={
                    hasActiveFilters ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetFilters}
                      >
                        Reset Filters
                      </Button>
                    ) : undefined
                  }
                  className="max-w-none"
                />
              </div>
            ) : (
              <ul className="space-y-3 p-5">
                {visibleAnnouncements.map((announcement) => {
                  const isUnread = !readSet.has(announcement.id);

                  return (
                    <li key={announcement.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openAnnouncement(announcement)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openAnnouncement(announcement);
                          }
                        }}
                        className={`group relative cursor-pointer rounded-[2px] border p-4 transition hover:border-[#2563EB]/40 hover:bg-[#F8FAFC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 dark:hover:bg-[#1E293B]/60 ${
                          isUnread
                            ? "border-[#2563EB]/30 border-l-[3px] border-l-[#2563EB] bg-blue-50/20 dark:border-blue-500/30 dark:bg-blue-950/15"
                            : "border-[#E5E7EB] bg-white dark:border-[#243247] dark:bg-[#111827]"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {isUnread && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#2563EB] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                New
                              </span>
                            )}

                            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#2563EB] dark:bg-blue-950/50 dark:text-blue-300">
                              {announcement.category}
                            </span>

                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                priorityStyles[announcement.priority] ??
                                priorityStyles.Normal
                              }`}
                            >
                              {announcement.priority}
                            </span>

                            {announcement.pinned && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/60">
                                <Pin className="h-3 w-3" />
                                Pinned
                              </span>
                            )}
                          </div>

                          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#6B7280] transition group-hover:text-[#2563EB] dark:text-[#94A3B8]">
                            View
                            <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                          </span>
                        </div>

                        <h3 className="mt-2.5 text-[15px] font-semibold text-[#111827] transition group-hover:text-[#2563EB] dark:text-[#F8FAFC] dark:group-hover:text-blue-400">
                          {announcement.title}
                        </h3>

                        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[#4B5563] dark:text-[#CBD5E1]">
                          {announcement.description}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#F1F5F9] pt-2.5 text-[12px] text-[#6B7280] dark:border-[#1E293B] dark:text-[#94A3B8]">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(announcement.publish_date)}
                          </span>

                          <span className="inline-flex items-center gap-1.5">
                            <UserCheck className="h-3.5 w-3.5" />
                            By {announcement.author_name}
                          </span>

                          {announcement.expiry_date && (
                            <span>
                              Expires {formatDate(announcement.expiry_date)}
                            </span>
                          )}

                          {announcement.attachment && (
                            <a
                              href={resolveAttachmentUrl(
                                announcement.attachment.url,
                              )}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-medium text-[#2563EB] hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300"
                            >
                              <Paperclip className="h-3 w-3" />
                              {announcement.attachment.filename}
                            </a>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col gap-2 border-t border-[#E5E7EB] px-5 py-3.5 dark:border-[#243247] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-[#6B7280] dark:text-[#94A3B8]">
              {visibleAnnouncements.length === 0
                ? "Showing 0 announcements"
                : hasClientSideFiltering
                  ? `Showing ${visibleAnnouncements.length} matching notice${visibleAnnouncements.length === 1 ? "" : "s"} on this page`
                  : `Showing ${from}–${to} of ${total} announcement${total === 1 ? "" : "s"}`}
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((previous) => Math.max(1, previous - 1))
                  }
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] dark:border-[#243247] ${
                    currentPage === 1
                      ? "cursor-not-allowed text-gray-300 dark:text-slate-600"
                      : "text-[#4B5563] transition hover:bg-[#F9FAFB] dark:text-slate-300 dark:hover:bg-[#1E293B]"
                  }`}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                  (page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold ${
                        currentPage === page
                          ? "bg-[#2563EB] text-white"
                          : "border border-[#E5E7EB] text-[#4B5563] transition hover:bg-[#F9FAFB] dark:border-[#243247] dark:text-slate-300 dark:hover:bg-[#1E293B]"
                      }`}
                    >
                      {page}
                    </button>
                  ),
                )}

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((previous) =>
                      Math.min(totalPages, previous + 1),
                    )
                  }
                  disabled={currentPage === totalPages}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] dark:border-[#243247] ${
                    currentPage === totalPages
                      ? "cursor-not-allowed text-gray-300 dark:text-slate-600"
                      : "text-[#4B5563] transition hover:bg-[#F9FAFB] dark:text-slate-300 dark:hover:bg-[#1E293B]"
                  }`}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Right Sidebar: Pinned & Important Notices */}
        <aside className="flex flex-col lg:col-span-4">
          <section className="flex flex-1 flex-col overflow-hidden rounded-[2px] border border-[#E5E7EB] bg-white dark:border-[#243247] dark:bg-[#111827]">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4 dark:border-[#243247]">
              <div>
                <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                  <Pin className="h-4 w-4 text-[#2563EB]" />
                  Pinned &amp; Important
                </h2>
                <p className="mt-0.5 text-[12px] text-[#6B7280] dark:text-[#94A3B8]">
                  Click any highlighted notice to read
                </p>
              </div>
              {important.length > 0 && (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/60">
                  {important.length}
                </span>
              )}
            </div>

            <div className="flex flex-1 flex-col p-5">
              {important.length === 0 ? (
                <div className="flex flex-1 items-center justify-center py-8">
                  <EmptyState
                    icon={<Pin className="h-4 w-4" />}
                    title="No pinned notices"
                    description="Important company announcements will stay highlighted here."
                    className="max-w-none"
                  />
                </div>
              ) : (
                <ul className="space-y-3">
                  {important.map((announcement) => {
                    const isUnread = !readSet.has(announcement.id);

                    return (
                      <li key={announcement.id}>
                        <button
                          type="button"
                          onClick={() => openAnnouncement(announcement)}
                          className="group w-full cursor-pointer rounded-[2px] border border-[#E5E7EB] bg-[#F9FAFB]/80 p-3.5 text-left transition hover:border-[#2563EB]/40 hover:bg-blue-50/30 dark:border-[#243247] dark:bg-[#0F172A]/60 dark:hover:border-blue-500/40 dark:hover:bg-[#1E293B]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {isUnread && (
                                <span
                                  aria-label="Unread notice"
                                  className="h-2 w-2 rounded-full bg-[#2563EB]"
                                />
                              )}
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#2563EB] dark:bg-blue-950/50 dark:text-blue-300">
                                {announcement.category}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  priorityStyles[announcement.priority] ??
                                  priorityStyles.Normal
                                }`}
                              >
                                {announcement.priority}
                              </span>
                            </div>

                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF] transition group-hover:translate-x-0.5 group-hover:text-[#2563EB]" />
                          </div>

                          <p className="mt-2 text-[13px] font-semibold text-[#111827] transition group-hover:text-[#2563EB] dark:text-[#F8FAFC] dark:group-hover:text-blue-400">
                            {announcement.title}
                          </p>

                          <p className="mt-1 line-clamp-2 text-[12px] text-[#6B7280] dark:text-[#94A3B8]">
                            {announcement.description}
                          </p>

                          <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-[#6B7280] dark:text-[#94A3B8]">
                            <span>{formatDate(announcement.publish_date)}</span>
                            {announcement.attachment && (
                              <span className="inline-flex items-center gap-1 font-medium text-[#2563EB] dark:text-blue-300">
                                <Paperclip className="h-3 w-3" />
                                Attachment
                              </span>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {important.length > 0 && (
              <div className="mt-auto flex items-center justify-between border-t border-[#E5E7EB] px-5 py-3.5 text-[12px] text-[#6B7280] dark:border-[#243247] dark:text-[#94A3B8]">
                <span>{important.length} pinned notice{important.length === 1 ? "" : "s"}</span>
                <button
                  type="button"
                  onClick={() => {
                    setPinnedOnly((prev) => !prev);
                    setCurrentPage(1);
                  }}
                  className="font-medium text-[#2563EB] hover:underline dark:text-blue-400"
                >
                  {pinnedOnly ? "Show all feed" : "Filter in feed"}
                </button>
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* Announcement Details Modal */}
      {activeAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gray-950/50 p-4 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActiveAnnouncement(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-modal-title"
            className="my-auto w-full max-w-xl overflow-hidden rounded-[2px] border border-[#E5E7EB] bg-white shadow-2xl dark:border-[#243247] dark:bg-[#111827]"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-white px-6 py-5 dark:border-[#243247] dark:from-[#0F172A] dark:via-blue-950/20 dark:to-[#111827]">
              <div className="flex min-w-0 items-start gap-3.5">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <Megaphone className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#2563EB] ring-1 ring-inset ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-800/60">
                      {activeAnnouncement.category}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        priorityStyles[activeAnnouncement.priority] ??
                        priorityStyles.Normal
                      }`}
                    >
                      {activeAnnouncement.priority}
                    </span>
                    {activeAnnouncement.pinned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/60">
                        <Pin className="h-3 w-3" />
                        Pinned
                      </span>
                    )}
                  </div>

                  <h2
                    id="announcement-modal-title"
                    className="mt-2 break-words text-lg font-semibold leading-snug text-[#111827] dark:text-[#F8FAFC]"
                  >
                    {activeAnnouncement.title}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close announcement details"
                onClick={() => setActiveAnnouncement(null)}
                className="shrink-0 cursor-pointer rounded-lg p-1.5 text-[#6B7280] transition hover:bg-white hover:text-[#111827] dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 px-6 py-5">
              <div
                className={`grid grid-cols-2 gap-4 rounded-[2px] border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-xs dark:border-[#243247] dark:bg-[#0F172A]/60 ${
                  activeAnnouncement.expiry_date
                    ? "sm:grid-cols-4"
                    : "sm:grid-cols-3"
                }`}
              >
                <div className="min-w-0">
                  <p className="font-medium uppercase tracking-wide text-[#6B7280] dark:text-[#94A3B8]">
                    Published
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#6B7280]" />
                    <span className="truncate">
                      {formatDate(activeAnnouncement.publish_date)}
                    </span>
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="font-medium uppercase tracking-wide text-[#6B7280] dark:text-[#94A3B8]">
                    Posted By
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    <UserCheck className="h-3.5 w-3.5 shrink-0 text-[#6B7280]" />
                    <span className="truncate">
                      {activeAnnouncement.author_name}
                    </span>
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="font-medium uppercase tracking-wide text-[#6B7280] dark:text-[#94A3B8]">
                    Audience
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    <Users className="h-3.5 w-3.5 shrink-0 text-[#6B7280]" />
                    <span className="truncate">
                      {activeAnnouncement.audience}
                    </span>
                  </p>
                </div>

                {activeAnnouncement.expiry_date && (
                  <div className="min-w-0">
                    <p className="font-medium uppercase tracking-wide text-[#6B7280] dark:text-[#94A3B8]">
                      Valid Until
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                      <Clock3 className="h-3.5 w-3.5 shrink-0 text-[#6B7280]" />
                      <span className="truncate">
                        {formatDate(activeAnnouncement.expiry_date)}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Message Content Frame */}
              <div className="rounded-[2px] border border-[#E5E7EB] bg-white p-4 dark:border-[#243247] dark:bg-[#0F172A]/40">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] dark:text-[#94A3B8]">
                    Notice Details
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyAnnouncementText(activeAnnouncement)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#6B7280] transition hover:bg-gray-100 hover:text-[#111827] dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-white"
                  >
                    {copiedNoticeId === activeAnnouncement.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy text
                      </>
                    )}
                  </button>
                </div>
                <div className="max-h-[40vh] overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-[#374151] dark:text-[#E2E8F0]">
                  {activeAnnouncement.description}
                </div>
              </div>

              {activeAnnouncement.attachment && (
                <div className="flex items-center justify-between gap-3 rounded-[2px] border border-[#E5E7EB] bg-[#F9FAFB] p-3.5 dark:border-[#243247] dark:bg-[#0F172A]/60">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB] dark:bg-blue-950/50 dark:text-blue-300">
                      <Paperclip className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                        {activeAnnouncement.attachment.filename}
                      </p>
                      {activeAnnouncement.attachment.size ? (
                        <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
                          {formatFileSize(activeAnnouncement.attachment.size)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <a
                    href={resolveAttachmentUrl(activeAnnouncement.attachment.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#D1D5DB] bg-white px-3 py-1.5 text-xs font-medium text-[#111827] transition hover:bg-gray-50 dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#F8FAFC] dark:hover:bg-[#334155]"
                  >
                    Open
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] bg-[#F9FAFB]/70 px-6 py-3.5 dark:border-[#243247] dark:bg-[#0F172A]/40">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (readSet.has(activeAnnouncement.id)) {
                      markAsUnread(activeAnnouncement.id);
                    } else {
                      markAsRead(activeAnnouncement.id);
                    }
                  }}
                  leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                >
                  {readSet.has(activeAnnouncement.id)
                    ? "Mark unread"
                    : "Mark read"}
                </Button>

                {activeModalIndex !== -1 && visibleAnnouncements.length > 1 && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={activeModalIndex <= 0}
                      onClick={() =>
                        openAnnouncement(
                          visibleAnnouncements[activeModalIndex - 1],
                        )
                      }
                      leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        activeModalIndex >= visibleAnnouncements.length - 1
                      }
                      onClick={() =>
                        openAnnouncement(
                          visibleAnnouncements[activeModalIndex + 1],
                        )
                      }
                      rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
                    >
                      Next
                    </Button>
                  </>
                )}
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setActiveAnnouncement(null)}
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

export default EmployeeAnnouncements;
