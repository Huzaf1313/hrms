
import { useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Announcement } from "../../hooks/useEmployeeData";

interface EmployeeAnnouncementTickerProps {
  announcements: Announcement[];
  loading?: boolean;
  error?: string;
  /** Where a click on an announcement goes. Defaults to the employee list;
   *  the admin dashboard points it at the admin announcements page. */
  onSelect?: () => void;
}

const PIXELS_PER_SECOND = 40;
const MINIMUM_DURATION_SECONDS = 6;

function EmployeeAnnouncementTicker({
  announcements,
  loading = false,
  error = "",
  onSelect,
}: EmployeeAnnouncementTickerProps) {
  const navigate = useNavigate();
  const viewportRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);

  const [layout, setLayout] = useState({
    copies: 2,
    distance: 0,
    viewportWidth: 0,
  });

  const hasAnnouncements = announcements.length > 0;

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const itemsElement = itemsRef.current;

    if (!viewport || !itemsElement || !hasAnnouncements) {
      return;
    }

    const measure = () => {
      const contentWidth = itemsElement.getBoundingClientRect().width;

      if (contentWidth <= 0) return;

      const viewportWidth = viewport.clientWidth;

      const copies = Math.max(
        2,
        Math.ceil(viewportWidth / contentWidth) + 1,
      );

      setLayout((previous) =>
        previous.copies === copies &&
        previous.distance === contentWidth &&
        previous.viewportWidth === viewportWidth
          ? previous
          : {
              copies,
              distance: contentWidth,
              viewportWidth,
            },
      );
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(itemsElement);

    return () => observer.disconnect();
  }, [announcements, hasAnnouncements]);

  const durationSeconds = Math.max(
    MINIMUM_DURATION_SECONDS,
    Math.round(layout.distance / PIXELS_PER_SECOND),
  );

  const handleAnnouncementClick = () => {
    if (onSelect) {
      onSelect();
      return;
    }

    navigate("/employee/announcements");
  };

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#0d1b3d] via-[#1e3a8a] to-[#4331a5] shadow-xl shadow-blue-900/25"
      aria-label="Employee announcements"
    >
      <div className="ticker-glow-1 pointer-events-none absolute -top-20 left-[15%] h-40 w-40 rounded-full bg-sky-400/30 blur-3xl" />

      <div className="ticker-glow-2 pointer-events-none absolute -bottom-24 right-[20%] h-44 w-44 rounded-full bg-fuchsia-400/25 blur-3xl" />

      <div className="ticker-shine pointer-events-none absolute inset-y-0 left-0 z-20 w-28 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="relative flex min-h-[76px] items-center">
        <div className="relative z-10 flex min-h-[76px] min-w-[190px] items-center gap-3 border-r border-white/15 bg-white/5 px-5 backdrop-blur">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 text-xl shadow-lg shadow-orange-500/40 ring-2 ring-white/25">
            📢
          </span>

          <div>
            <h3 className="text-sm font-bold tracking-wide text-white">
              Announcements
            </h3>
            <p className="text-xs text-blue-200/80">
              Latest updates
            </p>
          </div>
        </div>

        <div
          ref={viewportRef}
          className="relative min-w-0 flex-1 overflow-hidden"
        >
          {loading ? (
            <p className="px-6 text-sm text-white/80">
              Loading announcements...
            </p>
          ) : error ? (
            <p className="px-6 text-sm text-red-200">
              {error}
            </p>
          ) : !hasAnnouncements ? (
            <p className="px-6 text-sm text-white/80">
              No announcements available for you.
            </p>
          ) : (
            <div
              className="employee-announcement-marquee flex w-max items-center"
              style={
                {
                  "--marquee-distance": `${layout.distance}px`,
                  "--marquee-duration": `${durationSeconds}s`,
                } as React.CSSProperties
              }
            >
              {Array.from({ length: layout.copies }, (_, copyIndex) => (
                <div
                  key={copyIndex}
                  className="flex shrink-0 items-center"
                  aria-hidden={copyIndex !== 0}
                >
                  <div
                    ref={copyIndex === 0 ? itemsRef : undefined}
                    className="flex shrink-0 items-center"
                  >
                    {announcements.map((announcement) => (
                      <button
                        type="button"
                        key={announcement.id ?? announcement.title}
                        onClick={handleAnnouncementClick}
                        className="flex shrink-0 items-center gap-3 whitespace-nowrap px-6 py-3 text-left transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                        tabIndex={copyIndex === 0 ? 0 : -1}
                      >
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${
                            announcement.priority === "Urgent"
                              ? "bg-red-500/25 text-red-200 ring-1 ring-red-300/40"
                              : announcement.priority === "Important"
                                ? "bg-amber-400/25 text-amber-200 ring-1 ring-amber-300/40"
                                : "bg-white/15 text-blue-100 ring-1 ring-white/20"
                          }`}
                        >
                          {announcement.priority || "Normal"}
                        </span>

                        <span className="text-sm font-semibold text-white">
                          {announcement.title}
                        </span>

                        {announcement.category && (
                          <>
                            <span className="text-white/30">|</span>
                            <span className="text-xs text-blue-200">
                              {announcement.category}
                            </span>
                          </>
                        )}

                        <span className="mx-3 text-white/30">•</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default EmployeeAnnouncementTicker;