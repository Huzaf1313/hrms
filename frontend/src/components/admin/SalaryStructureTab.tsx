import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  salaryStructureService,
  type Earning,
  type SalaryStructure,
} from "../../services/admin_salary_structure_service";

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function grossOf(structure: SalaryStructure): number {
  return structure.earnings.reduce((sum, earning) => sum + earning.amount, 0);
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

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">{structure.name}</h3>

      <div className="mt-4">
        <p className="text-[11px] font-medium text-slate-400">Salary Range</p>
        <p className="text-sm font-semibold text-slate-700">{structure.range}</p>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Earnings
        </p>
        <div className="space-y-1.5 text-sm">
          {structure.earnings.map((earning) => (
            <div key={earning.label} className="flex items-center justify-between">
              <span className="text-slate-600">{earning.label}</span>
              <span className="font-medium text-slate-800">{formatCurrency(earning.amount)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-sm font-bold text-slate-900">Gross Salary</span>
          <span className="text-sm font-bold text-slate-900">{formatCurrency(gross)}</span>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => onEdit(structure)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit Structure
        </button>
        <button
          type="button"
          onClick={() => onDelete(structure)}
          className="flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-rose-500 hover:bg-rose-50"
          aria-label="Delete structure"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {structure.deductions && structure.deductions.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Applied deductions & contributions
          </p>
          <div className="space-y-1 text-xs text-slate-600">
            {structure.deductions.map((deduction) => (
              <div key={deduction.id} className="flex items-center justify-between gap-2">
                <span>{deduction.name}</span>
                <span className="text-slate-400">{deduction.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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
  const [earnings, setEarnings] = useState<Earning[]>(structure.earnings);
  const [saving, setSaving] = useState(false);

  function updateAmount(index: number, value: string) {
    const amount = value === "" ? 0 : Number(value) || 0;
    setEarnings((current) =>
      current.map((earning, i) => (i === index ? { ...earning, amount } : earning)),
    );
  }

  function updateLabel(index: number, value: string) {
    setEarnings((current) =>
      current.map((earning, i) => (i === index ? { ...earning, label: value } : earning)),
    );
  }

  function removeRow(index: number) {
    setEarnings((current) => current.filter((_, i) => i !== index));
  }

  function addRow() {
    if (earnings.some((earning) => earning.label.trim().toLowerCase() === "new allowance")) {
      window.alert("This earning field already exists in the salary structure.");
      return;
    }

    setEarnings((current) => [...current, { label: "New Allowance", amount: 0 }]);
  }

  const gross = earnings.reduce((sum, earning) => sum + earning.amount, 0);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ ...structure, name, range, earnings });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-bold text-slate-900">
            {isCreating ? "Add Salary Structure" : "Edit Salary Structure"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Structure Name</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Salary Range</label>
            <input
              type="text"
              value={range}
              onChange={(event) => setRange(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600">Earnings</p>
            <div className="space-y-2">
              {earnings.map((earning, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={earning.label}
                    onChange={(event) => updateLabel(index, event.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    value={earning.amount === 0 ? "" : earning.amount}
                    onChange={(event) => updateAmount(index, event.target.value)}
                    placeholder="0"
                    className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addRow}
              className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
            >
              + Add Earning
            </button>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="text-sm font-bold text-slate-900">Gross Salary</span>
            <span className="text-sm font-bold text-slate-900">{formatCurrency(gross)}</span>
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim() || !range.trim()}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {saving ? "Saving..." : isCreating ? "Create Structure" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SalaryStructureTab() {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [editingStructure, setEditingStructure] = useState<SalaryStructure | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingStructure, setDeletingStructure] = useState<SalaryStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    salaryStructureService
      .list()
      .then((data) => {
        if (mounted) setStructures(data);
      })
      .catch((requestError: Error) => {
        if (mounted) setError(requestError.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSave(updated: SalaryStructure) {
    const labels = updated.earnings.map((earning) => earning.label.trim().toLowerCase());
    if (labels.some((label, index) => labels.indexOf(label) !== index)) {
      window.alert("This earning field already exists in the salary structure.");
      return;
    }

    setError(null);
    const payload = {
      name: updated.name.trim(),
      range: updated.range.trim(),
      earnings: updated.earnings,
    };
    let saved: SalaryStructure;
    try {
      saved = updated.id.startsWith("custom-")
        ? await salaryStructureService.create(payload)
        : await salaryStructureService.update(updated.id, payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save salary structure.");
      return;
    }

    setStructures((current) => {
      const exists = current.some((structure) => structure.id === saved.id);
      return exists
        ? current.map((structure) => (structure.id === saved.id ? saved : structure))
        : [...current, saved];
    });
    setEditingStructure(null);
    setIsCreating(false);
  }

  function handleAddNew() {
    setIsCreating(true);
    setEditingStructure({
      id: `custom-${Date.now()}`,
      name: "New Salary Structure",
      range: "",
      earnings: [{ label: "Basic Salary", amount: 0 }],
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
      setError(null);
      await salaryStructureService.delete(deletingStructure.id);
      setStructures((current) => current.filter((structure) => structure.id !== deletingStructure.id));
      setDeletingStructure(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not delete salary structure.");
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">Salary Structures</h2>
        <button
          type="button"
          onClick={handleAddNew}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Structure
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-slate-500">Loading salary structures...</p>}
      {!loading && structures.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No salary structures found. Add your first structure.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {structures.map((structure) => (
          <StructureCard
            key={structure.id}
            structure={structure}
            onEdit={setEditingStructure}
            onDelete={setDeletingStructure}
          />
        ))}
      </div>

      {editingStructure && (
        <EditStructureModal
          structure={editingStructure}
          isCreating={isCreating}
          onClose={handleCloseModal}
          onSave={handleSave}
        />
      )}

      {deletingStructure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Delete Structure?</h2>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently delete "{deletingStructure.name}". This can't be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setDeletingStructure(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 rounded-lg bg-rose-500 py-2.5 text-sm font-semibold text-white hover:bg-rose-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalaryStructureTab;
