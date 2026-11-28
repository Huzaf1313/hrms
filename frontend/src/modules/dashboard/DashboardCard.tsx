import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/** Shared panel styling for every admin dashboard card. */
export const DASHBOARD_CARD_CLASS =
  "flex h-full flex-col rounded-[2px] border border-[#E5E7EB] bg-white p-5 shadow-none";

interface DashboardCardProps {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  /** Grid placement, since the cards sit in a 12-column row. */
  className?: string;
  children: ReactNode;
}

export default function DashboardCard({
  title,
  eyebrow,
  action,
  className = "",
  children,
}: DashboardCardProps) {
  return (
    <div className={`${DASHBOARD_CARD_CLASS} ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-[#111827]">{title}</h2>

          {eyebrow && (
            <p className="mt-0.5 text-[12px] text-[#6B7280]">{eyebrow}</p>
          )}
        </div>

        {action}
      </div>

      {children}
    </div>
  );
}

export function DashboardViewAllLink({
  onClick,
}: {
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#2563eb] hover:underline"
    >
      View All <ArrowRight className="h-3 w-3" />
    </button>
  );
}
