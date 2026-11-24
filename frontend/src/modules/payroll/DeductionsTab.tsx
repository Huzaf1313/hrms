import { useEffect, useState } from "react";
import { Calculator, Pencil, Plus, Trash2, X } from "lucide-react";
import ApplyDeductionModal from "./ApplyDeductionModal";

import {
  adminDeductionService,
  type BackendDeduction,
  type DeductionCreatePayload,
  type DeductionCalculationResponse,
} from "./admin_deduction_service";
import { useQueryClient } from "@tanstack/react-query";
import NoticePopup from "../../components/ui/NoticePopup";
import { queryKeys } from "../../lib/queryKeys";

type ComponentType = "Deduction" | "Contribution";

type CalculationType =
  | "percentage_of_basic"
  | "fixed_amount"
  | "slab"
  | "tax_calculation";

interface SlabRow {
  uptoAnnualIncome: number | null;
  amount: number | "";
}

interface DeductionComponent {
  id: string;
  name: string;
  type: ComponentType;
  calculationType: CalculationType;
  percentage?: number | "";
  fixedAmount?: number | "";
  slabs?: SlabRow[];
  taxRegime?: "old" | "new";
}

/* =========================================================
   BACKEND → FRONTEND MAPPING
========================================================= */

function mapBackendToFrontend(
  component: BackendDeduction,
): DeductionComponent {
  return {
    id: component.id,
    name: component.name,
    type:
      component.type === "contribution"
        ? "Contribution"
        : "Deduction",
    calculationType: component.calculation_method,
    percentage: component.percentage ?? undefined,
    fixedAmount: component.fixed_amount ?? undefined,
    slabs: component.slabs,
    taxRegime: component.tax_regime,
  };
}

/* =========================================================
   FRONTEND → BACKEND PAYLOAD
========================================================= */

function createPayload(
  component: DeductionComponent,
): DeductionCreatePayload {
  const code = component.name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  return {
    name: component.name.trim(),
    code,
    type:
      component.type === "Contribution"
        ? "contribution"
        : "deduction",

    calculation_method: component.calculationType,

    percentage:
      component.calculationType === "percentage_of_basic"
        ? component.percentage === ""
          ? null
          : component.percentage ?? null
        : null,

    fixed_amount:
      component.calculationType === "fixed_amount"
        ? component.fixedAmount === ""
          ? null
          : component.fixedAmount ?? null
        : null,

    slabs:
      component.calculationType === "slab"
        ? component.slabs?.map((slab) => ({
            uptoAnnualIncome: slab.uptoAnnualIncome,
            amount: slab.amount === "" ? 0 : slab.amount,
          }))
        : undefined,

    tax_regime:
      component.calculationType === "tax_calculation"
        ? component.taxRegime
        : undefined,

    is_active: true,
  };
}

/* =========================================================
   HELPERS
========================================================= */

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculationLabel(
  component: DeductionComponent,
): string {
  switch (component.calculationType) {
    case "percentage_of_basic":
      return `${component.percentage === "" || component.percentage == null
        ? "-"
        : component.percentage}% of Basic`;

    case "fixed_amount":
      return component.fixedAmount === "" || component.fixedAmount == null
        ? "-"
        : formatCurrency(component.fixedAmount);

    case "slab":
      return "Income Slab";

    case "tax_calculation":
      return `Tax (${component.taxRegime ?? "new"} regime)`;

    default:
      return "-";
  }
}

/* =========================================================
   MODAL
========================================================= */

interface ComponentModalProps {
  component: DeductionComponent;
  isCreating: boolean;
  onSave: (component: DeductionComponent) => void;
  onClose: () => void;
}

function ComponentModal({
  component,
  isCreating,
  onSave,
  onClose,
}: ComponentModalProps) {
  const [form, setForm] =
    useState<DeductionComponent>(component);

  const updateField = <
    K extends keyof DeductionComponent,
  >(
    field: K,
    value: DeductionComponent[K],
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  function updateSlab(
    index: number,
    field: keyof SlabRow,
    value: number | null | "",
  ) {
    setForm((previous) => {
      const slabs = [...(previous.slabs ?? [])];

      slabs[index] = {
        ...slabs[index],
        [field]: value,
      };

      return {
        ...previous,
        slabs,
      };
    });
  }

  function addSlab() {
    setForm((previous) => ({
      ...previous,
      slabs: [
        ...(previous.slabs ?? []),
        {
          uptoAnnualIncome: null,
          amount: "",
        },
      ],
    }));
  }

  function removeSlab(index: number) {
    setForm((previous) => ({
      ...previous,
      slabs: (previous.slabs ?? []).filter(
        (_, slabIndex) => slabIndex !== index,
      ),
    }));
  }

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    onSave({
      ...form,
      name: form.name.trim(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-[#17375e]">
              {isCreating
                ? "Add Deduction / Contribution"
                : "Edit Deduction / Contribution"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Configure payroll calculation rules.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 text-gray-500 transition hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 p-6"
        >
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Component Name
            </label>

            <input
              required
              type="text"
              value={form.name}
              onChange={(event) =>
                updateField("name", event.target.value)
              }
              placeholder="e.g. Provident Fund"
              className="w-full rounded border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#17375e]"
            />
          </div>

          {/* Type */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Type
            </label>

            <select
              value={form.type}
              onChange={(event) =>
                updateField(
                  "type",
                  event.target.value as ComponentType,
                )
              }
              className="w-full rounded border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#17375e]"
            >
              <option value="Deduction">
                Deduction
              </option>

              <option value="Contribution">
                Contribution
              </option>
            </select>
          </div>

          {/* Calculation Type */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
              Calculation Type
            </label>

            <select
              value={form.calculationType}
              onChange={(event) =>
                updateField(
                  "calculationType",
                  event.target.value as CalculationType,
                )
              }
              className="w-full rounded border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#17375e]"
            >
              <option value="percentage_of_basic">
                Percentage of Basic
              </option>

              <option value="fixed_amount">
                Fixed Amount
              </option>

              <option value="slab">
                Income Slab
              </option>

              <option value="tax_calculation">
                Tax Calculation
              </option>
            </select>
          </div>

          {/* Percentage */}
          {form.calculationType ===
            "percentage_of_basic" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
                Percentage
              </label>

              <div className="relative">
                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.percentage ?? ""}
                  onChange={(event) =>
                    updateField(
                      "percentage",
                      event.target.value === ""
                        ? ""
                        : Number(event.target.value),
                    )
                  }
                  className="w-full rounded border border-gray-200 bg-white px-4 py-3 pr-12 text-sm outline-none transition focus:border-[#17375e]"
                />

                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  %
                </span>
              </div>
            </div>
          )}

          {/* Fixed Amount */}
          {form.calculationType === "fixed_amount" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
                Fixed Amount
              </label>

              <input
                required
                type="number"
                min="0"
                step="1"
                value={form.fixedAmount ?? ""}
                onChange={(event) =>
                  updateField(
                    "fixedAmount",
                    event.target.value === ""
                      ? ""
                      : Number(event.target.value),
                  )
                }
                placeholder="Enter amount"
                className="w-full rounded border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#17375e]"
              />
            </div>
          )}

          {/* Tax Regime */}
          {form.calculationType ===
            "tax_calculation" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#17375e]">
                Tax Regime
              </label>

              <select
                value={form.taxRegime ?? "new"}
                onChange={(event) =>
                  updateField(
                    "taxRegime",
                    event.target.value as "old" | "new",
                  )
                }
                className="w-full rounded border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#17375e]"
              >
                <option value="new">
                  New Tax Regime
                </option>

                <option value="old">
                  Old Tax Regime
                </option>
              </select>
            </div>
          )}

          {/* Slabs */}
          {form.calculationType === "slab" && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-medium text-[#17375e]">
                  Income Slabs
                </label>

                <button
                  type="button"
                  onClick={addSlab}
                  className="rounded bg-[#17375e] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#102b4a]"
                >
                  Add Slab
                </button>
              </div>

              <div className="space-y-3">
                {(form.slabs ?? []).map(
                  (slab, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[1fr_1fr_auto] gap-3 rounded border border-gray-200 p-3"
                    >
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">
                          Up to Annual Income
                        </label>

                        <input
                          type="number"
                          min="0"
                          value={
                            slab.uptoAnnualIncome ?? ""
                          }
                          onChange={(event) =>
                            updateSlab(
                              index,
                              "uptoAnnualIncome",
                              event.target.value === ""
                                ? null
                                : Number(
                                    event.target.value,
                                  ),
                            )
                          }
                          placeholder="e.g. 500000"
                          className="w-full rounded border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#17375e]"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-gray-500">
                          Amount
                        </label>

                        <input
                          type="number"
                          min="0"
                          value={slab.amount}
                          onChange={(event) =>
                            updateSlab(
                              index,
                              "amount",
                              event.target.value === ""
                                ? ""
                                : Number(
                                    event.target.value,
                                  ),
                            )
                          }
                          placeholder="Amount"
                          className="w-full rounded border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#17375e]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeSlab(index)
                        }
                        className="mt-5 rounded p-2 text-red-500 transition hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ),
                )}

                {(form.slabs ?? []).length === 0 && (
                  <div className="rounded border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
                    No slabs added yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-200 px-5 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="rounded bg-[#17375e] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#102b4a]"
            >
              {isCreating
                ? "Create Component"
                : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function DeductionsTab() {
  const queryClient = useQueryClient();
  const [components, setComponents] =
    useState<DeductionComponent[]>([]);

  const [editingComponent, setEditingComponent] =
    useState<DeductionComponent | null>(null);

  const [isCreating, setIsCreating] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [applyingComponent, setApplyingComponent] =
    useState<DeductionComponent | null>(null);

  const [successToast, setSuccessToast] =
    useState<string | null>(null);

  const [previewBasic, setPreviewBasic] =
    useState<number | "">("");

  const [previewAnnualIncome, setPreviewAnnualIncome] =
    useState<number | "">("");

  const [previewResult, setPreviewResult] =
    useState<DeductionCalculationResponse | null>(null);

  const [isCalculating, setIsCalculating] =
    useState(false);

  /* =======================================================
     LOAD DATA FROM BACKEND
  ======================================================= */

  useEffect(() => {
    loadComponents();
  }, []);

  async function loadComponents() {
    try {
      setIsLoading(true);
      setError(null);

      const response =
        await adminDeductionService.list();

      setComponents(
        response.map(mapBackendToFrontend),
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load deductions and contributions.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  /* =======================================================
     BACKEND PREVIEW CALCULATION
  ======================================================= */

  async function calculatePreview() {
    if (previewBasic === "" || previewAnnualIncome === "") {
      return;
    }

    try {
      setIsCalculating(true);
      setError(null);

      const response =
        await adminDeductionService.calculate({
          basic_salary: previewBasic,
          annual_income: previewAnnualIncome,
        });

      setPreviewResult(response);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to calculate deductions and contributions.",
      );
    } finally {
      setIsCalculating(false);
    }
  }

  /* =======================================================
     ADD
  ======================================================= */

  function handleAddNew() {
    setIsCreating(true);

    setEditingComponent({
      id: `custom-${Date.now()}`,
      name: "",
      type: "Deduction",
      calculationType: "percentage_of_basic",
      percentage: "",
    });
  }

  /* =======================================================
     EDIT
  ======================================================= */

  function handleEdit(
    component: DeductionComponent,
  ) {
    setIsCreating(false);
    setEditingComponent(component);
  }

  /* =======================================================
     SAVE TO BACKEND
  ======================================================= */

  async function handleSave(
    updated: DeductionComponent,
  ) {
    try {
      setError(null);

      const payload = createPayload(updated);

      if (isCreating) {
        await adminDeductionService.create(
          payload,
        );
      } else {
        await adminDeductionService.update(
          updated.id,
          payload,
        );
      }

      await loadComponents();
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reference.deductions(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.payrollAnalytics(),
      });

      setEditingComponent(null);
      setIsCreating(false);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to save deduction or contribution.",
      );
    }
  }

  /* =======================================================
     DELETE
  ======================================================= */

  async function handleDelete(id: string) {
    const shouldDelete = window.confirm(
      "Are you sure you want to delete this component?",
    );

    if (!shouldDelete) {
      return;
    }

    try {
      setError(null);

      await adminDeductionService.delete(id);

      await loadComponents();
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reference.deductions(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.payrollAnalytics(),
      });
    } catch (err) {
      console.error(err);

      setError(
        "Unable to delete deduction or contribution.",
      );
    }
  }

  function handleApplySuccess(componentName: string, updatedCount: number) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.reference.deductions(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.reference.salaryStructures(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.payrollAnalytics(),
    });

    setSuccessToast(
      `${componentName} applied to ${updatedCount} salary structure${updatedCount === 1 ? "" : "s"}.`,
    );
    void loadComponents();
  }

  /* =======================================================
     PREVIEW
  ======================================================= */

  const previewRows =
    previewResult?.results ?? [];

  const totalDeductions =
    previewResult?.total_deductions ?? 0;

  const totalContributions =
    previewResult?.total_contributions ?? 0;

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div>
      {/* Loading */}
      {isLoading && (
        <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Loading deductions and contributions...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Closes itself after a few seconds, so no timer is needed here. */}
      <NoticePopup
        notice={successToast ? { type: "success", text: successToast } : null}
        onDismiss={() => setSuccessToast(null)}
      />

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#1F2933]">
            Deductions & Contributions
          </h2>

          <p className="mt-1 text-sm text-[#7B8794]">
            Manage employee deductions and employer
            contributions.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddNew}
          className="flex h-10 items-center gap-2 rounded-md bg-[#2F5FD0] px-4 text-sm font-medium text-white transition hover:bg-[#264FB0]"
        >
          <Plus size={16} className="shrink-0" />
          Add Component
        </button>
      </div>

      {/* Components Table */}
      <div className="overflow-hidden rounded-lg border border-[#E4E6E1] bg-white shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="h-11 border-b border-[#E4E6E1] bg-[#FAFAF8] text-xs font-medium uppercase tracking-wider text-[#7B8794]">
                <th className="px-5 py-3 text-left font-medium">
                  Component
                </th>

                <th className="px-5 py-3 text-left font-medium">
                  Type
                </th>

                <th className="px-5 py-3 text-left font-medium">
                  Calculation
                </th>

                <th className="px-5 py-3 text-right font-medium">
                  Preview
                </th>

                <th className="px-5 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {components.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-xs text-[#7B8794]"
                  >
                    No deductions or contributions
                    found.
                  </td>
                </tr>
              ) : (
                components.map((component) => {
                  const backendResult =
                    previewRows.find(
                      (result) =>
                        result.id === component.id,
                    );

                  const amount =
                    backendResult?.calculated_amount;

                  return (
                    <tr
                      key={component.id}
                      className="min-h-[52px] border-b border-[#E4E6E1]/50 last:border-0 hover:bg-[#FAFAF8] transition-colors"
                    >
                      {/* Component */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-[#1F2933]">
                          {component.name}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                            component.type ===
                            "Deduction"
                              ? "bg-[#FDF3D6] text-[#8A5A00] border-[#F6DE95]"
                              : "bg-[#E3F5E1] text-[#1E6B45] border-[#BCE8B5]"
                          }`}
                        >
                          {component.type}
                        </span>
                      </td>

                      {/* Calculation */}
                      <td className="px-5 py-3.5 text-sm text-[#52606D]">
                        {calculationLabel(
                          component,
                        )}
                      </td>

                      {/* Preview */}
                      <td className="px-5 py-3.5 text-right text-sm font-medium tabular-nums text-[#1F2933]">
                        {amount == null
                          ? "-"
                          : formatCurrency(amount)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setApplyingComponent(component)}
                            className="flex h-8 items-center justify-center rounded-md border border-[#E4E6E1] bg-white px-3 text-[13px] font-medium text-[#2F5FD0] hover:bg-[#E8EEFB] transition cursor-pointer"
                            title="Apply to selected salary structures"
                          >
                            Apply
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleEdit(
                                component,
                              )
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E4E6E1] bg-white text-[#7B8794] hover:bg-[#F0F1EE] hover:text-[#1F2933] transition cursor-pointer"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(
                                component.id,
                              )
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E4E6E1] bg-white text-[#7B8794] hover:bg-[#FBE4E1] hover:text-[#A12D22] transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview Calculator */}
      <div className="mt-6 rounded-lg border border-[#E4E6E1] bg-white p-5 shadow-none">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8EEFB] text-[#2F5FD0] shrink-0">
            <Calculator size={16} className="shrink-0" />
          </div>

          <div>
            <h3 className="text-base font-semibold text-[#1F2933]">
              Preview Calculation
            </h3>

            <p className="mt-0.5 text-xs text-[#7B8794]">
              Test deductions and contributions
              against a sample salary.
            </p>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#7B8794]">
              Basic Salary
            </label>

            <input
              type="number"
              min="0"
              value={previewBasic}
              onChange={(event) => {
                const value = event.target.value;

                setPreviewBasic(
                  value === "" ? "" : Number(value),
                );
                setPreviewAnnualIncome(
                  value === ""
                    ? ""
                    : roundToTwo(Number(value) * 12),
                );
                setPreviewResult(null);
              }}
              className="h-10 w-full rounded-[6px] border border-[#E4E6E1] bg-white px-3.5 text-sm text-[#1F2933] outline-none transition hover:border-[#CBD2D9] focus:border-[#2F5FD0]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#7B8794]">
              Annual Income
            </label>

            <input
              type="number"
              min="0"
              value={previewAnnualIncome}
              onChange={(event) => {
                const value = event.target.value;

                setPreviewAnnualIncome(
                  value === "" ? "" : Number(value),
                );
                setPreviewBasic(
                  value === ""
                    ? ""
                    : roundToTwo(Number(value) / 12),
                );
                setPreviewResult(null);
              }}
              className="h-10 w-full rounded-[6px] border border-[#E4E6E1] bg-white px-3.5 text-sm text-[#1F2933] outline-none transition hover:border-[#CBD2D9] focus:border-[#2F5FD0]"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={calculatePreview}
            disabled={
              isCalculating ||
              previewBasic === "" ||
              previewAnnualIncome === ""
            }
            className="flex h-10 items-center gap-2 rounded-md border border-[#E4E6E1] bg-white px-4 text-sm font-medium text-[#1F2933] transition hover:bg-[#F0F1EE] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            <Calculator size={16} className="shrink-0" />
            {isCalculating
              ? "Calculating..."
              : "Calculate Preview"}
          </button>
        </div>

        {/* Preview Results */}
        <div className="mt-5 overflow-hidden rounded-lg border border-[#E4E6E1] bg-white">
          <div className="grid grid-cols-3 border-b border-[#E4E6E1] bg-[#FAFAF8] px-5 py-3 text-xs font-medium uppercase tracking-wider text-[#7B8794]">
            <div>Component</div>
            <div>Type</div>
            <div className="text-right">
              Monthly Amount
            </div>
          </div>

          {previewRows.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-[#7B8794]">
              Enter the salary details and click
              "Calculate Preview".
            </div>
          ) : (
            previewRows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-3 border-b border-[#E4E6E1]/50 last:border-0 px-5 py-3.5 text-sm hover:bg-[#FAFAF8] transition-colors"
              >
                <div className="font-semibold text-[#1F2933]">
                  {row.name}
                </div>

                <div className="text-[#52606D]">
                  {row.type}
                </div>

                <div className="text-right font-medium tabular-nums text-[#1F2933]">
                  {formatCurrency(row.calculated_amount)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals */}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col justify-between rounded-lg border border-[#E4E6E1] bg-white p-4 shadow-none">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#A12D22]" />
              <p className="text-xs font-medium uppercase tracking-wider text-[#7B8794]">
                Total Deductions
              </p>
            </div>

            <p className="mt-2 text-[20px] font-semibold tabular-nums text-[#1F2933]">
              {previewResult == null
                ? "-"
                : formatCurrency(totalDeductions)}
            </p>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-[#E4E6E1] bg-white p-4 shadow-none">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#1E6B45]" />
              <p className="text-xs font-medium uppercase tracking-wider text-[#7B8794]">
                Total Contributions
              </p>
            </div>

            <p className="mt-2 text-[20px] font-semibold tabular-nums text-[#1F2933]">
              {previewResult == null
                ? "-"
                : formatCurrency(totalContributions)}
            </p>
          </div>
        </div>
      </div>

      {/* Modal */}
      {editingComponent && (
        <ComponentModal
          component={editingComponent}
          isCreating={isCreating}
          onSave={handleSave}
          onClose={() => {
            setEditingComponent(null);
            setIsCreating(false);
          }}
        />
      )}

      {/* Apply Deduction to Salary Structures Modal */}
      {applyingComponent && (
        <ApplyDeductionModal
          component={applyingComponent}
          onClose={() => setApplyingComponent(null)}
          onSuccess={(count) =>
            handleApplySuccess(applyingComponent.name, count)
          }
        />
      )}
    </div>
  );
}
