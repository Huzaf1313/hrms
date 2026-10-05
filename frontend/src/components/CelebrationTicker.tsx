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
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap px-6 py-1.5"
                >
                  <span className="text-xl leading-none">{item.icon}</span>

                  {item.label && (
                    <>
                      <span className="text-sm font-semibold text-[#17375e]">
                        {item.label}
                      </span>

                      <span className="text-[#bfdbfe]">|</span>
                    </>
                  )}

                  <span className="rounded-full border border-[#dbeafe] bg-white/90 px-3 py-1 text-sm text-gray-600 shadow-sm">
                    {item.message}
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
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#eff6ff] to-transparent" />

      <div className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-[#eef2ff] to-transparent" />
    </div>
  );
}

interface CelebrationTickerProps {
  // Optional with a default: a missing prop here would otherwise throw during
  // render and take down every admin page, not just this banner.
  celebrations?: Celebration[];
}

function CelebrationTicker({ celebrations = [] }: CelebrationTickerProps) {
  const hasCelebrations = celebrations.length > 0;

  // On a quiet day the banner carries a thought instead, so it never sits
  // empty and the scroll always has something to move.
  const items: TickerItem[] = hasCelebrations
    ? celebrations.map((celebration) => ({
        key: `${celebration.employee_id}-${celebration.type}`,
        icon: ICONS[celebration.type] ?? "\u{1F389}",
        label: celebration.name,
        message: celebration.message,
      }))
    : [
        {
          key: "thought-of-the-day",
          icon: "\u{1F4AD}",
          message: getThoughtForDate(),
        },
      ];

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[#dbeafe] bg-gradient-to-r from-[#eff6ff] via-white to-[#eef2ff] shadow-sm"
      aria-label="Employee celebrations"
    >
      <div className="flex h-[76px] items-center">
        {/* Fixed label block */}
        <div className="relative z-10 flex h-full min-w-[220px] items-center gap-3 border-r border-[#dbeafe] bg-gradient-to-r from-[#eff6ff] to-[#eff6ff] px-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm">
            {hasCelebrations ? "\u{1F389}" : "\u{1F4AD}"}
          </span>

          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-[#17375e]">
              {hasCelebrations ? "Celebrations" : "Thought of the Day"}
            </h3>

            <p className="mt-0.5 truncate text-xs text-gray-500">
              {hasCelebrations
                ? "Birthdays & Anniversaries"
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