import { useState } from "react";
import { PackageCheck, X } from "lucide-react";

import { assetService } from "./assetService";
import type { AssetRequest } from "./types";

interface MarkReturnedModalProps {
  request: AssetRequest;
  onClose: () => void;
  onConfirmed: (message: string) => Promise<void>;
}

/**
 * Confirmation for releasing an asset.
 *
 * This is the only step that actually takes a device away from an employee, so
 * it asks first and then does both halves of the job in a single request: the
 * asset goes back to available and the return request leaves pending. Doing it
 * as one call is what stops the panel showing a request that still reads
 * "Pending" after the kit has already gone back on the shelf.
 */
export default function MarkReturnedModal({
  request,
  onClose,
  onConfirmed,
}: MarkReturnedModalProps) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleConfirm() {
    if (isSubmitting) return;

    setError("");
    setIsSubmitting(true);

    try {
      await assetService.completeReturn(request.id);

      await onConfirmed(
        `${request.asset_name} returned by ${request.employee_name} and released back to stock.`,
      );
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to confirm the asset return.",
      );
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
      <div className="w-full max-w-md overflow-hidden rounded bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded bg-red-50">
              <PackageCheck className="h-5 w-5 text-red-600" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Mark as Returned</h2>
              <p className="mt-1 text-sm text-slate-500">
                Confirm you have physically received the asset.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-9 w-9 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          <dl className="rounded border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-start justify-between gap-4 py-1">
              <dt className="shrink-0 text-sm font-semibold text-slate-500">Asset</dt>
              <dd className="min-w-0 break-words text-right text-sm font-bold text-slate-900">
                {request.asset_tag ?? "-"} - {request.asset_name}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 py-1">
              <dt className="shrink-0 text-sm font-semibold text-slate-500">Returning</dt>
              <dd className="min-w-0 break-words text-right text-sm font-bold text-slate-900">
                {request.employee_name}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 py-1">
              <dt className="shrink-0 text-sm font-semibold text-slate-500">Request</dt>
              <dd className="min-w-0 break-words text-right text-sm font-bold text-slate-900">
                {request.request_tag}
              </dd>
            </div>
          </dl>

          {request.reason && (
            <p className="mt-4 rounded border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-600">
              <span className="font-semibold text-slate-800">Reason: </span>
              {request.reason}
            </p>
          )}

          <div className="mt-4 rounded border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="text-xs leading-5 text-amber-700">
              This releases the asset from{" "}
              <strong>{request.employee_name}</strong> and sets it back to{" "}
              <strong>Available</strong>. The request moves from Pending to Approved and
              cannot be reopened.
            </p>
          </div>

          {error && (
            <div className="mt-5 rounded border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center rounded border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded bg-red-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Confirming...
              </>
            ) : (
              <>
                <PackageCheck className="h-4 w-4" />
                Confirm Return
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}