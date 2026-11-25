import { useEffect, useRef } from "react";
import { Package, X } from "lucide-react";

import { ASSET_CATEGORY_ICONS } from "./assetData";
import { ASSET_STATUS_LABELS } from "./types";
import type { Asset, AssetStatus } from "./types";

interface AssetDetailModalProps {
  asset: Asset;
  onClose: () => void;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;

  const [year, month, day] = value.split("T")[0].split("-").map(Number);

  if (!year || !month || !day || !MONTHS[month - 1]) return null;

  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`;
}

function formatMoney(value: number | null | undefined): string | null {
  if (value == null) return null;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getWarrantyStatus(
  dateStr: string | null | undefined,
): { label: string; className: string } | null {
  if (!dateStr) return null;

  const parts = dateStr.split("T")[0].split("-").map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return null;
  }

  const expiryDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = expiryDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: "Expired",
      className: "bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4]",
    };
  }
  if (diffDays <= 60) {
    return {
      label: "Expiring soon",
      className: "bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]",
    };
  }
  return {
    label: "Active",
    className: "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]",
  };
}

const statusStyles: Record<AssetStatus, { pill: string; dot: string }> = {
  available: {
    pill: "bg-[#E8EEFB] text-[#2F5FD0]",
    dot: "bg-[#2F5FD0]",
  },
  in_use: {
    pill: "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]",
    dot: "bg-[#03543F]",
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

interface RowProps {
  label: string;
  value: React.ReactNode;
}

function Row({ label, value }: RowProps) {
  const isEmpty = value == null || value === "" || value === "-";

  return (
    <div className="flex flex-col justify-center py-2 md:py-0 md:min-h-[42px] md:flex-row md:items-center border-b border-[#E5E7EB] last:border-0 text-left">
      <span className="text-[12px] font-normal text-[#6B7280] md:w-[180px] md:shrink-0 md:text-[13px]">
        {label}
      </span>
      <div className="mt-0.5 md:mt-0 min-w-0 flex-1 text-left text-[13px] font-medium text-[#111827] break-words">
        {isEmpty ? <span className="text-[#7B8794]">—</span> : value}
      </div>
    </div>
  );
}

/**
 * Full record for one asset.
 *
 * Split into a light neutral summary panel and a detail panel.
 */
export default function AssetDetailModal({ asset, onClose }: AssetDetailModalProps) {
  const Icon = ASSET_CATEGORY_ICONS[asset.category] ?? Package;
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const warrantyStatus = getWarrantyStatus(asset.warranty_expiry);
  const formattedWarrantyDate = formatDate(asset.warranty_expiry);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-detail-title"
        className="flex max-h-[calc(100vh-48px)] w-full max-w-[720px] mx-4 flex-col overflow-hidden rounded border border-[#E5E7EB] bg-white shadow-[0_12px_32px_rgba(16,24,40,0.18)] md:flex-row"
      >
        {/* Left summary panel */}
        <aside className="flex shrink-0 flex-col bg-[#F9FAFB] border-b md:border-b-0 md:border-r border-[#E5E7EB] p-5 md:p-6 md:w-[240px]">
          <div className="flex items-center gap-3.5 md:block">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[#E8EEFB] text-[#2F5FD0]">
              <Icon className="h-5 w-5 shrink-0" />
            </span>

            <div className="min-w-0 flex-1 md:mt-4">
              <h2 className="text-[16px] font-semibold text-[#111827] truncate leading-tight">
                {asset.name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 md:block">
                <p className="text-[13px] text-[#6B7280]">{asset.asset_tag}</p>
                <span className="inline-block md:hidden text-[#E5E7EB]">•</span>
                <div className="md:mt-3">
                  <span
                    className={`inline-flex items-center gap-1.5 h-[22px] whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium ${statusStyles[asset.status].pill}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusStyles[asset.status].dot}`} />
                    <span>{ASSET_STATUS_LABELS[asset.status]}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E5E7EB] grid grid-cols-2 gap-4 md:block md:mt-6 md:pt-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Assigned To
              </p>
              <p
                className="mt-1 truncate text-[13px] font-medium text-[#111827]"
                title={asset.assigned_to_name ?? "Unassigned"}
              >
                {asset.assigned_to_name ?? "Unassigned"}
              </p>
              {asset.department_name && (
                <p className="mt-0.5 truncate text-[12px] text-[#6B7280]" title={asset.department_name}>
                  {asset.department_name}
                </p>
              )}
            </div>

            <div className="md:mt-4 md:border-t md:border-[#E5E7EB] md:pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Issue Date
              </p>
              <p className="mt-1 text-[13px] font-medium text-[#111827] tabular-nums">
                {formatDate(asset.issue_date) ?? <span className="text-[#7B8794]">—</span>}
              </p>
            </div>
          </div>
        </aside>

        {/* Right detail panel */}
        <div className="flex min-w-0 flex-1 flex-col bg-white">
          <div className="flex h-[56px] shrink-0 items-center justify-between border-b border-[#E5E7EB] px-6">
            <h1 id="asset-detail-title" className="text-[16px] font-semibold text-[#111827]">
              Asset details
            </h1>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded text-[#6B7280] transition-colors hover:bg-[#F0F1EE] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              General
            </p>
            <div>
              <Row label="Category" value={asset.category} />
              <Row label="Brand / Model" value={asset.brand_model} />
              <Row label="Serial Number" value={asset.serial_number} />
              <Row label="Assigned To" value={asset.assigned_to_name ?? "Unassigned"} />
              <Row label="Department" value={asset.department_name} />
              <Row label="Issue Date" value={formatDate(asset.issue_date)} />
              <Row label="Returned On" value={formatDate(asset.returned_at)} />
            </div>

            <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              Procurement
            </p>
            <div>
              <Row label="Purchase Date" value={formatDate(asset.purchase_date)} />
              <Row label="Purchase Cost" value={formatMoney(asset.purchase_cost)} />
              <Row label="Vendor" value={asset.vendor} />
              <Row
                label="Warranty Expiry"
                value={
                  formattedWarrantyDate ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{formattedWarrantyDate}</span>
                      {warrantyStatus && (
                        <span
                          className={`inline-flex items-center h-5 px-2 text-[11px] font-medium rounded-full ${warrantyStatus.className}`}
                        >
                          {warrantyStatus.label}
                        </span>
                      )}
                    </div>
                  ) : null
                }
              />
            </div>

            {asset.notes && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                  Notes
                </p>
                <div className="rounded bg-[#F9FAFB] border border-[#E5E7EB] p-3 text-[13px] leading-relaxed text-[#4B5563]">
                  {asset.notes}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
