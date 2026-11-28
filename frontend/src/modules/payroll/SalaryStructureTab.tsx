import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  salaryBandFor,
  salaryStructureService,
  type Earning,
  type SalaryStructure,
} from "./admin_salary_structure_service";
import { useQueryClient } from "@tanstack/react-query";
import NoticePopup from "../../components/ui/NoticePopup";
import { useSalaryStructures } from "../../hooks/useSalaryStructures";
import { queryKeys } from "../../lib/queryKeys";

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function grossOf(structure: SalaryStructure): number {
  return structure.earnings.reduce((sum, earning) => sum + (Number(earning.amount) || 0), 0);
}

function StructureCard({
  structure,
  onEdit,
  onDelete,
}: {
  structure: SalaryStructure;
  onEdit: (structure: SalaryStructure) => void;
  onDelete: (structure: SalaryStructure) => void;
}) {
  const gross = grossOf(structure);
  const band = salaryBandFor(structure);

  return (
    <div className="flex flex-col justify-between rounded-[2px] border border-[#E4E6E1] bg-white p-5 shadow-none transition">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-[#1F2933]">{structure.name}</h3>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium text-[#7B8794]">Salary Range</p>
          <p className="mt-0.5 text-sm font-medium text-[#1F2933]">{structure.range || "Flexible"}</p>
        </div>

        <div className="mt-3 rounded-[2px] border border-[#E4E6E1]/50 bg-[#FAFAF8] px-3 py-2">
          <p className="text-xs font-medium text-[#7B8794]">Allowed Salary Band</p>
          <p className="mt-0.5 text-sm font-medium tabular-nums text-[#1F2933]">
            {band.min !== null ? formatCurrency(band.min) : "No min"}
            {" – "}
            {band.max !== null ? formatCurrency(band.max) : "No max"}
          </p>
        </div>

        <div className="mt-4 border-t border-[#E4E6E1] pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#7B8794]">
            Earnings ({structure.earnings.length})
          </p>
          <div className="space-y-1.5 text-sm">
            {structure.earnings.map((earning, idx) => (
              <div key={`${earning.label}-${idx}`} className="flex items-center justify-between">
                <span className="text-[#52606D]">{earning.label}</span>
                <span className="font-medium tabular-nums text-right text-[#1F2933]">{formatCurrency(earning.amount)}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[#E4E6E1] pt-3">
            <span className="text-sm font-semibold text-[#1F2933]">Gross Salary</span>
            <span className="text-sm font-semibold tabular-nums text-right text-[#2F5FD0]">{formatCurrency(gross)}</span>
          </div>
        </div>

        {structure.deductions && structure.deductions.length > 0 && (
          <div className="mt-4 border-t border-[#E4E6E1] pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#7B8794]">
              Applied Deductions & Contributions ({structure.deductions.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {structure.deductions.map((deduction) => (
                <span
                  key={deduction.id}
                  className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium border ${deduction.type === "contribution"
                    ? "bg-[#E3F5E1] text-[#1E6B45] border-[#BCE8B5]"
                    : "bg-[#FDF3D6] text-[#8A5A00] border-[#F6DE95]"
                    }`}
                >
                  {deduction.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex gap-2 border-t border-[#E4E6E1] pt-4">
        <button
          type="button"
          onClick={() => onEdit(structure)}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-[#E4E6E1] bg-white text-[13px] font-medium text-[#1F2933] transition hover:bg-[#F0F1EE] cursor-pointer"
        >
          <Pencil className="h-3.5 w-3.5 shrink-0" />
          Edit Structure
        </button>
        <button
          type="button"
          onClick={() => onDelete(structure)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E4E6E1] bg-white text-[#7B8794] transition hover:bg-[#FBE4E1] hover:text-[#A12D22] cursor-pointer"
          aria-label={`Delete ${structure.name}`}
          title="Delete structure"
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" />
        </button>
      </div>
    </div>
  );
}

function EditStructureModal({
  structure,
  isCreating,
  onClose,
  onSave,
}: {
  structure: SalaryStructure;
  isCreating: boolean;
  onClose: () => void;
  onSave: (updated: SalaryStructure) => Promise<void>;
}) {
  const [name, setName] = useState(structure.name);
  const [range, setRange] = useState(structure.range);
  const [minSalary, setMinSalary] = useState(
    structure.min_salary != null ? String(structure.min_salary) : ""
  );
  const [maxSalary, setMaxSalary] = useState(
    structure.max_salary != null ? String(structure.max_salary) : ""
  );
  const [earnings, setEarnings] = useState<Earning[]>(
    structure.earnings.length > 0
      ? structure.earnings
      : [{ label: "Basic Salary", amount: 0 }]
  );
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  function updateAmount(index: number, value: string) {
    setModalError(null);
    const amount = value === "" ? 0 : Math.max(0, Number(value) || 0);
    setEarnings((current) =>
      current.map((earning, i) => (i === index ? { ...earning, amount } : earning))
    );
  }

  function updateLabel(index: number, value: string) {
    setModalError(null);
    setEarnings((current) =>
      current.map((earning, i) => (i === index ? { ...earning, label: value } : earning))
    );
  }

  function removeRow(index: number) {
    if (earnings.length <= 1) {
      setModalError("At least one earning component is required.");
      return;
    }
    setModalError(null);
    setEarnings((current) => current.filter((_, i) => i !== index));
  }

  function addRow() {
    setModalError(null);
    const existingLabels = new Set(
      earnings.map((e) => e.label.trim().toLowerCase())
    );

    let candidate = "New Allowance";
    let counter = 1;
    while (existingLabels.has(candidate.toLowerCase())) {
      counter++;
      candidate = `New Allowance ${counter}`;
    }

    setEarnings((current) => [...current, { label: candidate, amount: 0 }]);
  }

  const gross = useMemo(
    () => earnings.reduce((sum, earning) => sum + (Number(earning.amount) || 0), 0),
    [earnings]
  );

  const parsedMaxSalary = useMemo(() => {
    const trimmed = maxSalary.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) && num >= 0 ? num : null;
  }, [maxSalary]);

  const limitError = useMemo(() => {
    if (parsedMaxSalary !== null && gross > parsedMaxSalary) {
      return `The sum of all earning components (${formatCurrency(gross)}) cannot exceed the configured maximum salary limit (${formatCurrency(parsedMaxSalary)}).`;
    }
    return null;
  }, [parsedMaxSalary, gross]);

  const displayError = modalError || limitError;

  async function handleSave() {
    setModalError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setModalError("Structure name is required.");
      return;
    }

    // Validate salary band numbers
    const parsedMin = minSalary.trim() === "" ? null : Number(minSalary);
    const parsedMax = maxSalary.trim() === "" ? null : Number(maxSalary);

    if (parsedMin !== null && (!Number.isFinite(parsedMin) || parsedMin < 0)) {
      setModalError("Minimum salary must be a valid non-negative number.");
      return;
    }

    if (parsedMax !== null && (!Number.isFinite(parsedMax) || parsedMax < 0)) {
      setModalError("Maximum salary must be a valid non-negative number.");
      return;
    }

    if (
      parsedMin !== null &&
      parsedMax !== null &&
      parsedMax < parsedMin
    ) {
      setModalError("Maximum salary cannot be lower than the minimum salary.");
      return;
    }

    // Validate earnings
    if (earnings.length === 0) {
      setModalError("At least one earning component is required.");
      return;
    }

    const trimmedLabels = earnings.map((e) => e.label.trim());
    if (trimmedLabels.some((l) => !l)) {
      setModalError("All earning components must have a label.");
      return;
    }

    const lowerLabels = trimmedLabels.map((l) => l.toLowerCase());
    if (new Set(lowerLabels).size !== lowerLabels.length) {
      setModalError("Duplicate earning component labels are not allowed.");
      return;
    }

    if (earnings.some((e) => e.amount < 0)) {
      setModalError("Earning amounts cannot be negative.");
      return;
    }

    if (parsedMax !== null && gross > parsedMax) {
      setModalError(
        `The sum of all earning components (${formatCurrency(gross)}) cannot exceed the configured maximum salary limit (${formatCurrency(parsedMax)}).`
      );
      return;
    }

    // Auto-derive range if left blank
    let computedRange = range.trim();
    if (!computedRange) {
      if (parsedMin !== null && parsedMax !== null) {
        computedRange = `${formatCurrency(parsedMin)} – ${formatCurrency(parsedMax)}`;
      } else if (parsedMin !== null) {
        computedRange = `${formatCurrency(parsedMin)}+`;
      } else if (parsedMax !== null) {
        computedRange = `Up to ${formatCurrency(parsedMax)}`;
      } else {
        computedRange = "Flexible";
      }
    }

    setSaving(true);
    try {
      await onSave({
        ...structure,
        name: trimmedName,
        range: computedRange,
        min_salary: parsedMin,
        max_salary: parsedMax,
        earnings: earnings.map((e) => ({
          label: e.label.trim(),
          amount: Number(e.amount) || 0,
        })),
      });
    } catch (err: unknown) {
      setModalError(
        err instanceof Error
          ? err.message
          : "Failed to save salary structure. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-bold text-slate-900">
            {isCreating ? "Add Salary Structure" : "Edit Salary Structure"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {displayError && (
            <div className="flex items-start gap-2.5 rounded-[2px] border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <span>{displayError}</span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Structure Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setModalError(null);
              }}
              placeholder="e.g. Standard, Executive Band"
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Salary Range Label
            </label>
            <input
              type="text"
              value={range}
              onChange={(event) => {
                setRange(event.target.value);
                setModalError(null);
              }}
              placeholder="e.g. 15,000 - 30,000 (optional)"
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Display label. If left empty, it will be automatically derived from the band limits below.
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-slate-600">
              Allowed Salary Amount Band
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={minSalary}
                onChange={(event) => {
                  setMinSalary(event.target.value);
                  setModalError(null);
                }}
                placeholder="Min salary"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-sm font-medium text-slate-400">to</span>
              <input
                type="number"
                min="0"
                value={maxSalary}
                onChange={(event) => {
                  setMaxSalary(event.target.value);
                  setModalError(null);
                }}
                placeholder="Max salary (optional)"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Employees assigned to this structure must have salaries within this range. Leave max empty for no ceiling.
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600">
                Earnings Components <span className="text-rose-500">*</span>
              </p>
              <button
                type="button"
                onClick={addRow}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                + Add Component
              </button>
            </div>

            <div className="space-y-2">
              {earnings.map((earning, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={earning.label}
                    onChange={(event) => updateLabel(index, event.target.value)}
                    placeholder="Component Label"
                    className="flex-1 rounded border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="relative w-32">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={earning.amount === 0 ? "" : earning.amount}
                      onChange={(event) => updateAmount(index, event.target.value)}
                      placeholder="0"
                      className="w-full rounded border border-slate-200 py-2 pl-7 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    disabled={earnings.length <= 1}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                    aria-label="Remove component"
                    title={earnings.length <= 1 ? "At least one component required" : "Remove component"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between rounded-[2px] bg-slate-50 px-4 py-3">
              <span className="text-sm font-bold text-slate-900">Total Gross Salary</span>
              <span
                className={`text-sm font-bold ${limitError ? "text-rose-600" : "text-blue-600"
                  }`}
              >
                {formatCurrency(gross)}
              </span>
            </div>
            {limitError && (
              <p className="text-xs font-medium text-rose-600">
                {limitError}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim() || Boolean(limitError)}
            className="flex flex-1 items-center justify-center gap-2 rounded bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : isCreating ? (
              "Create Structure"
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SalaryStructureTab() {
  const queryClient = useQueryClient();
  const { data: structuresData, isLoading: loading, error: queryError, refetch } = useSalaryStructures();
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [editingStructure, setEditingStructure] = useState<SalaryStructure | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingStructure, setDeletingStructure] = useState<SalaryStructure | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);
  const [showCreateSuccessModal, setShowCreateSuccessModal] = useState(false);
  const [createdStructureName, setCreatedStructureName] = useState<string | null>(null);

  const [prevStructuresData, setPrevStructuresData] = useState(structuresData);
  if (structuresData && structuresData !== prevStructuresData) {
    setPrevStructuresData(structuresData);
    setStructures(structuresData);
  }

  const [prevQueryError, setPrevQueryError] = useState(queryError);
  if (queryError !== prevQueryError) {
    setPrevQueryError(queryError);
    if (queryError) {
      setError(
        queryError instanceof Error
          ? queryError.message
          : "Failed to load salary structures."
      );
    }
  }

  async function handleSave(updated: SalaryStructure) {
    const payload = {
      name: updated.name.trim(),
      range: updated.range?.trim() || null,
      min_salary: updated.min_salary ?? null,
      max_salary: updated.max_salary ?? null,
      earnings: updated.earnings,
    };

    let saved: SalaryStructure;
    if (isCreating || updated.id.startsWith("custom-")) {
      saved = await salaryStructureService.create(payload);
      setCreatedStructureName(saved.name);
      setShowCreateSuccessModal(true);
    } else {
      saved = await salaryStructureService.update(updated.id, payload);
      setSuccessMessage(`Salary structure '${saved.name}' updated successfully.`);
    }

    void queryClient.invalidateQueries({
      queryKey: queryKeys.reference.salaryStructures(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.payrollAnalytics(),
    });

    setStructures((current) => {
      const exists = current.some((s) => s.id === saved.id);
      return exists
        ? current.map((s) => (s.id === saved.id ? saved : s))
        : [...current, saved];
    });

    setEditingStructure(null);
    setIsCreating(false);
  }

  function handleAddNew() {
    setIsCreating(true);
    setEditingStructure({
      id: `custom-${Date.now()}`,
      name: "",
      range: "",
      min_salary: null,
      max_salary: null,
      earnings: [
        { label: "Basic Salary", amount: 0 },
        { label: "House Rent Allowance (HRA)", amount: 0 },
      ],
      gross_salary: 0,
    });
  }

  function handleCloseModal() {
    setEditingStructure(null);
    setIsCreating(false);
  }

  async function handleConfirmDelete() {
    if (!deletingStructure) return;
    try {
      setIsDeleting(true);
      setDeleteModalError(null);
      await salaryStructureService.delete(deletingStructure.id);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reference.salaryStructures(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.payrollAnalytics(),
      });
      void refetch();
      setStructures((current) =>
        current.filter((s) => s.id !== deletingStructure.id)
      );
      setDeletingStructure(null);
    } catch (requestError: unknown) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not delete salary structure.";
      setDeleteModalError(message);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#1F2933]">Salary Structures</h2>
          <p className="mt-1 text-sm text-[#7B8794]">
            Define salary bands, earning components, and gross remuneration for employee assignments.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddNew}
          className="flex h-10 items-center gap-2 rounded-md bg-[#2F5FD0] px-4 text-sm font-medium text-white transition hover:bg-[#264FB0]"
        >
          <Plus className="h-4 w-4 shrink-0" />
          Add Structure
        </button>
      </div>

      {/* Closes itself after a few seconds, so no timer is needed here. */}
      <NoticePopup
        notice={successMessage ? { type: "success", text: successMessage } : null}
        onDismiss={() => setSuccessMessage(null)}
      />

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-[2px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-xs font-bold underline hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-[2px] border border-[#E4E6E1] bg-white p-8">
          <Loader2 className="h-6 w-6 animate-spin text-[#2F5FD0]" />
          <p className="text-xs text-[#7B8794]">Loading salary structures...</p>
        </div>
      ) : structures.length === 0 ? (
        <div className="rounded-[2px] border border-dashed border-[#E4E6E1] bg-white p-12 text-center">
          <h3 className="text-sm font-semibold text-[#1F2933]">No Salary Structures Defined</h3>
          <p className="mt-1 text-xs text-[#7B8794]">
            Create salary structures to assign earning components and salary bands to employees.
          </p>
          <button
            type="button"
            onClick={handleAddNew}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-[#2F5FD0] px-4 text-sm font-medium text-white transition hover:bg-[#264FB0]"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Add First Structure
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {structures.map((structure) => (
            <StructureCard
              key={structure.id}
              structure={structure}
              onEdit={setEditingStructure}
              onDelete={(s) => {
                setDeleteModalError(null);
                setDeletingStructure(s);
              }}
            />
          ))}
        </div>
      )}

      {editingStructure && (
        <EditStructureModal
          structure={editingStructure}
          isCreating={isCreating}
          onClose={handleCloseModal}
          onSave={handleSave}
        />
      )}

      {showCreateSuccessModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-xs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowCreateSuccessModal(false);
              setCreatedStructureName(null);
            }
          }}
        >
          <div className="relative w-full max-w-sm rounded-[2px] bg-white p-6 text-center shadow-2xl">
            <button
              type="button"
              onClick={() => {
                setShowCreateSuccessModal(false);
                setCreatedStructureName(null);
              }}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              Salary Structure Created Successfully
            </h3>

            {createdStructureName && (
              <p className="mt-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">"{createdStructureName}"</span> has been added to your salary structures.
              </p>
            )}

            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowCreateSuccessModal(false);
                  setCreatedStructureName(null);
                }}
                className="w-full rounded bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingStructure && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-xs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeleting) {
              setDeletingStructure(null);
              setDeleteModalError(null);
            }
          }}
        >
          <div className="w-full max-w-sm rounded-[2px] bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-4 ring-amber-50/50">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  Delete Salary Structure
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Are you sure you want to delete this salary structure?
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-800">
                  "{deletingStructure.name}"
                </p>
              </div>
            </div>

            {deleteModalError && (
              <div className="mt-4 flex items-start gap-2 rounded-[2px] border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <span>{deleteModalError}</span>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeletingStructure(null);
                  setDeleteModalError(null);
                }}
                disabled={isDeleting}
                className="flex-1 rounded border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex flex-1 items-center justify-center gap-2 rounded bg-rose-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalaryStructureTab;
