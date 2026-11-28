
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Pin, Users, X } from "lucide-react";
import type { Announcement } from "../../hooks/useEmployeeData";

interface EmployeeAnnouncementTickerProps {
  announcements: Announcement[];
  loading?: boolean;
  error?: string;
  /** Use the light palette when this ticker appears on the admin dashboard. */
  tone?: "default" | "dashboard";
  onViewAll?: () => void;
  /** Where a click on an announcement goes. Defaults to the employee list;
   *  the admin dashboard points it at the admin announcements page. */
  onSelect?: () => void;
}

const ROTATION_INTERVAL_MS = 5000;

function displayDate(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function priorityStyle(priority?: string): string {
  if (priority === "Urgent") return "bg-[#FEE2E2] text-[#B91C1C]";
  if (priority === "Important") return "bg-[#FEF3C7] text-[#92400E]";
  return "bg-[#F3F4F6] text-[#6B7280]";
}

function dateValue(value?: string | null): number {
  if (!value) return 0;
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function isExpired(announcement: Announcement, now: number): boolean {
  if (!announcement.expiry_date) return false;
  const expiry = announcement.expiry_date.includes("T")
    ? new Date(announcement.expiry_date)
    : new Date(`${announcement.expiry_date}T23:59:59.999`);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() < now;
}

function EmployeeAnnouncementTicker({
  announcements,
  loading = false,
  error = "",
  onSelect,
  tone = "default",
  onViewAll,
}: EmployeeAnnouncementTickerProps) {
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<Announcement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [mountTime] = useState(() => Date.now());
  const dashboardTone = tone === "dashboard";
  const rotationPaused = isHovered || isFocused;
  const visibleAnnouncements = useMemo(() => {
    return announcements
      .filter((announcement) => !isExpired(announcement, mountTime))
      .sort((a, b) => {
        const pinnedDifference = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
        if (pinnedDifference !== 0) return pinnedDifference;

        const importantA = Boolean(a.is_important) || a.priority === "Important";
        const importantB = Boolean(b.is_important) || b.priority === "Important";
        const importantDifference = Number(importantB) - Number(importantA);
        if (importantDifference !== 0) return importantDifference;

        const newestA = dateValue(a.published_at) || dateValue(a.publish_date) || dateValue(a.created_at);
        const newestB = dateValue(b.published_at) || dateValue(b.publish_date) || dateValue(b.created_at);
        return newestB - newestA;
      });
  }, [announcements, mountTime]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;

    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener?.("change", updatePreference);
    return () => media.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    if (rotationPaused || prefersReducedMotion || visibleAnnouncements.length < 2) return;

    const interval = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % visibleAnnouncements.length);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [prefersReducedMotion, rotationPaused, visibleAnnouncements.length]);

  if (visibleAnnouncements.length === 0) return null;

  const safeActiveIndex = activeIndex % visibleAnnouncements.length;
  const activeAnnouncement = visibleAnnouncements[safeActiveIndex];

  const handleAnnouncementClick = (announcement: Announcement) => {
    if (onSelect) {
      onSelect();
      return;
    }

    setSelectedAnnouncement(announcement);
  };

  return (
    <section
      className={`relative overflow-hidden rounded-[2px] border ${dashboardTone ? "border-[#E4E6E1] bg-white" : "border-white/10 bg-gradient-to-r from-[#0d1b3d] via-[#1e3a8a] to-[#4331a5] shadow-xl shadow-blue-900/25"}`}
      aria-label="Employee announcements"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsFocused(false);
        }
      }}
    >
      {!dashboardTone && <div className="ticker-glow-1 pointer-events-none absolute -top-20 left-[15%] h-40 w-40 rounded-full bg-sky-400/30 blur-3xl" />}

      {!dashboardTone && <div className="ticker-glow-2 pointer-events-none absolute -bottom-24 right-[20%] h-44 w-44 rounded-full bg-fuchsia-400/25 blur-3xl" />}

      {!dashboardTone && <div className="ticker-shine pointer-events-none absolute inset-y-0 left-0 z-20 w-28 bg-gradient-to-r from-transparent via-white/20 to-transparent" />}

      <div className="relative flex min-h-[76px] items-center">
        <div className={`relative z-10 flex min-h-[76px] min-w-[190px] items-center gap-3 border-r px-5 ${dashboardTone ? "border-[#E4E6E1] bg-[#F6F7F5]" : "border-white/15 bg-white/5 backdrop-blur"}`}>
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${dashboardTone ? "bg-[#E8EEFB] text-[#2F5FD0]" : "bg-gradient-to-br from-amber-300 to-orange-500 shadow-lg shadow-orange-500/40 ring-2 ring-white/25"}`}>
            📢
          </span>

          <div>
            <h3 className={`text-sm font-bold tracking-wide ${dashboardTone ? "text-[#1F2933]" : "text-white"}`}>
              Announcements
            </h3>
            <p className={`text-xs ${dashboardTone ? "text-[#52606D]" : "text-blue-200/80"}`}>
              Latest updates
            </p>
          </div>
        </div>

        <div className="relative min-w-0 flex-1 overflow-hidden">
          {loading ? (
            <p className={`px-6 text-sm ${dashboardTone ? "text-[#52606D]" : "text-white/80"}`}>
              Loading announcements...
            </p>
          ) : error ? (
            <p className={`px-6 text-sm ${dashboardTone ? "text-[#A12D22]" : "text-red-200"}`}>
              {error}
            </p>
          ) : (
            <div className="flex min-w-0 items-center gap-3 px-5 py-3">
              {visibleAnnouncements.length > 0 && (
                <button
                  key={activeAnnouncement.id ?? safeActiveIndex}
                  type="button"
                  onClick={() => handleAnnouncementClick(activeAnnouncement)}
                  className={`flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 ${dashboardTone ? "focus-visible:outline-[#2F5FD0]" : "focus-visible:outline-white"} ${visibleAnnouncements.length > 1 && !prefersReducedMotion ? "announcement-slide-in" : ""}`}
                  aria-live="polite"
                  aria-label={`View announcement: ${activeAnnouncement.title}`}
                >
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${priorityStyle(activeAnnouncement.priority)}`}>
                    {activeAnnouncement.priority || "Normal"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block line-clamp-1 text-sm font-semibold leading-5 ${dashboardTone ? "text-[#1F2933]" : "text-white"}`}>
                      {activeAnnouncement.title}
                    </span>
                    {activeAnnouncement.description && (
                      <span className={`mt-0.5 block line-clamp-1 text-xs ${dashboardTone ? "text-[#7B8794]" : "text-blue-100/80"}`}>
                        {activeAnnouncement.description}
                      </span>
                    )}
                  </span>
                  {visibleAnnouncements.length > 1 && (
                    <span className={`shrink-0 text-xs ${dashboardTone ? "text-[#7B8794]" : "text-blue-200"}`}>
                      {safeActiveIndex + 1} / {visibleAnnouncements.length}
                    </span>
                  )}
                </button>
              )}
              {onViewAll && (
                <button
                  type="button"
                  onClick={onViewAll}
                  className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold focus-visible:outline focus-visible:outline-2 ${dashboardTone ? "text-[#2F5FD0] hover:bg-[#E8EEFB] focus-visible:outline-[#2F5FD0]" : "text-blue-100 hover:bg-white/10 focus-visible:outline-white"}`}
                >
                  View all
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {selectedAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,24,39,0.5)] p-4"
          role="presentation"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-announcement-title"
            className="max-h-[calc(100vh-32px)] w-full max-w-xl overflow-y-auto rounded-[2px] border border-[#E5E7EB] bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {selectedAnnouncement.category && (
                    <span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[12px] font-medium text-[#1D4ED8]">
                      {selectedAnnouncement.category}
                    </span>
                  )}
                  <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${priorityStyle(selectedAnnouncement.priority)}`}>
                    {selectedAnnouncement.priority || "Normal"}
                  </span>
                  {selectedAnnouncement.pinned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[12px] font-medium text-[#2563EB]">
                      <Pin className="h-3.5 w-3.5" /> Pinned
                    </span>
                  )}
                </div>
                <h2 id="dashboard-announcement-title" className="text-[20px] font-semibold leading-tight text-[#111827]">
                  {selectedAnnouncement.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                aria-label="Close announcement details"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-[#6B7280]">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                Published {displayDate(selectedAnnouncement.publish_date ?? selectedAnnouncement.published_at)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-4 w-4" />
                Expires {displayDate(selectedAnnouncement.expiry_date)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {selectedAnnouncement.audience || "All Employees"}
              </span>
            </div>

            <p className="mt-6 whitespace-pre-wrap text-[13px] leading-6 text-[#4B5563]">
              {selectedAnnouncement.description}
            </p>

            {selectedAnnouncement.author_name && (
              <p className="mt-5 border-t border-[#E5E7EB] pt-4 text-[12px] text-[#6B7280]">
                By {selectedAnnouncement.author_name}
              </p>
            )}

          </div>
        </div>
      )}
    </section>
  );
}

export default EmployeeAnnouncementTicker;
