import { useLayoutEffect, useRef, useState } from "react";

import type { Celebration } from "../types/celebration";
import { getThoughtForDate } from "./celebrationThoughts";

const ICONS: Record<Celebration["type"], string> = {
  birthday: "\u{1F382}",
  anniversary: "\u{1F389}",
};

// Movement speed in pixels per second. Keeping this fixed means one quiet
// birthday scrolls at the same rate as a full list of celebrations.
const PIXELS_PER_SECOND = 40;
const MINIMUM_DURATION_SECONDS = 6;

interface TickerItem {
  key: string;
  icon: string;
  /** Employee name. Absent for the daily thought, whose header carries it. */
  label?: string;
  message: string;
  isThought?: boolean;
}

interface MarqueeProps {
  items: TickerItem[];
}

interface MarqueeLayout {
  copies: number;
  distance: number;
  viewportWidth: number;
}

/**
 * Infinite horizontal scroll.
 *
 * The track is translated by exactly one set's measured width, so the next
 * copy always sits where the first one started and the loop has no visible
 * seam.
 *
 * With several items the set is naturally wider than the banner, so repeating
 * it keeps the viewport covered. A lone item - the daily thought - is narrower
 * than the banner, and repeating it outright would show the same thought twice
 * at once. That case gets a full-viewport gap appended instead, so each copy
 * leaves the screen before the next one arrives.
 */
function Marquee({ items }: MarqueeProps) {
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

      const copies = isSingleItem
        ? 2
        : Math.max(2, Math.ceil(viewportWidth / contentWidth) + 1);

      const distance = isSingleItem
        ? contentWidth + viewportWidth
        : contentWidth;

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
            "--marquee-distance": `${layout.distance}px`,
            "--marquee-duration": `${durationSeconds}s`,
          } as React.CSSProperties
        }
      >
        {Array.from({ length: layout.copies }, (_, copyIndex) => (
          <div key={copyIndex} className="flex shrink-0 items-center">
            <div
              ref={copyIndex === 0 ? itemsRef : undefined}
              className="flex shrink-0 items-center"
            >
              {items.map((item) => (
                <div
                  key={item.key}
                  className="flex shrink-0 items-center gap-2.5 whitespace-nowrap px-6 py-1.5"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base ring-2 ${
                      item.isThought
                        ? "bg-gradient-to-br from-amber-300 to-orange-500 text-white shadow-md shadow-orange-500/40 ring-amber-200/40"
                        : "bg-white/15 shadow-inner ring-white/25"
                    }`}
                  >
                    {item.icon}
                  </span>

                  {item.label && (
                    <>
                      <span className="text-sm font-semibold text-white">
                        {item.label}
                      </span>

                      <span className="text-white/30">|</span>
                    </>
                  )}

                  <span
                    className={`rounded-full border border-white/20 bg-white/10 px-4 py-1 text-sm shadow-lg shadow-black/20 backdrop-blur ${
                      item.isThought
                        ? "italic text-white"
                        : "font-medium text-white/90"
                    }`}
                  >
                    {item.isThought && (
                      <span
                        aria-hidden="true"
                        className="mr-1.5 font-serif text-base leading-none text-amber-300"
                      >
                        &ldquo;
                      </span>
                    )}

                    {item.message}

                    {item.isThought && (
                      <span
                        aria-hidden="true"
                        className="ml-1 font-serif text-base leading-none text-amber-300"
                      >
                        &rdquo;
                      </span>
                    )}
                  </span>
                </div>
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

interface CelebrationTickerProps {
  // Optional with a default: a missing prop here would otherwise throw during
  // render and take down every admin page, not just this banner.
  celebrations?: Celebration[];
  announcementTitles?: string[];
}

function CelebrationTicker({
  celebrations = [],
  announcementTitles = [],
}: CelebrationTickerProps) {
  const hasCelebrations = celebrations.length > 0;
  const hasAnnouncements = announcementTitles.length > 0;

  const items: TickerItem[] = [];

  if (hasCelebrations) {
    items.push(
      ...celebrations.map((celebration) => ({
        key: `${celebration.employee_id}-${celebration.type}`,
        icon: ICONS[celebration.type] ?? "\u{1F389}",
        label: celebration.name,
        message: celebration.message,
      })),
    );
  } else {
    items.push({
      key: "thought-of-the-day",
      icon: "\u{1F4A1}",
      message: getThoughtForDate(),
      isThought: true,
    });
  }

  items.push(
    ...announcementTitles.map((title, index) => ({
      key: `announcement-${index}-${title}`,
      icon: "\u{1F4E2}",
      message: title,
    })),
  );

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#0d1b3d] via-[#1e3a8a] to-[#4331a5] shadow-xl shadow-blue-900/25"
      aria-label="Employee celebrations"
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
            {hasCelebrations ? "\u{1F389}" : "\u{1F4A1}"}
          </span>

          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold tracking-wide text-white">
              {hasCelebrations
                ? hasAnnouncements
                  ? "Celebrations & Announcements"
                  : "Celebrations"
                : hasAnnouncements
                  ? "Thoughts & Announcements"
                  : "Thought of the Day"}
            </h3>

            <p className="mt-0.5 truncate text-xs text-blue-200/80">
              {hasCelebrations
                ? hasAnnouncements
                  ? "Birthdays, anniversaries & updates"
                  : "Birthdays & Anniversaries"
                : "Something to take to work"}
            </p>
          </div>
        </div>

        <Marquee items={items} />
      </div>
    </section>
  );
}

export default CelebrationTicker;
