import { Package, User, X } from "lucide-react";

import { ASSET_CATEGORY_ICONS } from "../assetData";
import { ASSET_STATUS_LABELS } from "../../../types/asset";
import type { Asset, AssetStatus } from "../../../types/asset";

interface AssetDetailModalProps {
  asset: Asset;
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

function formatMoney(value: number | null): string {
  if (value == null) return "-";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

const statusStyles: Record<AssetStatus, string> = {
  in_use: "bg-emerald-500/15 text-emerald-300",
  available: "bg-blue-500/15 text-blue-300",
  pending_return: "bg-orange-500/15 text-orange-300",
  maintenance: "bg-violet-500/15 text-violet-300",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <span className="shrink-0 text-sm font-bold text-slate-900">{label}</span>
      <span className="min-w-0 break-words text-right text-sm text-slate-400">{value}</span>
    </div>
  );
}

/**
 * Full record for one asset.
 *
 * Split into a dark identity panel and a light detail panel: the left carries
 * what the item *is* (category, tag, holder, status) and stays fixed while the
 * right column scrolls, so the asset is still identifiable part-way down a long
 * procurement history.
 */
export default function AssetDetailModal({ asset, onClose }: AssetDetailModalProps) {
  const Icon = ASSET_CATEGORY_ICONS[asset.category] ?? Package;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:flex-row">
        {/* Identity panel */}
        <aside className="flex shrink-0 flex-col bg-slate-900 px-6 py-6 text-white sm:w-60">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <Icon className="h-6 w-6 text-white" />
          </span>

          <h2 className="mt-4 text-lg font-bold leading-snug">{asset.name}</h2>
          <p className="mt-1 text-sm font-medium text-slate-400">{asset.asset_tag}</p>

          <span
            className={`mt-4 inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${statusStyles[asset.status]}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            {ASSET_STATUS_LABELS[asset.status]}
          </span>

          <p className="mt-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Assigned To
          </p>

          <div className="mt-2 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
              <User className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {asset.assigned_to_name ?? "Unassigned"}
              </p>
              {asset.department_name && (
                <p className="truncate text-xs text-slate-400">{asset.department_name}</p>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Issue Date
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-200">
              {formatDate(asset.issue_date)}
            </p>
          </div>
        </aside>

        {/* Detail panel */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-end border-b border-slate-200 px-6 py-3">
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div>
              <Row label="Category" value={asset.category} />
              <Row label="Brand / Model" value={asset.brand_model ?? "-"} />
              <Row label="Serial Number" value={asset.serial_number ?? "-"} />
              <Row label="Assigned To" value={asset.assigned_to_name ?? "Not assigned"} />
              <Row label="Department" value={asset.department_name ?? "-"} />
              <Row label="Issue Date" value={formatDate(asset.issue_date)} />
              <Row label="Returned On" value={formatDate(asset.returned_at)} />
            </div>

            <p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">
              Procurement
            </p>
            <div>
              <Row label="Purchase Date" value={formatDate(asset.purchase_date)} />
              <Row label="Purchase Cost" value={formatMoney(asset.purchase_cost)} />
              <Row label="Vendor" value={asset.vendor ?? "-"} />
              <Row label="Warranty Expiry" value={formatDate(asset.warranty_expiry)} />
            </div>

            {asset.notes && (
              <>
                <p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">
                  Notes
                </p>
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                  {asset.notes}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}