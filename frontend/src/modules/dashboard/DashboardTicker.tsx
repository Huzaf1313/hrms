import { useLayoutEffect, useRef, useState } from "react";

import type { Announcement } from "../../hooks/useEmployeeData";
import type { Celebration } from "./celebrationTypes";
import { getThoughtForDate } from "./celebrationThoughts";

/** Badge emoji per celebration type: cake for birthdays, party popper for work anniversaries. */
const ICONS: Record<Celebration["type"], string> = {
  birthday: "\u{1F382}",
  anniversary: "\u{1F389}",
};

const ANNOUNCEMENT_ICON = "\u{1F4E2}";
const THOUGHT_ICON = "\u{1F4A1}";

// Movement speed in pixels per second. Keeping this fixed means one quiet
// birthday scrolls at the same rate as a full list of items.
const PIXELS_PER_SECOND = 40;
const MINIMUM_DURATION_SECONDS = 6;

/**
 * One entry in the scrolling strip. Celebrations and announcements are mapped
 * into this shape up front so the marquee renders a single flat list; a
 * "thought" only appears when there is nothing else to show.
 */
type TickerItem =
  | {
      kind: "celebration";
      key: string;
      icon: string;
      label: string;
      message: string;
    }
  | {
      kind: "announcement";
      key: string;
      title: string;
      priority: string;
      category?: string;
    }
  | {
      kind: "thought";
      key: string;
      message: string;
    };

interface MarqueeProps {
  items: TickerItem[];
  onSelectAnnouncement?: () => void;
}

/** Measured once per resize; drives how many copies render and how far the track slides. */
interface MarqueeLayout {
  /** How many times the item set is repeated along the track. */
  copies: number;
  /** Pixels the track moves per loop (one set, plus the gap for a lone item). */
  distance: number;
  /** Banner width, reused as the spacer width for a lone item. */
  viewportWidth: number;
}

/** Pill colours for an announcement's priority; anything unrecognised reads as Normal. */
function priorityClasses(priority: string): string {
  if (priority === "Urgent") {
    return "bg-red-500/25 text-red-200 ring-1 ring-red-300/40";
  }

  if (priority === "Important") {
    return "bg-amber-400/25 text-amber-200 ring-1 ring-amber-300/40";
  }

  return "bg-white/15 text-blue-100 ring-1 ring-white/20";
}

/**
 * Renders one ticker item. Announcements become a button when a click target
 * is given; celebrations and the thought are display-only.
 *
 * `focusable` is true only for the first copy of the set: the repeats exist
 * purely for the visual loop, so they are kept out of the tab order.
 */
function TickerEntry({
  item,
  focusable,
  onSelectAnnouncement,
}: {
  item: TickerItem;
  focusable: boolean;
  onSelectAnnouncement?: () => void;
}) {
  if (item.kind === "announcement") {
    const content = (
      <>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-base shadow-md shadow-orange-500/40 ring-2 ring-amber-200/40">
          {ANNOUNCEMENT_ICON}
        </span>

        <span
          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${priorityClasses(item.priority)}`}
        >
          {item.priority}
        </span>

        <span className="text-sm font-semibold text-white">{item.title}</span>

        {item.category && (
          <>
            <span className="text-white/30">|</span>
            <span className="text-xs text-blue-200">{item.category}</span>
          </>
        )}
      </>
    );

    const className =
      "flex shrink-0 items-center gap-2.5 whitespace-nowrap px-6 py-1.5";

    return onSelectAnnouncement ? (
      <button
        type="button"
        onClick={onSelectAnnouncement}
        tabIndex={focusable ? 0 : -1}
        className={`${className} text-left transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white`}
      >
        {content}
      </button>
    ) : (
      <div className={className}>{content}</div>
    );
  }

  const isThought = item.kind === "thought";

  return (
    <div className="flex shrink-0 items-center gap-2.5 whitespace-nowrap px-6 py-1.5">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base ring-2 ${
          isThought
            ? "bg-gradient-to-br from-amber-300 to-orange-500 text-white shadow-md shadow-orange-500/40 ring-amber-200/40"
            : "bg-white/15 shadow-inner ring-white/25"
        }`}
      >
        {isThought ? THOUGHT_ICON : item.icon}
      </span>

      {!isThought && (
        <>
          <span className="text-sm font-semibold text-white">{item.label}</span>

          <span className="text-white/30">|</span>
        </>
      )}

      <span
        className={`rounded-full border border-white/20 bg-white/10 px-4 py-1 text-sm shadow-lg shadow-black/20 backdrop-blur ${
          isThought ? "italic text-white" : "font-medium text-white/90"
        }`}
      >
        {isThought && (
          <span
            aria-hidden="true"
            className="mr-1.5 font-serif text-base leading-none text-amber-300"
          >
            &ldquo;
          </span>
        )}

        {item.message}

        {isThought && (
          <span
            aria-hidden="true"
            className="ml-1 font-serif text-base leading-none text-amber-300"
          >
            &rdquo;
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * Infinite horizontal scroll.
 *
 * The track is translated by exactly one set's measured width, so the next
 * copy always sits where the first one started and the loop has no visible
 * seam.
 *
 * With several items the set is naturally wider than the banner, so repeating
 * it keeps the viewport covered. A lone item - the daily thought, say - is
 * narrower than the banner, and repeating it outright would show the same item
 * twice at once. That case gets a full-viewport gap appended instead, so each
 * copy leaves the screen before the next one arrives.
 */
function Marquee({ items, onSelectAnnouncement }: MarqueeProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<MarqueeLayout>({
    copies: 2,
    distance: 0,
    viewportWidth: 0,
  });

  const isSingleItem = items.length === 1;

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const itemsElement = itemsRef.current;

    if (!viewport || !itemsElement || items.length === 0) {
      return;
    }

    const measure = () => {
      // Measured on the items alone, so the gap appended below never feeds
      // back into its own width.
      const contentWidth = itemsElement.getBoundingClientRect().width;

      // Width 0 means the ticker is hidden or not laid out yet; a later
      // ResizeObserver callback will pick it up.
      if (contentWidth <= 0) {
        return;
      }

      const viewportWidth = viewport.clientWidth;

      // Enough copies to fill the viewport plus one spare that slides in as
      // the first one leaves. A lone item only ever needs two (see above).
      const copies = isSingleItem
        ? 2
        : Math.max(2, Math.ceil(viewportWidth / contentWidth) + 1);

      const distance = isSingleItem
        ? contentWidth + viewportWidth
        : contentWidth;

      // Keep the previous object when nothing changed, so a ResizeObserver
      // callback does not trigger a re-render loop.
      setLayout((previous) =>
        previous.copies === copies &&
        previous.distance === distance &&
        previous.viewportWidth === viewportWidth
          ? previous
          : { copies, distance, viewportWidth }
      );
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(itemsElement);

    return () => {
      observer.disconnect();
    };
  }, [items, isSingleItem]);

  // Duration follows distance, so speed stays at PIXELS_PER_SECOND whatever
  // the content; the floor stops a very short strip from flicking past.
  const durationSeconds = Math.max(
    MINIMUM_DURATION_SECONDS,
    Math.round(layout.distance / PIXELS_PER_SECOND)
  );

  return (
    <div ref={viewportRef} className="relative min-w-0 flex-1 overflow-hidden">
      <div
        className="celebration-marquee flex w-max items-center"
        style={
          {
            // Read by the celebration-scroll keyframes in index.css.
            "--marquee-distance": `${layout.distance}px`,
            "--marquee-duration": `${durationSeconds}s`,
          } as React.CSSProperties
        }
      >
        {Array.from({ length: layout.copies }, (_, copyIndex) => (
          <div
            key={copyIndex}
            className="flex shrink-0 items-center"
            // Screen readers hear the items once; the repeats are decoration.
            aria-hidden={copyIndex !== 0}
          >
            {/* Only the first copy is measured; every copy is the same width. */}
            <div
              ref={copyIndex === 0 ? itemsRef : undefined}
              className="flex shrink-0 items-center"
            >
              {items.map((item) => (
                <TickerEntry
                  key={item.key}
                  item={item}
                  focusable={copyIndex === 0}
                  onSelectAnnouncement={onSelectAnnouncement}
                />
              ))}
            </div>

            {/* Keeps a lone item from showing up twice at once: the gap is a
                full viewport wide, so the next copy only enters once this
                one has scrolled out of sight. */}
            {isSingleItem && (
              <div
                aria-hidden="true"
                className="h-px shrink-0"
                style={{ width: layout.viewportWidth }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Fades, matched to the banner gradient */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#26377c] to-transparent" />

      <div className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-[#4331a5] to-transparent" />
    </div>
  );
}

interface DashboardTickerProps {
  // Optional with defaults: a missing prop here would otherwise throw during
  // render and take down every admin page, not just this banner.
  celebrations?: Celebration[];
  announcements?: Announcement[];
  /** Where a click on an announcement goes. */
  onSelectAnnouncement?: () => void;
}

/**
 * One banner for the admin dashboard: today's birthdays and anniversaries
 * followed by the latest announcements. When there is neither, it carries a
 * thought of the day so it never sits empty.
 */
function DashboardTicker({
  celebrations = [],
  announcements = [],
  onSelectAnnouncement,
}: DashboardTickerProps) {
  const hasCelebrations = celebrations.length > 0;
  const hasAnnouncements = announcements.length > 0;

  // Celebrations lead, then announcements in the order the feed returns them.
  const items: TickerItem[] = [
    ...celebrations.map(
      (celebration): TickerItem => ({
        kind: "celebration",
        key: `celebration-${celebration.employee_id}-${celebration.type}`,
        icon: ICONS[celebration.type] ?? "\u{1F389}",
        label: celebration.name,
        message: celebration.message,
      })
    ),
    ...announcements.map(
      (announcement, index): TickerItem => ({
        kind: "announcement",
        key: `announcement-${announcement.id ?? index}`,
        title: announcement.title,
        priority: announcement.priority || "Normal",
        category: announcement.category,
      })
    ),
  ];

  if (items.length === 0) {
    items.push({
      kind: "thought",
      key: "thought-of-the-day",
      message: getThoughtForDate(),
    });
  }

  // The fixed label on the left describes whatever mix is scrolling past.
  const heading =
    hasCelebrations && hasAnnouncements
      ? { icon: "\u{1F389}", title: "Today's Highlights", subtitle: "Celebrations & announcements" }
      : hasCelebrations
        ? { icon: "\u{1F389}", title: "Celebrations", subtitle: "Birthdays & Anniversaries" }
        : hasAnnouncements
          ? { icon: ANNOUNCEMENT_ICON, title: "Announcements", subtitle: "Latest updates" }
          : { icon: THOUGHT_ICON, title: "Thought of the Day", subtitle: "Something to take to work" };

  return (
    <section
      className="relative overflow-hidden rounded-[2px] border border-white/10 bg-gradient-to-r from-[#0d1b3d] via-[#1e3a8a] to-[#4331a5] shadow-xl shadow-blue-900/25"
      aria-label="Celebrations and announcements"
    >
      {/* Drifting aurora glows */}
      <div
        aria-hidden="true"
        className="ticker-glow-1 pointer-events-none absolute -top-20 left-[15%] h-40 w-40 rounded-full bg-sky-400/30 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="ticker-glow-2 pointer-events-none absolute -bottom-24 right-[20%] h-44 w-44 rounded-full bg-fuchsia-400/25 blur-3xl"
      />

      {/* Gloss sweep */}
      <div
        aria-hidden="true"
        className="ticker-shine pointer-events-none absolute inset-y-0 left-0 z-20 w-28 bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />

      <div className="relative flex h-[76px] items-center">
        {/* Fixed label block */}
        <div className="relative z-10 flex h-full min-w-[220px] items-center gap-3 border-r border-white/15 bg-white/5 py-4 pl-5 pr-6 backdrop-blur">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ring-2 ring-white/25 ${
              hasCelebrations
                ? "bg-gradient-to-br from-rose-400 to-pink-500 shadow-lg shadow-rose-500/40"
                : "bg-gradient-to-br from-amber-300 to-orange-500 shadow-lg shadow-orange-500/40"
            }`}
          >
            {heading.icon}
          </span>

          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold tracking-wide text-white">
              {heading.title}
            </h3>

            <p className="mt-0.5 truncate text-xs text-blue-200/80">
              {heading.subtitle}
            </p>
          </div>
        </div>

        <Marquee items={items} onSelectAnnouncement={onSelectAnnouncement} />
      </div>
    </section>
  );
}

export default DashboardTicker;
