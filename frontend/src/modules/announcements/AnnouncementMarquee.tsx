import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Paperclip,
  Pause,
  Pin,
  Play,
} from "lucide-react";
import type { Announcement } from "../../hooks/useEmployeeData";
import { Badge, Button, Dialog, Skeleton } from "../../components/ui";
import { DASHBOARD_CARD_CLASS } from "../dashboard/DashboardCard";

type AnnouncementWithAudience = Announcement & {
  target_departments?: Array<string | { id?: string; name?: string }>;
  target_employees?: Array<
    | string
    | { id?: string; name?: string; first_name?: string; last_name?: string }
  >;
  department_names?: string[];
  employee_names?: string[];
};

interface AnnouncementMarqueeProps {
  announcements: Announcement[];
  loading?: boolean;
  error?: string;
  onViewAll: () => void;
}

const SCROLL_SPEED = 40;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function localDayStart(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function isActive(announcement: Announcement, now: Date): boolean {
  if (announcement.status === "ARCHIVED" || announcement.status === "DRAFT") {
    return false;
  }

  const publishedAt = parseDate(announcement.published_at ?? announcement.publish_date);
  if (publishedAt && publishedAt > now) return false;

  if (announcement.expiry_date) {
    const hasTime = announcement.expiry_date.includes("T");
    const expiry = hasTime
      ? new Date(announcement.expiry_date)
      : new Date(`${announcement.expiry_date}T23:59:59.999`);
    if (!Number.isNaN(expiry.getTime())) {
      if (hasTime && expiry < now) return false;
      if (!hasTime && localDayStart(expiry) < localDayStart(now)) return false;
    }
  }

  return true;
}

function dateLabel(value?: string | null): string {
  const date = parseDate(value);
  return date
    ? date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    : "";
}

function attachmentHref(path: string): string {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";
  const apiOrigin = new URL(apiBase, window.location.origin).origin;
  return new URL(path, apiOrigin).toString();
}

function expiryIsSoon(value?: string | null, now = new Date()): boolean {
  if (!value) return false;
  const expiry = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T23:59:59.999`);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() - now.getTime() <= DAY_MS;
}

function priorityBadge(announcement: Announcement) {
  if (announcement.priority === "Important" || announcement.is_important) {
    return { label: "Important", variant: "warn" as const, className: "!bg-[#FEF3C7] !text-[#92400E] !font-semibold" };
  }
  if (announcement.priority === "Urgent") {
    return { label: "Urgent", variant: "bad" as const, className: "!bg-[#FEE2E2] !text-[#B91C1C] !font-semibold" };
  }
  return { label: "Normal", variant: "info" as const, className: "!bg-[#EFF6FF] !text-[#1D4ED8]" };
}

function categoryBadge(category?: string) {
  switch (category) {
    case "Company News":
      return { variant: "info" as const, className: "!bg-[#DBEAFE] !text-[#1D4ED8]" };
    case "HR & Policy":
      return { variant: "lt-comp" as const, className: "!bg-[#F3E8FF] !text-[#6B21A8]" };
    case "Events":
      return { variant: "ok" as const, className: "!bg-[#DCFCE7] !text-[#166534]" };
    case "IT & System":
      return { variant: "off" as const, className: "!bg-[#F3F4F6] !text-[#4B5563]" };
    default:
      return { variant: "neutral" as const, className: "" };
  }
}

function getAudienceLabel(announcement: Announcement): string {
  const item = announcement as AnnouncementWithAudience;
  if (announcement.audience === "All Employees") return "All employees";

  if (announcement.audience === "Department-wise") {
    const names = item.department_names ?? item.target_departments?.map((department) =>
      typeof department === "string"
        ? (/^[a-f\d]{24}$/i.test(department) ? "" : department)
        : department.name ?? "",
    ).filter(Boolean) ?? [];
    if (!names.length) {
      return "Department-wise";
    }
    return names.length > 1 ? `${names[0]} +${names.length - 1} more` : names[0];
  }

  const names = item.employee_names ?? item.target_employees?.map((employee) => {
    if (typeof employee === "string") {
      return /^[a-f\d]{24}$/i.test(employee) ? "" : employee;
    }
    return employee.name ?? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim();
  }).filter(Boolean) ?? [];
  if (!names.length) return "Custom";
  return names.length > 1 ? `${names[0]} +${names.length - 1} more` : names[0];
}

function AnnouncementItem({
  announcement,
  onClick,
  tabIndex = 0,
}: {
  announcement: Announcement;
  onClick: () => void;
  tabIndex?: number;
}) {
  const priority = priorityBadge(announcement);
  const category = categoryBadge(announcement.category);
  const expirySoon = expiryIsSoon(announcement.expiry_date);
  const dateText = dateLabel(announcement.publish_date ?? announcement.published_at);
  const expiryText = announcement.expiry_date ? dateLabel(announcement.expiry_date) : "";
  const dateRange = dateText && expiryText ? `${dateText} - ${expiryText}` : (dateText || expiryText);

  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={tabIndex}
      aria-label={`View announcement: ${announcement.title}`}
      className="announcement-marquee-item inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md px-2 py-1 text-left transition hover:bg-slate-100/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB] focus-visible:outline-offset-1 my-auto"
    >
      <Badge variant={priority.variant} dot={false} className={`!h-6 !px-2 !text-[12px] inline-flex items-center justify-center shrink-0 ${priority.className}`}>
        {priority.label}
      </Badge>

      <span className="max-w-[260px] truncate text-[13px] font-semibold text-[#111827] leading-none self-center">
        {announcement.title}
      </span>

      {announcement.category && (
        <>
          <span className="text-[12px] text-[#9CA3AF] self-center select-none" aria-hidden="true">|</span>
          <Badge variant={category.variant} dot={false} className={`!h-6 !px-2 !text-[12px] inline-flex items-center justify-center shrink-0 ${category.className}`}>
            {announcement.category}
          </Badge>
        </>
      )}

      {dateRange && (
        <span className="text-[12px] text-[#6B7280] leading-none self-center">
          {dateRange}
        </span>
      )}

      <span className="text-[12px] text-[#9CA3AF] self-center select-none" aria-hidden="true">|</span>
      <span className="inline-flex items-center justify-center rounded bg-[#DCFCE7] px-2 py-0.5 text-[11px] font-semibold text-[#166534] leading-none shrink-0 self-center">
        {announcement.status || "Published"}
      </span>

      {announcement.description && (
        <>
          <span className="text-[12px] text-[#9CA3AF] self-center select-none" aria-hidden="true">|</span>
          <span className="max-w-[400px] truncate text-[12px] text-[#6B7280] leading-none self-center">
            {announcement.description.slice(0, 80)}{announcement.description.length > 80 ? "…" : ""}
          </span>
        </>
      )}

      {announcement.pinned && (
       
       
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-[#2563EB] self-center">
          <Pin className="h-3.5 w-3.5" aria-hidden="true" /> Pinned
        </span>
      )}

      {expirySoon && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-[#B91C1C] self-center">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          Expiring Soon
        </span>
      )}

      {announcement.attachment && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] text-[#6B7280] self-center">
          <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
          Attachment
        </span>
      )}
    </button>
  );
}

export function AnnouncementMarquee({
  announcements,
  loading = false,
  error = "",
  onViewAll,
}: AnnouncementMarqueeProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const sequenceRef = useRef<HTMLDivElement>(null);
  const [sequenceMinWidth, setSequenceMinWidth] = useState(0);
  const [scrollDuration, setScrollDuration] = useState(30);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const activeAnnouncements = useMemo(() => {
    const now = new Date();
    const seenAnnouncements = new Set<string>();

    // 1. Try to filter strictly active unexpired announcements
    let list = announcements.filter((announcement) => isActive(announcement, now));

    // 2. Resilient fallback: If all announcements in DB are expired or past date,
    // do NOT hide the marquee! Keep showing published announcements.
    if (list.length === 0 && announcements.length > 0) {
      list = announcements.filter((a) => a.status !== "ARCHIVED" && a.status !== "DRAFT");
      if (list.length === 0) list = announcements;
    }

    return list
      .filter((announcement) => {
        const signature = JSON.stringify([
          announcement.title.trim().toLocaleLowerCase(),
          announcement.description.trim(),
          announcement.category,
          announcement.priority,
          announcement.publish_date ?? announcement.published_at,
          announcement.expiry_date,
          announcement.audience,
          announcement.pinned,
          announcement.author_name,
        ]);
        if (seenAnnouncements.has(signature)) return false;
        seenAnnouncements.add(signature);
        return true;
      })
      .sort((a, b) => {
        const pinOrder = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
        if (pinOrder) return pinOrder;
        const importantOrder = Number(b.priority === "Important") - Number(a.priority === "Important");
        if (importantOrder) return importantOrder;
        const dateA = parseDate(a.published_at ?? a.publish_date ?? a.created_at)?.getTime() ?? 0;
        const dateB = parseDate(b.published_at ?? b.publish_date ?? b.created_at)?.getTime() ?? 0;
        return dateB - dateA;
      });
  }, [announcements]);

  // Ensure we always have items to display
  const displayAnnouncements = useMemo(() => {
    if (activeAnnouncements.length > 0) return activeAnnouncements;
    return [
      {
        id: "default-announcement",
        title: "Welcome to PeopleSync HRMS",
        description: "All enterprise system modules are active and synced. Stay tuned for organization updates and company notices.",
        category: "Company News",
        priority: "Important",
        status: "Published",
        publish_date: new Date().toISOString().split("T")[0],
        pinned: true,
        audience: "All Employees",
      },
    ];
  }, [activeAnnouncements]);

  // Expand sequence items so even a single announcement fills the screen and loops seamlessly
  const sequenceItems = useMemo(() => {
    if (displayAnnouncements.length === 0) return [];
    if (displayAnnouncements.length === 1) {
      return [
        displayAnnouncements[0],
        displayAnnouncements[0],
        displayAnnouncements[0],
        displayAnnouncements[0],
      ];
    }
    if (displayAnnouncements.length === 2) {
      return [
        displayAnnouncements[0],
        displayAnnouncements[1],
        displayAnnouncements[0],
        displayAnnouncements[1],
      ];
    }
    return displayAnnouncements;
  }, [displayAnnouncements]);

  useEffect(() => {
    if (error) console.error("Announcement feed notice:", error);
  }, [error]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener?.("change", updatePreference);
    return () => media.removeEventListener?.("change", updatePreference);
  }, []);

  useLayoutEffect(() => {
    if (prefersReducedMotion) return;
    const viewport = viewportRef.current;
    const sequence = sequenceRef.current;
    if (!viewport || !sequence) return;

    const measure = () => {
      const width = sequence.getBoundingClientRect().width;
      const viewportWidth = viewport.clientWidth;
      setSequenceMinWidth(viewportWidth);
      if (width > 0) {
        setScrollDuration(Math.max(width / SCROLL_SPEED, 25));
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(sequence);
    return () => observer.disconnect();
  }, [sequenceItems.length, prefersReducedMotion]);

  const [prevDisplayLen, setPrevDisplayLen] = useState(displayAnnouncements.length);
  if (displayAnnouncements.length !== prevDisplayLen) {
    setPrevDisplayLen(displayAnnouncements.length);
    setActiveIndex((index) => Math.min(index, Math.max(displayAnnouncements.length - 1, 0)));
  }

  // Clean, generous margin-bottom so there is a distinct gap between the marquee and the KPI cards below
  const cardClass = `${DASHBOARD_CARD_CLASS} !mt-4 !mb-6 !h-[60px] !w-full !rounded-[2px] !p-0 shadow-xs border border-[#E5E7EB] bg-white`;

  if (loading) {
    return (
      <section className={cardClass} role="status" aria-label="Loading announcements">
        <div className="flex h-full items-center gap-4 px-4">
          <div className="flex w-[214px] shrink-0 items-center gap-3 border-r border-[#E5E7EB] pr-4">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-5 flex-1 rounded-full" />
        </div>
      </section>
    );
  }

  const openAnnouncement = (announcement: Announcement) => setSelectedAnnouncement(announcement);
  const moveSelection = (direction: -1 | 1) => {
    setActiveIndex((index) => (index + direction + displayAnnouncements.length) % displayAnnouncements.length);
  };
  const shouldPause = paused || hovered || focused || prefersReducedMotion;

  const renderSequence = (copyIndex: number) =>
    sequenceItems.map((announcement, index) => (
      <Fragment key={`${copyIndex}-${announcement.id ?? index}-${index}`}>
        <span className="inline-flex h-full shrink-0 items-center gap-2">
          <AnnouncementItem
            announcement={announcement}
            onClick={() => openAnnouncement(announcement)}
            tabIndex={copyIndex > 0 ? -1 : 0}
          />
          <span className="text-[14px] text-[#9CA3AF] px-2 select-none self-center" aria-hidden="true">•</span>
        </span>
      </Fragment>
    ));

  return (
    <>
      <section
        className={cardClass}
        role="region"
        aria-label="Announcements"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}
      >
        <div className="flex h-full min-w-0 items-center">
          {/* Left Announcement Branding Box */}
          <div className="flex h-full w-[190px] shrink-0 items-center gap-2 border-r border-[#E5E7EB] px-2.5 sm:w-[220px] sm:gap-3 sm:px-4 bg-[#F8FAFC]/60">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB] shadow-xs">
              <Megaphone className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block whitespace-nowrap text-[13px] font-bold text-[#111827]">Announcements</span>
              <span className="block whitespace-nowrap text-[11px] font-medium text-[#6B7280]">Latest updates</span>
            </span>
          </div>

          {/* Marquee Viewport */}
          <div ref={viewportRef} className="announcement-marquee-viewport relative flex h-full min-w-0 flex-1 items-center overflow-hidden">
            {prefersReducedMotion ? (
              <div className="flex h-full min-w-0 flex-1 items-center justify-center gap-1 px-2">
                <Button
                  variant="ghost"
                  size="xs"
                  className="!h-7 !w-7 !shrink-0 !p-0"
                  aria-label="Previous announcement"
                  onClick={() => moveSelection(-1)}
                  disabled={displayAnnouncements.length < 2}
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                <div className="min-w-0 flex-1 overflow-hidden flex items-center justify-center">
                  <AnnouncementItem
                    announcement={displayAnnouncements[activeIndex]}
                    onClick={() => openAnnouncement(displayAnnouncements[activeIndex])}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  className="!h-7 !w-7 !shrink-0 !p-0"
                  aria-label="Next announcement"
                  onClick={() => moveSelection(1)}
                  disabled={displayAnnouncements.length < 2}
                >
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <>
                <div
                  className="announcement-marquee-track announcement-marquee-animated flex h-full w-max items-center"
                  style={{
                    "--announcement-duration": `${scrollDuration}s`,
                    animationPlayState: shouldPause ? "paused" : "running",
                  } as React.CSSProperties}
                >
                  <div
                    ref={sequenceRef}
                    className="announcement-marquee-sequence flex h-full shrink-0 items-center gap-3"
                    style={{ minWidth: sequenceMinWidth > 0 ? `${sequenceMinWidth}px` : undefined }}
                  >
                    {renderSequence(0)}
                  </div>
                  <div
                    className="announcement-marquee-sequence flex h-full shrink-0 items-center gap-3"
                    style={{ minWidth: sequenceMinWidth > 0 ? `${sequenceMinWidth}px` : undefined }}
                    aria-hidden="true"
                  >
                    {renderSequence(1)}
                  </div>
                </div>
                <span className="announcement-marquee-fade announcement-marquee-fade-left" aria-hidden="true" />
                <span className="announcement-marquee-fade announcement-marquee-fade-right" aria-hidden="true" />
              </>
            )}
          </div>

          {/* Right Action Controls: Pause/Play + View All */}
          <div className="flex h-full shrink-0 items-center gap-1 border-l border-[#E5E7EB] px-1 sm:gap-2 sm:px-3 bg-[#F8FAFC]/40">
            <Button
              variant="ghost"
              size="xs"
              className="!h-7 !w-7 !shrink-0 !p-0 !text-[#52606D] hover:!bg-slate-100"
              aria-label={shouldPause ? "Resume announcements" : "Pause announcements"}
              title={shouldPause ? "Resume announcements" : "Pause announcements"}
              onClick={() => setPaused((value) => !value)}
            >
              {shouldPause ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              className="!h-8 !px-2.5 !text-[12px] !font-semibold !text-[#2563EB] hover:!bg-[#EFF6FF]"
              onClick={onViewAll}
            >
              View all
            </Button>
          </div>
        </div>
      </section>

      {/* Announcement Detail Modal */}
      <Dialog
        open={Boolean(selectedAnnouncement)}
        onClose={() => setSelectedAnnouncement(null)}
        title={selectedAnnouncement?.title}
        maxWidth="xl"
      >
        {selectedAnnouncement && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant={priorityBadge(selectedAnnouncement).variant} dot={false}>
                {priorityBadge(selectedAnnouncement).label}
              </Badge>
              {selectedAnnouncement.category && (
                <Badge variant={categoryBadge(selectedAnnouncement.category).variant} dot={false}>
                  {selectedAnnouncement.category}
                </Badge>
              )}
              {selectedAnnouncement.pinned && (
                <Badge variant="info" dot={false}>
                  <span className="inline-flex items-center gap-1"><Pin className="h-3 w-3" /> Pinned</span>
                </Badge>
              )}
              {selectedAnnouncement.status && (
                <Badge variant={selectedAnnouncement.status === "IMPORTANT" ? "warn" : "neutral"} dot={false}>
                  {selectedAnnouncement.status}
                </Badge>
              )}
            </div>
            <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-[#6B7280]">
              <span>Published {dateLabel(selectedAnnouncement.publish_date ?? selectedAnnouncement.published_at)}</span>
              <span>{selectedAnnouncement.expiry_date ? `Expires ${dateLabel(selectedAnnouncement.expiry_date)}` : "No expiry"}</span>
              <span>{getAudienceLabel(selectedAnnouncement)}</span>
              {selectedAnnouncement.author_name && <span>By {selectedAnnouncement.author_name}</span>}
            </div>
            <p className="whitespace-pre-wrap text-[13px] leading-6 text-[#374151]">{selectedAnnouncement.description}</p>
            {selectedAnnouncement.attachment && (
              <a
                href={attachmentHref(selectedAnnouncement.attachment.url)}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-md border border-[#E5E7EB] px-3 py-2 text-[12px] font-medium text-[#2563EB] hover:bg-[#EFF6FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]"
              >
                <Paperclip className="h-4 w-4" aria-hidden="true" />
                {selectedAnnouncement.attachment.filename}
              </a>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}

export default AnnouncementMarquee;
