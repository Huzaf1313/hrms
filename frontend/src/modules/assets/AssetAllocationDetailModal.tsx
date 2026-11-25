import { useEffect, useRef, useState } from "react";
import { Building2, PackageOpen, User, X } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { assetService } from "./assetService";
import { ASSET_STATUS_LABELS } from "./types";
import type { AllocationRow, Asset } from "./types";

export interface AllocationDetailTarget {
  view: "employee" | "department";
  row: AllocationRow;
}

interface AssetAllocationDetailModalProps {
  target: AllocationDetailTarget;
  onClose: () => void;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(value: string | null): string {
  if (!value) return "-";

  const [year, month, day] = value.split("T")[0].split("-").map(Number);

  if (!year || !month || !day || !MONTHS[month - 1]) return "-";

  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`;
}

const statusStyles: Record<Asset["status"], { pill: string; dot: string }> = {
  in_use: {
    pill: "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]",
    dot: "bg-[#03543F]",
  },
  available: {
    pill: "bg-[#E8EEFB] text-[#2F5FD0]",
    dot: "bg-[#2F5FD0]",
  },
  pending_return: {
    pill: "bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]",
    dot: "bg-[#92400E]",
  },
  maintenance: {
    pill: "bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]",
    dot: "bg-[#7B8794]",
  },
};

/**
 * Lists the kit behind one row of the allocation table.
 *
 * The employee tab keys off the business code (EMP001) and the department tab
 * off the department id, which are the same keys the allocation counts were
 * grouped by - so the list matches the number in the row it was opened from.
 */
export default function AssetAllocationDetailModal({
  target,
  onClose,
}: AssetAllocationDetailModalProps) {
  const { view, row } = target;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusableElements.length) return;

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            event.preventDefault();
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousActiveElement.current?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await assetService.listAssets({
          [view === "employee" ? "employee_id" : "department_id"]: row.id,
          limit: 100,
        });

        if (active) setAssets(response.items);
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Unable to load assets.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [view, row.id]);

  const Icon = view === "employee" ? User : Building2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="allocation-modal-title"
        className="flex max-h-[calc(100vh-48px)] w-full max-w-[calc(100vw-32px)] sm:max-w-[560px] flex-col overflow-hidden rounded border border-[#E5E7EB] bg-white shadow-[0_12px_32px_rgba(16,24,40,0.18)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 sm:px-5 py-4 sm:py-5">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[#E8EEFB] text-[#2F5FD0]">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2
                id="allocation-modal-title"
                title={row.name}
                className="truncate text-[16px] font-semibold text-[#111827] leading-tight"
              >
                {row.name}
              </h2>
              <p className="mt-0.5 text-[13px] text-[#6B7280] leading-none">
                {view === "department" ? "Department" : "Employee"}
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#6B7280] transition-colors hover:bg-[#F0F1EE] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary strip */}
        <div className="flex items-center border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 sm:px-5 py-3 text-sm">
          {/* Stat 1: Assets allocated */}
          <div className="flex flex-1 items-baseline gap-1.5">
            <span className="text-[16px] font-semibold text-[#111827] tabular-nums">
              {assets.length}
            </span>
            <span className="text-[12px] text-[#6B7280]">
              {assets.length === 1 ? "asset allocated" : "assets allocated"}
            </span>
          </div>

          {view === "department" && (
            <>
              <div className="mx-4 h-5 w-px bg-[#E5E7EB] shrink-0" aria-hidden="true" />

              {/* Stat 2: Employees */}
              <div className="flex flex-1 items-baseline gap-1.5">
                <span className="text-[16px] font-semibold text-[#111827] tabular-nums">
                  {row.employees ?? 0}
                </span>
                <span className="text-[12px] text-[#6B7280]">
                  {row.employees === 1 ? "employee" : "employees"}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Body content */}
        <div className="min-h-0 min-h-[200px] flex-1 overflow-y-auto">
          {loading && (
            <div className="flex min-h-[200px] flex-col items-center justify-center p-6 text-center">
              <p className="text-[13px] text-[#6B7280]">Loading assets...</p>
            </div>
          )}

          {error && (
            <div className="flex min-h-[200px] flex-col items-center justify-center p-6 text-center">
              <p className="text-[13px] text-[#9B1C1C]">{error}</p>
            </div>
          )}

          {!loading && !error && assets.length === 0 && (
            <div className="flex min-h-[200px] flex-col items-center justify-center p-6 text-center">
              <PackageOpen className="h-6 w-6 text-[#7B8794] stroke-[1.5] mb-2" />
              <p className="max-w-[360px] text-[13px] text-[#6B7280] leading-normal">
                No assets are allocated to {row.name}.
              </p>
            </div>
          )}

          {!loading && !error && assets.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] table-fixed text-left text-[12px]">
                <thead>
                  <tr className="h-10 border-b border-[#E5E7EB] bg-[#F9FAFB] text-[11px] font-semibold uppercase tracking-wider text-[#4B5563]">
                    <th scope="col" className="w-[110px] pl-4 sm:pl-5 pr-3 py-0 bg-[#F9FAFB] align-middle whitespace-nowrap">Asset ID</th>
                    <th scope="col" className="px-3 py-0 bg-[#F9FAFB] align-middle whitespace-nowrap">Asset Name</th>
                    <th scope="col" className="w-[110px] px-3 py-0 bg-[#F9FAFB] align-middle whitespace-nowrap hidden sm:table-cell">Category</th>
                    <th scope="col" className="w-[110px] px-3 py-0 bg-[#F9FAFB] align-middle whitespace-nowrap text-right">Issue Date</th>
                    <th scope="col" className="w-[125px] pl-3 pr-4 sm:pr-5 py-0 bg-[#F9FAFB] align-middle whitespace-nowrap text-right">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E5E7EB] bg-white">
                  {assets.map((asset) => {
                    const tone = statusStyles[asset.status] ?? statusStyles.maintenance;
                    return (
                      <tr
                        key={asset.id}
                        className="h-12 hover:bg-[#F9FAFB] transition-colors"
                      >
                        <td className="pl-4 sm:pl-5 pr-3 py-2 font-medium text-[#2F5FD0] whitespace-nowrap text-[12px] tabular-nums">
                          {asset.asset_tag}
                        </td>
                        <td className="px-3 py-2 font-medium text-[#111827] truncate text-[12px]" title={asset.name}>
                          {asset.name}
                        </td>
                        <td className="px-3 py-2 text-[#4B5563] truncate hidden sm:table-cell text-[12px]" title={asset.category}>
                          {asset.category}
                        </td>
                        <td className="px-3 py-2 text-right text-[#111827] whitespace-nowrap tabular-nums text-[12px]">
                          {formatDate(asset.issue_date)}
                        </td>
                        <td className="pl-3 pr-4 sm:pr-5 py-2 text-right whitespace-nowrap">
                          <span
                            className={`inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium ${tone.pill}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${tone.dot}`} />
                            <span>{ASSET_STATUS_LABELS[asset.status] ?? asset.status}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[#E5E7EB] bg-[#F9FAFB] px-4 sm:px-5 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 px-3.5 text-[12px] font-medium rounded shadow-none"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
