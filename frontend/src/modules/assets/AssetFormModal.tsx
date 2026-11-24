import { useState } from "react";
import { Package, X } from "lucide-react";

import { ASSET_CATEGORIES } from "./assetData";
import { assetService } from "./assetService";
import type { Asset, AssetInput } from "./types";

interface AssetFormModalProps {
  /** Null creates a new asset; an asset switches the form into edit mode. */
  asset: Asset | null;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}

const FIELD_CLASS =
  "h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-700 " +
  "outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 " +
  "focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const LABEL_CLASS = "mb-2 block text-sm font-semibold text-slate-700";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded bg-blue-50">
              <Package className="h-5 w-5 text-[#2563eb]" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {isEditing ? "Edit Asset" : "Add Asset"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
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
            className="flex h-9 w-9 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="asset-name" className={LABEL_CLASS}>
                  Asset Name <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  id="asset-name"
                  type="text"
                  value={name}
                  disabled={isSubmitting}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Dell Laptop (15.6&quot;)"
                  className={FIELD_CLASS}
                />
              </div>

              <div>
                <label htmlFor="asset-category" className={LABEL_CLASS}>
                  Category <span className="ml-1 text-red-500">*</span>
                </label>
                <select
                  id="asset-category"
                  value={category}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setCategory(event.target.value as AssetInput["category"])
                  }
                  className={FIELD_CLASS}
                >
                  {ASSET_CATEGORIES.map((entry) => (
                    <option key={entry.label} value={entry.label}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="asset-brand" className={LABEL_CLASS}>
                  Brand / Model
                </label>
                <input
                  id="asset-brand"
                  type="text"
                  value={brandModel}
                  disabled={isSubmitting}
                  onChange={(event) => setBrandModel(event.target.value)}
                  placeholder="e.g. Dell / Inspiron 15"
                  className={FIELD_CLASS}
                />
              </div>

              <div>
                <label htmlFor="asset-serial" className={LABEL_CLASS}>
                  Serial Number
                </label>
                <input
                  id="asset-serial"
                  type="text"
                  value={serialNumber}
                  disabled={isSubmitting}
                  onChange={(event) => setSerialNumber(event.target.value)}
                  placeholder="e.g. SN001234"
                  className={FIELD_CLASS}
                />
              </div>

              <div>
                <label htmlFor="asset-cost" className={LABEL_CLASS}>
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
                  className={FIELD_CLASS}
                />
              </div>

              <div>
                <label htmlFor="asset-purchase-date" className={LABEL_CLASS}>
                  Purchase Date
                </label>
                <input
                  id="asset-purchase-date"
                  type="date"
                  value={purchaseDate}
                  disabled={isSubmitting}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                  className={FIELD_CLASS}
                />
              </div>

              <div>
                <label htmlFor="asset-warranty" className={LABEL_CLASS}>
                  Warranty Expiry
                </label>
                <input
                  id="asset-warranty"
                  type="date"
                  value={warrantyExpiry}
                  disabled={isSubmitting}
                  onChange={(event) => setWarrantyExpiry(event.target.value)}
                  className={FIELD_CLASS}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="asset-vendor" className={LABEL_CLASS}>
                  Vendor
                </label>
                <input
                  id="asset-vendor"
                  type="text"
                  value={vendor}
                  disabled={isSubmitting}
                  onChange={(event) => setVendor(event.target.value)}
                  placeholder="e.g. Amazon Business"
                  className={FIELD_CLASS}
                />
              </div>

              <div className="sm:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="asset-notes" className="text-sm font-semibold text-slate-700">
                    Notes
                  </label>
                  <span className="text-xs text-slate-400">{notes.length}/500</span>
                </div>
                <textarea
                  id="asset-notes"
                  value={notes}
                  maxLength={500}
                  rows={3}
                  disabled={isSubmitting}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Condition, accessories included, anything worth noting..."
                  className="w-full resize-none rounded border border-slate-200 px-3 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>
            </div>

            {error && (
              <div className="rounded border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
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
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded bg-[#2563eb] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Saving...
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Add Asset"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}