import { useEffect, useMemo, useRef, useState } from "react";
import { UserPlus, X } from "lucide-react";

import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import {
  DIALOG_FIELD_CLASS,
  DIALOG_LABEL_CLASS,
  useAssetDialogA11y,
} from "./assetData";
import { assetService } from "./assetService";
import { employeeService } from "../employees/employeeService";
import type { Asset } from "./types";

interface AssetAssignModalProps {
  /** Set when launched from a row menu: the asset is already known. */
  assetId?: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}

export default function AssetAssignModal({
  assetId,
  onClose,
  onSaved,
}: AssetAssignModalProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState(assetId ?? "");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [loading, setLoading] = useState(!assetId);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useRef<HTMLDivElement | null>(null);
  useAssetDialogA11y(modalRef, onClose, isSubmitting);

  const [employees, setEmployees] = useState<
    { employee_id: string; first_name: string; last_name: string }[]
  >([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [availableAssets, employeeList] = await Promise.all([
          assetId
            ? Promise.resolve<Asset[]>([])
            : assetService
                .listAssets({ status: "available", limit: 100 })
                .then((response) => response.items),
          employeeService.listAll(),
        ]);

        if (!active) return;

        setAssets(availableAssets);
        setEmployees(
          employeeList.map((employee) => ({
            employee_id: employee.employee_id,
            first_name: employee.first_name,
            last_name: employee.last_name,
          })),
        );
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Unable to load employees.");
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

  const filteredEmployees = useMemo(() => {
    const query = employeeQuery.trim().toLowerCase();

    if (!query) return employees;

    return employees.filter((employee) => {
      const fullName = `${employee.first_name} ${employee.last_name}`.toLowerCase();

      return fullName.includes(query) || employee.employee_id.toLowerCase().includes(query);
    });
  }, [employees, employeeQuery]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setError("");

    if (!selectedAssetId) {
      setError("Please choose an asset to allocate.");
      return;
    }

    if (!selectedEmployeeId) {
      setError("Please choose the employee who will hold this asset.");
      return;
    }

    setIsSubmitting(true);

    try {
      await assetService.assignAsset(selectedAssetId, selectedEmployeeId, issueDate || undefined);
      await onSaved("Asset allocated successfully");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to allocate the asset.");
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
        aria-labelledby="asset-assign-title"
        className="w-full max-w-lg overflow-hidden rounded-[2px] border border-[#E5E7EB] bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#DEF7EC] text-[#03543F]">
              <UserPlus className="h-4 w-4" />
            </span>
            <div>
              <h2 id="asset-assign-title" className="text-[16px] font-semibold text-[#111827]">Allocate Asset</h2>
              <p className="mt-0.5 text-xs text-[#4B5563]">
                Hand an asset over to an employee.
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
            {!assetId && (
              <div className="mb-4">
                <label htmlFor="assign-asset" className={DIALOG_LABEL_CLASS}>
                  Available Asset <span className="ml-0.5 text-[#9B1C1C]">*</span>
                </label>
                <select
                  id="assign-asset"
                  value={selectedAssetId}
                  disabled={isSubmitting || loading}
                  onChange={(event) => setSelectedAssetId(event.target.value)}
                  className={DIALOG_FIELD_CLASS}
                >
                  <option value="">
                    {loading
                      ? "Loading assets..."
                      : assets.length === 0
                        ? "No available assets"
                        : "Select an asset"}
                  </option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.asset_tag} - {asset.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="assign-employee-search" className={DIALOG_LABEL_CLASS}>
                Employee <span className="ml-0.5 text-[#9B1C1C]">*</span>
              </label>

              <input
                id="assign-employee-search"
                type="text"
                value={employeeQuery}
                disabled={isSubmitting || loading}
                onChange={(event) => setEmployeeQuery(event.target.value)}
                placeholder="Search by name or employee ID..."
                className={DIALOG_FIELD_CLASS}
              />

              <div className="mt-2 max-h-56 overflow-y-auto rounded-[2px] border border-[#E5E7EB]">
                {loading ? (
                  <p className="px-4 py-6 text-center text-xs text-[#6B7280]">Loading employees...</p>
                ) : filteredEmployees.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-[#6B7280]">
                    No employees match your search.
                  </p>
                ) : (
                  <ul className="divide-y divide-[#E5E7EB]">
                    {filteredEmployees.map((employee) => {
                      const isSelected = selectedEmployeeId === employee.employee_id;
                      const fullName = `${employee.first_name} ${employee.last_name}`.trim();

                      return (
                        <li key={employee.employee_id}>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setSelectedEmployeeId(employee.employee_id)}
                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition cursor-pointer ${
                              isSelected ? "bg-[#E8EEFB]" : "hover:bg-[#F9FAFB]"
                            }`}
                          >
                            <Avatar name={fullName || employee.employee_id} className="!w-8 !h-8 text-[11px] shrink-0" />

                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium text-[#111827]">
                                {fullName}
                              </span>
                              <span className="block text-[11px] text-[#6B7280] tabular-nums">
                                {employee.employee_id}
                              </span>
                            </span>

                            {isSelected && (
                              <span className="shrink-0 text-[11px] font-medium text-[#2F5FD0]">
                                Selected
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="assign-issue-date" className={DIALOG_LABEL_CLASS}>
                Issue Date
              </label>
              <input
                id="assign-issue-date"
                type="date"
                value={issueDate}
                disabled={isSubmitting}
                onChange={(event) => setIssueDate(event.target.value)}
                className={DIALOG_FIELD_CLASS}
              />
              <p className="mt-1.5 text-[11px] text-[#6B7280]">
                Leave blank to use today&apos;s date.
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
              leftIcon={<UserPlus className="h-3.5 w-3.5 shrink-0" />}
              className="h-8 px-3.5 rounded text-[12px] font-medium shadow-none"
            >
              Allocate
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}