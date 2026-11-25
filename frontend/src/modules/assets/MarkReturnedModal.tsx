import { useRef, useState } from "react";
import { PackageCheck, X } from "lucide-react";

import Button from "../../components/ui/Button";
import { useAssetDialogA11y } from "./assetData";
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
  const modalRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useAssetDialogA11y(modalRef, onClose, isSubmitting);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-mark-returned-title"
        className="w-full max-w-md overflow-hidden rounded border border-[#E5E7EB] bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#DEF7EC] text-[#03543F]">
              <PackageCheck className="h-4 w-4" />
            </span>
            <div>
              <h2 id="asset-mark-returned-title" className="text-[16px] font-semibold text-[#111827]">
                Mark as Returned
              </h2>
              <p className="mt-0.5 text-xs text-[#4B5563]">
                Confirm you have physically received the asset.
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
          <dl className="rounded border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
            <div className="flex items-start gap-3 py-1">
              <dt className="w-[100px] shrink-0 text-xs font-medium text-[#6B7280]">Asset</dt>
              <dd className="min-w-0 flex-1 break-words text-left text-[13px] font-medium text-[#111827]">
                {request.asset_tag ?? "-"} - {request.asset_name}
              </dd>
            </div>
            <div className="flex items-start gap-3 py-1">
              <dt className="w-[100px] shrink-0 text-xs font-medium text-[#6B7280]">Returning</dt>
              <dd className="min-w-0 flex-1 break-words text-left text-[13px] font-medium text-[#111827]">
                {request.employee_name}
              </dd>
            </div>
            <div className="flex items-start gap-3 py-1">
              <dt className="w-[100px] shrink-0 text-xs font-medium text-[#6B7280]">Request</dt>
              <dd className="min-w-0 flex-1 break-words text-left text-[13px] font-medium text-[#111827] tabular-nums">
                {request.request_tag}
              </dd>
            </div>
          </dl>

          {request.reason && (
            <p className="mt-4 rounded border border-[#E5E7EB] bg-white px-4 py-3 text-xs leading-5 text-[#4B5563]">
              <span className="font-semibold text-[#111827]">Reason: </span>
              {request.reason}
            </p>
          )}

          <div className="mt-4 rounded border border-[#FCD34D] bg-[#FEF3C7] px-4 py-3">
            <p className="text-xs leading-5 text-[#92400E]">
              This releases the asset from{" "}
              <strong>{request.employee_name}</strong> and sets it back to{" "}
              <strong>Available</strong>. The request moves from Pending to Approved and
              cannot be reopened.
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded border border-[#F8B4B4] bg-[#FDE8E8] px-4 py-3 text-xs text-[#9B1C1C]">
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
            variant="primary"
            size="sm"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
            isLoading={isSubmitting}
            leftIcon={<PackageCheck className="h-3.5 w-3.5 shrink-0" />}
            className="h-8 px-3.5 rounded text-[12px] font-medium shadow-none"
          >
            Confirm Return
          </Button>
        </div>
      </div>
    </div>
  );
}