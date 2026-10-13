import { useState } from "react";
import { Trash2, X } from "lucide-react";

import { assetService } from "../../../services/assetService";
import type { Asset } from "../../../types/asset";

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
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
              <Trash2 className="h-5 w-5 text-rose-600" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Delete Asset</h2>
              <p className="mt-1 text-sm text-slate-500">
                This permanently removes the record.
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

        <div className="px-6 py-6">
          <dl className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-start justify-between gap-4 py-1">
              <dt className="shrink-0 text-sm font-semibold text-slate-500">Asset</dt>
              <dd className="min-w-0 break-words text-right text-sm font-bold text-slate-900">
                {asset.asset_tag}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 py-1">
              <dt className="shrink-0 text-sm font-semibold text-slate-500">Name</dt>
              <dd className="min-w-0 break-words text-right text-sm font-bold text-slate-900">
                {asset.name}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 py-1">
              <dt className="shrink-0 text-sm font-semibold text-slate-500">Category</dt>
              <dd className="min-w-0 break-words text-right text-sm font-bold text-slate-900">
                {asset.category}
              </dd>
            </div>
          </dl>

          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
            <p className="text-xs leading-5 text-red-700">
              The asset record and its purchase details will be deleted
              permanently. This cannot be undone.
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
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete Asset
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}