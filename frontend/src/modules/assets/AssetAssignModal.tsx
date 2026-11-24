import { useEffect, useMemo, useState } from "react";
import { UserPlus, X } from "lucide-react";

import { assetService } from "./assetService";
import { employeeService } from "../employees/employeeService";
import type { Asset } from "./types";

interface AssetAssignModalProps {
  /** Set when launched from a row menu: the asset is already known. */
  assetId?: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}

const FIELD_CLASS =
  "h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-700 " +
  "outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 " +
  "focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const LABEL_CLASS = "mb-2 block text-sm font-semibold text-slate-700";

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

  // Employees are loaded once and filtered in memory: the picker only ever
  // shows a short list, and re-fetching on every keystroke would be wasteful.
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded bg-emerald-50">
              <UserPlus className="h-5 w-5 text-emerald-600" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Allocate Asset</h2>
              <p className="mt-1 text-sm text-slate-500">
                Hand an asset over to an employee.
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
            {!assetId && (
              <div className="mb-5">
                <label htmlFor="assign-asset" className={LABEL_CLASS}>
                  Available Asset <span className="ml-1 text-red-500">*</span>
                </label>
                <select
                  id="assign-asset"
                  value={selectedAssetId}
                  disabled={isSubmitting || loading}
                  onChange={(event) => setSelectedAssetId(event.target.value)}
                  className={FIELD_CLASS}
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

            <div className="mb-5">
              <label htmlFor="assign-employee-search" className={LABEL_CLASS}>
                Employee <span className="ml-1 text-red-500">*</span>
              </label>

              <input
                id="assign-employee-search"
                type="text"
                value={employeeQuery}
                disabled={isSubmitting || loading}
                onChange={(event) => setEmployeeQuery(event.target.value)}
                placeholder="Search by name or employee ID..."
                className={FIELD_CLASS}
              />

              <div className="mt-2 max-h-56 overflow-y-auto rounded border border-slate-200">
                {loading ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">Loading employees...</p>
                ) : filteredEmployees.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">
                    No employees match your search.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {filteredEmployees.map((employee) => {
                      const isSelected = selectedEmployeeId === employee.employee_id;

                      return (
                        <li key={employee.employee_id}>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setSelectedEmployeeId(employee.employee_id)}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                              isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                            }`}
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                isSelected
                                  ? "bg-[#2563eb] text-white"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {employee.first_name.charAt(0)}
                              {employee.last_name.charAt(0)}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-slate-800">
                                {employee.first_name} {employee.last_name}
                              </span>
                              <span className="block text-[11px] text-slate-400">
                                {employee.employee_id}
                              </span>
                            </span>

                            {isSelected && (
                              <span className="shrink-0 text-[11px] font-semibold text-[#2563eb]">
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
              <label htmlFor="assign-issue-date" className={LABEL_CLASS}>
                Issue Date
              </label>
              <input
                id="assign-issue-date"
                type="date"
                value={issueDate}
                disabled={isSubmitting}
                onChange={(event) => setIssueDate(event.target.value)}
                className={FIELD_CLASS}
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Leave blank to use today's date.
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
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded bg-[#2563eb] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Allocating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Allocate
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}