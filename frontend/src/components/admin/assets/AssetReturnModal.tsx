import { useEffect, useState } from "react";
import { RotateCcw, X } from "lucide-react";

import { assetService } from "../../../services/assetService";
import type { Asset } from "../../../types/asset";

interface AssetReturnModalProps {
  /** Set when launched from a row menu: the asset is already known. */
  assetId?: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}

const FIELD_CLASS =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 " +
  "outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 " +
  "focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const LABEL_CLASS = "mb-2 block text-sm font-semibold text-slate-700";

export default function AssetReturnModal({
  assetId,
  onClose,
  onSaved,
}: AssetReturnModalProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState(assetId ?? "");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        if (assetId) {
          // Launched from a row menu: the asset is already known.
          const asset = await assetService.getAsset(assetId);

          if (active) setAssets([asset]);
        } else {
          // Only assets someone is holding can be sent back.
          const response = await assetService.listAssets({ status: "in_use", limit: 100 });

          if (active) setAssets(response.items);
        }
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
  }, [assetId]);

  const selectedAsset: Asset | null =
    assets.find((asset) => asset.id === selectedAssetId) ?? null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setError("");

    if (!selectedAssetId) {
      setError("Please choose the asset being returned.");
      return;
    }

    if (!selectedAsset?.assigned_to_employee_id) {
      setError("This asset has no holder, so there is nothing to return.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Raising the request flags the asset as pending_return. The asset stays
      // with the employee until an admin confirms receipt on the requests panel.
      await assetService.createRequest({
        request_type: "return",
        asset_id: selectedAssetId,
        employee_id: selectedAsset.assigned_to_employee_id,
        reason: reason.trim() || undefined,
      });

      await onSaved("Return request raised successfully");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to raise the return request.");
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
              <RotateCcw className="h-5 w-5 text-orange-500" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Request Return</h2>
              <p className="mt-1 text-sm text-slate-500">
                Flag an asset as on its way back to the store.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
            {!assetId ? (
              <div className="mb-5">
                <label htmlFor="return-asset" className={LABEL_CLASS}>
                  Asset <span className="ml-1 text-red-500">*</span>
                </label>
                <select
                  id="return-asset"
                  value={selectedAssetId}
                  disabled={isSubmitting || loading}
                  onChange={(event) => setSelectedAssetId(event.target.value)}
                  className={FIELD_CLASS}
                >
                  <option value="">
                    {loading
                      ? "Loading assets..."
                      : assets.length === 0
                        ? "No assets are currently issued"
                        : "Select an asset"}
                  </option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.asset_tag} - {asset.name} ({asset.assigned_to_name})
                    </option>
                  ))}
                </select>
              </div>
            ) : selectedAsset ? (
              <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">
                  {selectedAsset.asset_tag} - {selectedAsset.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Currently held by{" "}
                  <span className="font-semibold text-slate-700">
                    {selectedAsset.assigned_to_name ?? "nobody"}
                  </span>
                </p>
              </div>
            ) : null}

            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="return-reason" className="text-sm font-semibold text-slate-700">
                  Reason
                </label>
                <span className="text-xs text-slate-400">{reason.length}/300</span>
              </div>
              <textarea
                id="return-reason"
                value={reason}
                maxLength={300}
                rows={3}
                disabled={isSubmitting}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Employee resigned, device upgrade..."
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-xs leading-5 text-amber-700">
                This marks the asset as <strong>Pending Return</strong>. The employee keeps
                holding it until an admin confirms the item has physically been received,
                using the Mark Returned action on the requests panel.
              </p>
            </div>

            {error && (
              <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Submitting...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Raise Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}