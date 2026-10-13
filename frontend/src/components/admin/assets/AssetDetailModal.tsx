import { Package, X } from "lucide-react";

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
  in_use: "bg-emerald-50 text-emerald-700",
  available: "bg-blue-50 text-blue-700",
  pending_return: "bg-orange-50 text-orange-700",
  maintenance: "bg-violet-50 text-violet-700",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <span className="shrink-0 text-sm font-bold text-slate-900">{label}</span>
      <span className="min-w-0 break-words text-right text-sm text-slate-400">{value}</span>
    </div>
  );
}

export default function AssetDetailModal({ asset, onClose }: AssetDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <Package className="h-5 w-5 text-[#2563eb]" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{asset.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{asset.asset_tag}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <div className="mb-4">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusStyles[asset.status]}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
              {ASSET_STATUS_LABELS[asset.status]}
            </span>
          </div>

          <div>
            <Row label="Category" value={asset.category} />
            <Row label="Brand / Model" value={asset.brand_model ?? "-"} />
            <Row label="Serial Number" value={asset.serial_number ?? "-"} />
            <Row
              label="Assigned To"
              value={asset.assigned_to_name ?? "Not assigned"}
            />
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
  );
}