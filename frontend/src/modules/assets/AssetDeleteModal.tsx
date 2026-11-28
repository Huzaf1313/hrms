import { useRef, useState } from "react";
import { Trash2, X } from "lucide-react";

import Button from "../../components/ui/Button";
import { useAssetDialogA11y } from "./assetData";
import { assetService } from "./assetService";
import type { Asset } from "./types";

interface AssetDeleteModalProps {
  asset: Asset;
  onClose: () => void;
  onDeleted: (message: string) => Promise<void>;
}

/**
 * Confirmation for permanently removing an asset record.
 *
 * Delete is only offered for assets nobody is holding, so this dialog does not
 * need to talk about returns. It still reports a failure inline rather than
 * closing, because the API is the authority on whether the delete was allowed.
 */
export default function AssetDeleteModal({
  asset,
  onClose,
  onDeleted,
}: AssetDeleteModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useAssetDialogA11y(modalRef, onClose, isSubmitting);

  async function handleConfirm() {
    if (isSubmitting) return;

    setError("");
    setIsSubmitting(true);

    try {
      await assetService.deleteAsset(asset.id);

      await onDeleted(`${asset.asset_tag} - ${asset.name} deleted.`);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to delete the asset.",
      );
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
        aria-labelledby="asset-delete-title"
        className="w-full max-w-md overflow-hidden rounded-[2px] border border-[#E5E7EB] bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#FDE8E8] text-[#9B1C1C]">
              <Trash2 className="h-4 w-4" />
            </span>
            <div>
              <h2 id="asset-delete-title" className="text-[16px] font-semibold text-[#111827]">
                Delete Asset
              </h2>
              <p className="mt-0.5 text-xs text-[#4B5563]">
                This permanently removes the record.
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

        <div className="px-6 py-5">
          <dl className="rounded-[2px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
            <div className="flex items-start gap-3 py-1">
              <dt className="w-[100px] shrink-0 text-xs font-medium text-[#6B7280]">Asset</dt>
              <dd className="min-w-0 flex-1 break-words text-left text-[13px] font-medium text-[#111827] tabular-nums">
                {asset.asset_tag}
              </dd>
            </div>
            <div className="flex items-start gap-3 py-1">
              <dt className="w-[100px] shrink-0 text-xs font-medium text-[#6B7280]">Name</dt>
              <dd className="min-w-0 flex-1 break-words text-left text-[13px] font-medium text-[#111827]">
                {asset.name}
              </dd>
            </div>
            <div className="flex items-start gap-3 py-1">
              <dt className="w-[100px] shrink-0 text-xs font-medium text-[#6B7280]">Category</dt>
              <dd className="min-w-0 flex-1 break-words text-left text-[13px] font-medium text-[#111827]">
                {asset.category}
              </dd>
            </div>
          </dl>

          <div className="mt-4 rounded-[2px] border border-[#F8B4B4] bg-[#FDE8E8] px-4 py-3">
            <p className="text-xs leading-5 text-[#9B1C1C]">
              The asset record and its purchase details will be deleted
              permanently. This cannot be undone.
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
            variant="outline"
            size="sm"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
            isLoading={isSubmitting}
            leftIcon={<Trash2 className="h-3.5 w-3.5 shrink-0" />}
            className="h-8 px-3.5 rounded text-[12px] font-medium shadow-none border-[#F8B4B4] bg-[#FDE8E8] text-[#9B1C1C] hover:bg-[#FDE8E8]/80 hover:border-[#F8B4B4]"
          >
            Delete Asset
          </Button>
        </div>
      </div>
    </div>
  );
}