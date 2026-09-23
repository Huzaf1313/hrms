import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { api } from "../../services/api";

const categories = [
  "All",
  "Company",
  "HR & Policy",
  "Events",
  "IT & System",
];

interface Announcement {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  published_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_important: boolean;
}

interface EmployeeAnnouncementsResponse {
  announcements: Announcement[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const PAGE_SIZE = 10;

function EmployeeAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterDate, setFilterDate] = useState("30");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get<EmployeeAnnouncementsResponse>(
          "/employee-announcements"
        );

        setAnnouncements(response.announcements || []);
      } catch (err) {
        console.error("Failed to fetch employee announcements:", err);
        setError("Unable to load announcements. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, []);

  const getCategoryGroup = (category: string) => {
    const normalizedCategory = category.toLowerCase();

    if (normalizedCategory.includes("company")) {
      return "Company";
    }

    if (
      normalizedCategory.includes("hr") ||
      normalizedCategory.includes("policy")
    ) {
      return "HR & Policy";
    }

    if (normalizedCategory.includes("event")) {
      return "Events";
    }

    if (
      normalizedCategory.includes("it") ||
      normalizedCategory.includes("system")
    ) {
      return "IT & System";
    }

    return category;
  };

  const filteredAnnouncements = useMemo(() => {
    const now = new Date();

    return announcements.filter((announcement) => {
      // Category tabs
      if (
        selectedCategory !== "All" &&
        getCategoryGroup(announcement.category) !== selectedCategory
      ) {
        return false;
      }

      // Sidebar category filter
      if (filterCategory !== "all") {
        const categoryMap: Record<string, string> = {
          company: "Company",
          hr: "HR & Policy",
          events: "Events",
          it: "IT & System",
        };

        if (
          getCategoryGroup(announcement.category) !==
          categoryMap[filterCategory]
        ) {
          return false;
        }
      }

      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();

        const matchesTitle = announcement.title
          .toLowerCase()
          .includes(query);

        const matchesDescription = announcement.description
          .toLowerCase()
          .includes(query);

        const matchesCategory = announcement.category
          .toLowerCase()
          .includes(query);

        if (!matchesTitle && !matchesDescription && !matchesCategory) {
          return false;
        }
      }

      // Date filter
      if (filterDate !== "all") {
        const publishedDate = new Date(announcement.published_at);
        const days = Number(filterDate);

        const differenceInMilliseconds =
          now.getTime() - publishedDate.getTime();

        const differenceInDays =
          differenceInMilliseconds / (1000 * 60 * 60 * 24);

        if (differenceInDays > days || differenceInDays < 0) {
          return false;
        }
      }

      return true;
    });
  }, [
    announcements,
    selectedCategory,
    filterCategory,
    filterDate,
    searchQuery,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAnnouncements.length / PAGE_SIZE)
  );

  const paginatedAnnouncements = filteredAnnouncements.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, filterCategory, filterDate, searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const importantAnnouncements = filteredAnnouncements.filter(
    (announcement) => announcement.is_important
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const clearFilters = () => {
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
                onChange={(event) => setSearchQuery(event.target.value)}
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

              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                3
              </span>
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
              onClick={() => setSelectedCategory(category)}
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Announcements Feed */}
        <section className="rounded-xl border border-gray-200 bg-white">
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

          {/* Loading */}
          {loading && (
            <div className="flex min-h-[360px] items-center justify-center px-6 py-12">
              <div className="text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
                <p className="text-sm text-gray-500">
                  Loading announcements...
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex min-h-[360px] items-center justify-center px-6 py-12">
              <div className="max-w-sm text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                  <Bell className="h-6 w-6 text-red-500" />
                </div>

                <h3 className="text-base font-semibold text-gray-900">
                  Unable to load announcements
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && paginatedAnnouncements.length === 0 && (
            <div className="flex min-h-[360px] items-center justify-center px-6 py-12">
              <div className="max-w-sm text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                  <Bell className="h-6 w-6 text-blue-600" />
                </div>

                <h3 className="text-base font-semibold text-gray-900">
                  No announcements available
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  No announcements match your current filters.
                </p>
              </div>
            </div>
          )}

          {/* Announcement List */}
          {!loading && !error && paginatedAnnouncements.length > 0 && (
            <div className="divide-y divide-gray-100">
              {paginatedAnnouncements.map((announcement) => (
                <article
                  key={announcement.id}
                  className="px-5 py-5 transition hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                          {getCategoryGroup(announcement.category)}
                        </span>

                        {announcement.is_important && (
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600">
                            Important
                          </span>
                        )}

                        {announcement.priority &&
                          announcement.priority.toLowerCase() !== "normal" && (
                            <span className="rounded-full bg-yellow-50 px-2.5 py-1 text-[11px] font-medium text-yellow-700">
                              {announcement.priority}
                            </span>
                          )}
                      </div>

                      <h3 className="text-base font-semibold text-gray-900">
                        {announcement.title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        {announcement.description}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>
                          Published {formatDate(announcement.published_at)}
                        </span>

                        {announcement.created_by && (
                          <span>
                            By {announcement.created_by}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && filteredAnnouncements.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
              <p className="text-xs text-gray-500">
                Showing{" "}
                {(currentPage - 1) * PAGE_SIZE + 1} -{" "}
                {Math.min(
                  currentPage * PAGE_SIZE,
                  filteredAnnouncements.length
                )}{" "}
                of {filteredAnnouncements.length} announcements
              </p>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((previous) =>
                      Math.max(1, previous - 1)
                    )
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

                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1
                ).map((page) => (
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
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((previous) =>
                      Math.min(totalPages, previous + 1)
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
            </div>
          )}
        </section>

        {/* Right Sidebar */}
        <aside className="space-y-6">
          {/* Filters */}
          <section className="rounded-xl border border-gray-200 bg-white p-5">
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
                    onChange={(event) =>
                      setFilterCategory(event.target.value)
                    }
                    className="h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 pr-9 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="all">All Categories</option>
                    <option value="company">Company</option>
                    <option value="hr">HR & Policy</option>
                    <option value="events">Events</option>
                    <option value="it">IT & System</option>
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

              {/* Clear Filters */}
              <button
                type="button"
                onClick={clearFilters}
                className="h-10 w-full rounded-lg border border-gray-200 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Clear Filter
              </button>
            </div>
          </section>

          {/* Important Announcements */}
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900">
                Important
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Flagged notices will appear here.
              </p>
            </div>

            {importantAnnouncements.length === 0 ? (
              <div className="flex min-h-[120px] items-center justify-center rounded-lg bg-gray-50 px-4 py-6 text-center">
                <div>
                  <CalendarDays className="mx-auto mb-2 h-5 w-5 text-gray-400" />

                  <p className="text-xs text-gray-500">
                    No important announcements available.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {importantAnnouncements.slice(0, 3).map((announcement) => (
                  <div
                    key={announcement.id}
                    className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                  >
                    <h3 className="text-xs font-semibold text-gray-900">
                      {announcement.title}
                    </h3>

                    <p className="mt-1 text-[11px] leading-5 text-gray-500">
                      {formatDate(announcement.published_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

export default EmployeeAnnouncements;