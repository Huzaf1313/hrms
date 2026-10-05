import type { CSSProperties } from "react";
import { ArrowRight, Clock } from "lucide-react";

interface HROperationsPromoCardProps {
  onNavigate?: (page: string) => void;
}

export default function HROperationsPromoCard({
  onNavigate,
}: HROperationsPromoCardProps) {
  return (
    <div
      className="dashboard-rise col-span-12 flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#e0e7ff] via-[#eef2ff] to-[#dbeafe] p-5"
      style={{ "--dashboard-delay": "120ms" } as CSSProperties}
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-[#2563eb] shadow-sm">
            <Clock className="h-4 w-4" />
          </span>

          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#4338ca]">
            Dashboard
          </span>
        </div>

        <h2 className="mt-3 text-[15px] font-bold text-gray-900">
          Stay on top of your HR operations
        </h2>

        <p className="mt-1.5 text-[11px] leading-relaxed text-[#52607a]">
          Manage employees, attendance, leave, payroll and more — all in one
          place.
        </p>
      </div>

      <button
        type="button"
        onClick={onNavigate ? () => onNavigate("Employees") : undefined}
        className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-2 text-[11px] font-semibold text-white transition hover:bg-[#1d4ed8]"
      >
        View Reports <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}