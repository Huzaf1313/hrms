import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, X } from "lucide-react";
import {
  salaryStructureService,
  type SalaryStructure,
} from "../../services/admin_salary_structure_service";
import { adminDeductionService } from "../../services/admin_deduction_service";
import { ApiError } from "../../services/api";

export interface DeductionComponentSummary {
  id: string;
  name: string;
  type: "Deduction" | "Contribution";
}

interface ApplyDeductionModalProps {
  component: DeductionComponentSummary;
  onClose: () => void;
  onSuccess: (updatedCount: number) => void;
}

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return `₹${Math.round(val).toLocaleString("en-IN")}`;
}

export default function ApplyDeductionModal({
  component,
  onClose,
  onSuccess,
}: ApplyDeductionModalProps) {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    loadStructures();
  }, []);

  async function loadStructures() {
    try {
      setIsLoading(true);
      setLoadError(null);
      const data = await salaryStructureService.list();
      setStructures(data || []);
    } catch (err) {
      console.error(err);
      setLoadError("Unable to load salary structures. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleStructure(id: string) {
    setApplyError(null);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  const allSelected =
    structures.length > 0 && selectedIds.length === structures.length;

  function toggleSelectAll() {
    setApplyError(null);
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(structures.map((s) => s.id));
    }
  }

  async function handleApply() {
    if (selectedIds.length === 0) {
      setApplyError("Please select at least one salary structure.");
      return;
    }

    try {
      setIsApplying(true);
      setApplyError(null);
      const response = await adminDeductionService.apply(
        component.id,
        selectedIds,
      );
      onSuccess(response.updated_structures);
      onClose();
    } catch (err) {
      console.error(err);
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to apply this component to the selected salary structures.";
      setApplyError(message);
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-xs">
      <div className="max-h-[90vh] w-full max-w-2xl flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-[#17375e]">
              Apply to Salary Structures
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Apply <span className="font-medium text-[#17375e]">{component.name}</span> (
              {component.type}) to one or multiple salary structures.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loadError && (
            <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={loadStructures}
                className="font-semibold underline hover:text-rose-900"
              >
                Retry
              </button>
            </div>
          )}

          {applyError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <span>{applyError}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-[#17375e] mb-2" />
              <p className="text-sm">Loading available salary structures...</p>
            </div>
          ) : structures.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center">
              <p className="text-sm font-medium text-gray-700">
                No salary structures found.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Please create a salary structure first before applying deduction components.
              </p>
            </div>
          ) : (
            <>
              {/* Select All Bar */}
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 border border-slate-200/80">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  disabled={isApplying}
                  className="text-xs font-semibold text-[#17375e] hover:underline disabled:opacity-50 cursor-pointer"
                >
                  {allSelected ? "Deselect All" : "Select All"}
                </button>
                <span className="text-xs text-slate-600 font-medium">
                  {selectedIds.length} of {structures.length} selected
                </span>
              </div>

              {/* Salary Structures List */}
              <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1">
                {structures.map((structure) => {
                  const isChecked = selectedIds.includes(structure.id);
                  const isAlreadyAssigned = Boolean(
                    structure.deductions?.some((d) => d.id === component.id),
                  );

                  return (
                    <div
                      key={structure.id}
                      onClick={() => !isApplying && toggleStructure(structure.id)}
                      className={`group flex items-start gap-3.5 rounded-xl border p-4 transition cursor-pointer ${
                        isChecked
                          ? "border-[#17375e] bg-slate-50/70 shadow-xs"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-slate-50/30"
                      } ${isApplying ? "cursor-not-allowed opacity-70" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleStructure(structure.id)}
                        disabled={isApplying}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-[#17375e] focus:ring-[#17375e] cursor-pointer"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-[#17375e] truncate">
                            {structure.name}
                          </h4>
                          {isAlreadyAssigned && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                              <Check className="h-3 w-3 text-slate-500" />
                              Currently included
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span>
                            Range:{" "}
                            <span className="font-medium text-gray-700">
                              {structure.range || "Flexible"}
                            </span>
                          </span>
                          <span>•</span>
                          <span>
                            Gross:{" "}
                            <span className="font-semibold text-blue-600">
                              {formatCurrency(structure.gross_salary)}
                            </span>
                          </span>
                          {structure.earnings && (
                            <>
                              <span>•</span>
                              <span>
                                {structure.earnings.length} earning component
                                {structure.earnings.length === 1 ? "" : "s"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 bg-gray-50/50">
          <p className="text-xs text-gray-500">
            {selectedIds.length === 0
              ? "Select at least one salary structure to continue."
              : `${selectedIds.length} structure${selectedIds.length === 1 ? "" : "s"} will be updated.`}
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={
                isApplying ||
                selectedIds.length === 0 ||
                structures.length === 0
              }
              className="inline-flex items-center gap-2 rounded-xl bg-[#17375e] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#102b4a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isApplying && <Loader2 className="h-4 w-4 animate-spin" />}
              {isApplying
                ? "Applying..."
                : selectedIds.length > 0
                  ? `Apply to Selected (${selectedIds.length})`
                  : "Apply to Selected"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
