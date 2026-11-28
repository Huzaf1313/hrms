import { useRef, useState } from "react";
import { Package, X } from "lucide-react";

import { Button } from "../../components/ui/Button";
import {
  ASSET_CATEGORIES,
  DIALOG_FIELD_CLASS,
  DIALOG_LABEL_CLASS,
  useAssetDialogA11y,
} from "./assetData";
import { assetService } from "./assetService";
import type { Asset, AssetInput } from "./types";

interface AssetFormModalProps {
  /** Null creates a new asset; an asset switches the form into edit mode. */
  asset: Asset | null;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}

export default function AssetFormModal({
  asset,
  onClose,
  onSaved,
}: AssetFormModalProps) {
  const [name, setName] = useState(asset?.name ?? "");
  const [category, setCategory] = useState(asset?.category ?? "Laptop");
  const [brandModel, setBrandModel] = useState(asset?.brand_model ?? "");
  const [serialNumber, setSerialNumber] = useState(asset?.serial_number ?? "");
  const [purchaseDate, setPurchaseDate] = useState(asset?.purchase_date ?? "");
  const [purchaseCost, setPurchaseCost] = useState(
    asset?.purchase_cost != null ? String(asset.purchase_cost) : "",
  );
  const [vendor, setVendor] = useState(asset?.vendor ?? "");
  const [warrantyExpiry, setWarrantyExpiry] = useState(asset?.warranty_expiry ?? "");
  const [notes, setNotes] = useState(asset?.notes ?? "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useRef<HTMLDivElement | null>(null);
  useAssetDialogA11y(modalRef, onClose, isSubmitting);

  const isEditing = asset !== null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setError("");

    if (name.trim().length < 2) {
      setError("Please enter an asset name of at least 2 characters.");
      return;
    }

    const cost = purchaseCost.trim() === "" ? null : Number(purchaseCost);

    if (cost !== null && (Number.isNaN(cost) || cost < 0)) {
      setError("Purchase cost must be a positive number.");
      return;
    }

    const payload: AssetInput = {
      name: name.trim(),
      category,
      brand_model: brandModel.trim() || undefined,
      serial_number: serialNumber.trim() || undefined,
      purchase_date: purchaseDate || undefined,
      purchase_cost: cost ?? undefined,
      vendor: vendor.trim() || undefined,
      warranty_expiry: warrantyExpiry || undefined,
      notes: notes.trim() || undefined,
    };

    setIsSubmitting(true);

    try {
      if (asset) {
        await assetService.updateAsset(asset.id, payload);
      } else {
        await assetService.createAsset(payload);
      }

      await onSaved(isEditing ? "Asset updated successfully" : "Asset added successfully");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the asset.");
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
        aria-labelledby="asset-form-title"
        className="w-full max-w-2xl overflow-hidden rounded-[2px] border border-[#E5E7EB] bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#E8EEFB] text-[#2F5FD0]">
              <Package className="h-4 w-4" />
            </span>
            <div>
              <h2 id="asset-form-title" className="text-[16px] font-semibold text-[#111827]">
                {isEditing ? "Edit Asset" : "Add Asset"}
              </h2>
              <p className="mt-0.5 text-xs text-[#4B5563]">
                {isEditing
                  ? `Updating ${asset.asset_tag}.`
                  : "Record a new asset in the inventory."}
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
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="asset-name" className={DIALOG_LABEL_CLASS}>
                  Asset Name <span className="ml-0.5 text-[#9B1C1C]">*</span>
                </label>
                <input
                  id="asset-name"
                  type="text"
                  value={name}
                  disabled={isSubmitting}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Dell Laptop (15.6&quot;)"
                  className={DIALOG_FIELD_CLASS}
                />
              </div>

              <div>
                <label htmlFor="asset-category" className={DIALOG_LABEL_CLASS}>
                  Category <span className="ml-0.5 text-[#9B1C1C]">*</span>
                </label>
                <select
                  id="asset-category"
                  value={category}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setCategory(event.target.value as AssetInput["category"])
                  }
                  className={DIALOG_FIELD_CLASS}
                >
                  {ASSET_CATEGORIES.map((entry) => (
                    <option key={entry.label} value={entry.label}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="asset-brand" className={DIALOG_LABEL_CLASS}>
                  Brand / Model
                </label>
                <input
                  id="asset-brand"
                  type="text"
                  value={brandModel}
                  disabled={isSubmitting}
                  onChange={(event) => setBrandModel(event.target.value)}
                  placeholder="e.g. Dell / Inspiron 15"
                  className={DIALOG_FIELD_CLASS}
                />
              </div>

              <div>
                <label htmlFor="asset-serial" className={DIALOG_LABEL_CLASS}>
                  Serial Number
                </label>
                <input
                  id="asset-serial"
                  type="text"
                  value={serialNumber}
                  disabled={isSubmitting}
                  onChange={(event) => setSerialNumber(event.target.value)}
                  placeholder="e.g. SN001234"
                  className={DIALOG_FIELD_CLASS}
                />
              </div>

              <div>
                <label htmlFor="asset-cost" className={DIALOG_LABEL_CLASS}>
                  Purchase Cost
                </label>
                <input
                  id="asset-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchaseCost}
                  disabled={isSubmitting}
                  onChange={(event) => setPurchaseCost(event.target.value)}
                  placeholder="0.00"
                  className={DIALOG_FIELD_CLASS}
                />
              </div>

              <div>
                <label htmlFor="asset-purchase-date" className={DIALOG_LABEL_CLASS}>
                  Purchase Date
                </label>
                <input
                  id="asset-purchase-date"
                  type="date"
                  value={purchaseDate}
                  disabled={isSubmitting}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                  className={DIALOG_FIELD_CLASS}
                />
              </div>

              <div>
                <label htmlFor="asset-warranty" className={DIALOG_LABEL_CLASS}>
                  Warranty Expiry
                </label>
                <input
                  id="asset-warranty"
                  type="date"
                  value={warrantyExpiry}
                  disabled={isSubmitting}
                  onChange={(event) => setWarrantyExpiry(event.target.value)}
                  className={DIALOG_FIELD_CLASS}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="asset-vendor" className={DIALOG_LABEL_CLASS}>
                  Vendor
                </label>
                <input
                  id="asset-vendor"
                  type="text"
                  value={vendor}
                  disabled={isSubmitting}
                  onChange={(event) => setVendor(event.target.value)}
                  placeholder="e.g. Amazon Business"
                  className={DIALOG_FIELD_CLASS}
                />
              </div>

              <div className="sm:col-span-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="asset-notes" className="text-[12px] font-medium text-[#4B5563]">
                    Notes
                  </label>
                  <span className="text-[11px] text-[#6B7280] tabular-nums">{notes.length}/500</span>
                </div>
                <textarea
                  id="asset-notes"
                  value={notes}
                  maxLength={500}
                  rows={3}
                  disabled={isSubmitting}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Condition, accessories included, anything worth noting..."
                  className="w-full resize-none rounded border border-[#E5E7EB] bg-white px-3 py-2.5 text-[13px] text-[#111827] outline-none transition placeholder:text-[#7B8794] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0] disabled:cursor-not-allowed disabled:bg-[#F6F7F5]"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-[2px] border border-[#F8B4B4] bg-[#FDE8E8] px-4 py-3 text-xs text-[#9B1C1C]">
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
              className="h-8 px-3.5 rounded text-[12px] font-medium shadow-none"
            >
              {isEditing ? "Save Changes" : "Add Asset"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}