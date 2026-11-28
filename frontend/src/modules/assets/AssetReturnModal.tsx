import { useEffect, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";

import Button from "../../components/ui/Button";
import { DIALOG_FIELD_CLASS, DIALOG_LABEL_CLASS, useAssetDialogA11y } from "./assetData";
import { assetService } from "./assetService";
import type { Asset } from "./types";

interface AssetReturnModalProps {
  /** Set when launched from a row menu: the asset is already known. */
  assetId?: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}

export default function AssetReturnModal({
  assetId,
  onClose,
  onSaved,
}: AssetReturnModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState(assetId ?? "");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useAssetDialogA11y(modalRef, onClose, isSubmitting);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-return-title"
        className="w-full max-w-lg overflow-hidden rounded-[2px] border border-[#E5E7EB] bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#FEF3C7] text-[#92400E]">
              <RotateCcw className="h-4 w-4" />
            </span>
            <div>
              <h2 id="asset-return-title" className="text-[16px] font-semibold text-[#111827]">
                Request Return
              </h2>
              <p className="mt-0.5 text-xs text-[#4B5563]">
                Flag an asset as on its way back to the store.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-8 w-8 items-center justify-center rounded text-[#6B7280] transition hover:bg-[#F0F1EE] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
            {!assetId ? (
              <div className="mb-4">
                <label htmlFor="return-asset" className={DIALOG_LABEL_CLASS}>
                  Asset <span className="ml-0.5 text-[#9B1C1C]">*</span>
                </label>
                <select
                  id="return-asset"
                  value={selectedAssetId}
                  disabled={isSubmitting || loading}
                  onChange={(event) => setSelectedAssetId(event.target.value)}
                  className={DIALOG_FIELD_CLASS}
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
              <div className="mb-4 rounded-[2px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
                <p className="text-[13px] font-medium text-[#111827]">
                  {selectedAsset.asset_tag} - {selectedAsset.name}
                </p>
                <p className="mt-1 text-xs text-[#6B7280]">
                  Currently held by{" "}
                  <span className="font-medium text-[#4B5563]">
                    {selectedAsset.assigned_to_name ?? "nobody"}
                  </span>
                </p>
              </div>
            ) : null}

            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="return-reason" className="text-[12px] font-medium text-[#4B5563]">
                  Reason
                </label>
                <span className="text-[11px] tabular-nums text-[#6B7280]">{reason.length}/300</span>
              </div>
              <textarea
                id="return-reason"
                value={reason}
                maxLength={300}
                rows={3}
                disabled={isSubmitting}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Employee resigned, device upgrade..."
                className="w-full resize-none rounded border border-[#E5E7EB] bg-white px-3 py-2.5 text-[13px] text-[#111827] outline-none transition placeholder:text-[#7B8794] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0] disabled:cursor-not-allowed disabled:bg-[#F6F7F5]"
              />
            </div>

            <div className="rounded-[2px] border border-[#FCD34D] bg-[#FEF3C7] px-4 py-3">
              <p className="text-xs leading-5 text-[#92400E]">
                This marks the asset as <strong>Pending Return</strong>. The employee keeps
                holding it until an admin confirms the item has physically been received,
                using the Mark Returned action on the requests panel.
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-[2px] border border-[#F8B4B4] bg-[#FDE8E8] px-4 py-3 text-xs text-[#9B1C1C]">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] bg-[#F9FAFB] px-6 py-3.5">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-8 px-3.5 rounded text-[12px] font-medium shadow-none"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              leftIcon={<RotateCcw className="h-3.5 w-3.5 shrink-0" />}
              className="h-8 px-3.5 rounded text-[12px] font-medium shadow-none"
            >
              Raise Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}