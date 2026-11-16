import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Paperclip,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  announcementService,
  type EmployeeAnnouncement,
} from "../../services/announcementService";
import { ApiError } from "../../services/api";

const categories = [
  "All",
  "Company News",
  "HR & Policy",
  "Events",
  "IT & System",
];

const priorityStyles: Record<string, string> = {
  Urgent: "bg-red-100 text-red-700",
  Important: "bg-amber-100 text-amber-700",
  Normal: "bg-slate-100 text-slate-600",
};

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function EmployeeAnnouncements() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterDate, setFilterDate] = useState("30");
  const [currentPage, setCurrentPage] = useState(1);

  const [announcements, setAnnouncements] = useState<EmployeeAnnouncement[]>([]);
  const [important, setImportant] = useState<EmployeeAnnouncement[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeCategory =
    selectedCategory !== "All" ? selectedCategory : filterCategory;

  const loadAnnouncements = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await announcementService.list({
        page: currentPage,
        page_size: 10,
        category: activeCategory === "all" ? undefined : activeCategory,
        search: searchQuery.trim() || undefined,
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
  }, [activeCategory, currentPage, searchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAnnouncements();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadAnnouncements]);

  useEffect(() => {
    let isMounted = true;

    announcementService
      .list({ pinned: true, page_size: 5 })
      .then((result) => {
        if (isMounted) setImportant(result.announcements);
      })
      .catch(() => {
        if (isMounted) setImportant([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const from = total === 0 ? 0 : (currentPage - 1) * 10 + 1;
  const to = Math.min(currentPage * 10, total);

  const resetFilters = () => {
    setFilterCategory("all");
    setFilterDate("30");
    setSelectedCategory("All");
    setSearchQuery("");
    setCurrentPage(1);
  };

  return (
    <main className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Announcements
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Stay updated with the latest company announcements and notices.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <input
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search announcements..."
                className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-64"
              />
            </div>

            {/* Notifications */}
            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />

              {important.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {important.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex min-w-max gap-2 rounded-xl border border-gray-200 bg-white p-1.5">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                setSelectedCategory(category);
                setCurrentPage(1);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                selectedCategory === category
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Announcements Feed */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Announcements
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Latest announcements and company notices
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex min-h-[360px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="flex min-h-[360px] items-center justify-center px-6 py-12">
              <div className="max-w-sm text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                  <Bell className="h-6 w-6 text-blue-600" />
                </div>

                <h3 className="text-base font-semibold text-gray-900">
                  No announcements available
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Announcements published by HR for you will appear here.
                </p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {announcements.map((announcement) => (
                <li key={announcement.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
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
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                        Pinned
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 text-[15px] font-semibold text-gray-900">
                    {announcement.title}
                  </h3>

                  <p className="mt-1 text-sm leading-relaxed text-gray-500">
                    {announcement.description}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(announcement.publish_date)}
                    </span>

                    <span>By {announcement.author_name}</span>

                    {announcement.expiry_date && (
                      <span>Expires {formatDate(announcement.expiry_date)}</span>
                    )}

                    {announcement.attachment && (
                      <a
                        href={`http://localhost:8000${announcement.attachment.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 font-medium text-blue-600 hover:underline"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {announcement.attachment.filename}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
            <p className="text-xs text-gray-500">
              {total === 0
                ? "Showing 0 announcements"
                : `Showing ${from}-${to} of ${total} announcements`}
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((previous) => Math.max(1, previous - 1))
                  }
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 ${
                    currentPage === 1
                      ? "cursor-not-allowed text-gray-300"
                      : "text-gray-600 transition hover:bg-gray-50"
                  }`}
                  aria-label="Previous page"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </button>

                {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                  (page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold ${
                        currentPage === page
                          ? "bg-blue-600 text-white"
                          : "border border-gray-200 text-gray-600 transition hover:bg-gray-50"
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
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 ${
                    currentPage === totalPages
                      ? "cursor-not-allowed text-gray-300"
                      : "text-gray-600 transition hover:bg-gray-50"
                  }`}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Right Sidebar */}
        <aside className="space-y-6">
          {/* Filters */}
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900">
                Filter Announcements
              </h2>
            </div>

            <div className="space-y-4">
              {/* Category Filter */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Category
                </label>

                <div className="relative">
                  <select
                    value={filterCategory}
                    onChange={(event) => {
                      setFilterCategory(event.target.value);  
                      setSelectedCategory("All");
                      setCurrentPage(1);
                    }}
                    className="h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 pr-9 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="all">All Categories</option>
                    <option value="Company News">Company News</option>
                    <option value="HR & Policy">HR &amp; Policy</option>
                    <option value="Events">Events</option>
                    <option value="IT & System">IT &amp; System</option>
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              {/* Date Filter */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Date
                </label>

                <div className="relative">
                  <select
                    value={filterDate}
                    onChange={(event) =>
                      setFilterDate(event.target.value)
                    }
                    className="h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 pr-9 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="30">Last 30 Days</option>
                    <option value="7">Last 7 Days</option>
                    <option value="90">Last 90 Days</option>
                    <option value="all">All Time</option>
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="h-10 w-full rounded-lg border border-gray-200 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Clear Filter
              </button>
            </div>
          </section>

          {/* Important Announcements */}
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900">
                Important
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Pinned notices will appear here.
              </p>
            </div>

            {important.length === 0 ? (
              <div className="flex min-h-[120px] items-center justify-center rounded-lg bg-gray-50 px-4 py-6 text-center">
                <div>
                  <CalendarDays className="mx-auto mb-2 h-5 w-5 text-gray-400" />
                  <p className="text-xs text-gray-500">
                    No important announcements available.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="space-y-2">
                {important.map((announcement) => (
                  <li
                    key={announcement.id}
                    className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                  >
                    <p className="text-xs font-semibold text-gray-800">
                      {announcement.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {formatDate(announcement.publish_date)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

export default EmployeeAnnouncements;
