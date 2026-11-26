import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

import type { ExitStatus } from "./types";

/** The four-stage lifecycle every exit moves through, per the design. */
const FLOW_STAGES = [
  {
    title: "Submit Request",
    description: "Employee initiates exit request with required details",
  },
  {
    title: "HR Review",
    description: "HR reviews and verifies the request",
  },
  {
    title: "Clearance",
    description: "Collects approvals, documents and handovers",
  },
  {
    title: "Final Settlement",
    description: "Payroll processes final settlement and closes the exit",
  },
];

function getActiveStepIndex(status: ExitStatus | null | undefined): number | null {
  if (!status) return null;
  if (status === "Pending") return 1;
  if (status === "In Progress") return 2;
  if (status === "Completed") return 3;
  return 1;
}

function StepTooltip({
  anchorEl,
  text,
}: {
  anchorEl: HTMLElement | null;
  text: string;
}) {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchorEl) return;

    const update = () => {
      const rect = anchorEl.getBoundingClientRect();
      const tipWidth = tooltipRef.current?.offsetWidth ?? 220;
      const padding = 12;
      const rawLeft = rect.left + rect.width / 2 - tipWidth / 2;
      const clampedLeft = Math.max(
        padding,
        Math.min(rawLeft, window.innerWidth - tipWidth - padding),
      );

      setCoords({
        top: rect.bottom + 8,
        left: clampedLeft,
      });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [anchorEl]);

  if (!anchorEl) return null;

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        position: "fixed",
        top: coords ? `${coords.top}px` : "-9999px",
        left: coords ? `${coords.left}px` : "-9999px",
      }}
      className="z-50 max-w-[240px] rounded-md bg-slate-900 px-3 py-2 text-[13px] leading-snug text-white shadow-lg pointer-events-none"
    >
      {text}
    </div>,
    document.body,
  );
}

export function ExitProcessFlow({
  status = null,
}: {
  status?: ExitStatus | null;
}) {
  const activeIdx = getActiveStepIndex(status);
  const [hovered, setHovered] = useState<{
    index: number;
    el: HTMLElement;
  } | null>(null);

  const hideTooltip = useCallback(() => setHovered(null), []);

  return (
    <div className="flex justify-center w-full">
      <div className="w-fit max-w-full rounded-xl border border-[#E5E7EB] bg-white px-6 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-x-auto scrollbar-hidden">
        <ol className="flex items-center gap-3 whitespace-nowrap">
          {FLOW_STAGES.map((stage, index) => {
            const isCompleted =
              activeIdx !== null &&
              (index < activeIdx || (status === "Completed" && index === activeIdx));
            const isActive =
              activeIdx !== null && index === activeIdx && status !== "Completed";
            const isNeutral = activeIdx === null;

            const circleClass = isCompleted
              ? "bg-[#2F5FD0] border-[#2F5FD0] text-white"
              : isActive
                ? "bg-[#2F5FD0] border-[#2F5FD0] text-white"
                : isNeutral
                  ? "bg-[#EFF6FF] border-[#DBEAFE] text-[#2F5FD0]"
                  : "bg-white border-slate-300 text-slate-400";

            return (
              <li key={stage.title} className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onMouseEnter={(e) => setHovered({ index, el: e.currentTarget })}
                  onMouseLeave={hideTooltip}
                  onFocus={(e) => setHovered({ index, el: e.currentTarget })}
                  onBlur={hideTooltip}
                  className="flex items-center gap-2.5 rounded-md py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] cursor-default"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors ${circleClass}`}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="text-sm font-medium text-slate-700">
                    {stage.title}
                  </span>
                </button>

                {index < FLOW_STAGES.length - 1 && (
                  <span
                    className="flex-1 min-w-[40px] md:min-w-[56px] h-px bg-slate-300"
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {hovered && (
        <StepTooltip
          anchorEl={hovered.el}
          text={FLOW_STAGES[hovered.index].description}
        />
      )}
    </div>
  );
}