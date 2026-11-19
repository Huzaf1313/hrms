import { useEffect, useState } from "react";
import { Building2, User, X } from "lucide-react";

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

const statusStyles: Record<Asset["status"], string> = {
  in_use: "bg-emerald-50 text-emerald-600",
  available: "bg-blue-50 text-blue-600",
  pending_return: "bg-orange-50 text-orange-500",
  maintenance: "bg-violet-50 text-violet-600",
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <Icon className="h-5 w-5 text-[#2563eb]" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-slate-900">{row.name}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {row.id}
                {view === "employee" && row.department ? ` - ${row.department}` : ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50/60 px-6 py-3 text-sm">
          <span className="text-slate-500">
            <span className="font-bold text-slate-900">{assets.length}</span> asset
            {assets.length === 1 ? "" : "s"} allocated
          </span>

          {view === "department" && (
            <span className="text-slate-500">
              <span className="font-bold text-slate-900">{row.employees}</span> employee
              {row.employees === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <p className="py-10 text-center text-sm text-slate-400">Loading...</p>
          )}

          {error && <p className="py-10 text-center text-sm text-rose-500">{error}</p>}

          {!loading && !error && assets.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">
              No assets are allocated to {row.name}.
            </p>
          )}

          {!loading && !error && assets.length > 0 && (
            <table className="w-full table-fixed text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th className="w-[22%] px-2 py-2">Asset ID</th>
                  <th className="w-[32%] px-2 py-2">Asset Name</th>
                  <th className="hidden px-2 py-2 sm:table-cell">Category</th>
                  <th className="w-[18%] px-2 py-2 text-right">Issue Date</th>
                  <th className="w-[18%] rounded-r-xl px-2 py-2 text-right">Status</th>
                </tr>
              </thead>

              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-2 py-3 font-semibold text-[#2563eb]">
                      {asset.asset_tag}
                    </td>
                    <td className="truncate px-2 py-3 font-semibold text-slate-900">
                      {asset.name}
                    </td>
                    <td className="hidden truncate px-2 py-3 text-slate-600 sm:table-cell">
                      {asset.category}
                    </td>
                    <td className="px-2 py-3 text-right text-slate-600">
                      {formatDate(asset.issue_date)}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusStyles[asset.status]}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                        {ASSET_STATUS_LABELS[asset.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50/50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}