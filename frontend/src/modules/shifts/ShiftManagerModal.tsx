import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { ApiError } from "../../services/api";
import {
  formatDuration,
  formatShiftTime,
  shiftService,
} from "./shiftService";
import type { Shift } from "./types";

const emptyForm = {
  name: "",
  start_time: "",
  end_time: "",
  grace_period_minutes: 15,
  is_active: true,
  notes: "",
};

/** Mirrors the backend's shift_duration_minutes so the admin sees the length
 *  before saving, including the wrap past midnight for a night shift. */
function previewDurationMinutes(start: string, end: string): number | null {
  if (!start || !end) return null;

  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);

  if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) return null;

  if (startMinutes === endMinutes) return 1440;

  return (endMinutes - startMinutes + 1440) % 1440;
}

interface Props {
  onClose: () => void;
  onChanged: () => void;
}

export default function ShiftManagerModal({ onClose, onChanged }: Props) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const durationPreview = previewDurationMinutes(
    form.start_time,
    form.end_time,
  );

  /** Refresh used after a save or delete, where a spinner is wanted. */
  async function reloadShifts() {
    setIsLoading(true);

    try {
      const data = await shiftService.listAll();

      setShifts(data);
      setError("");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load shifts.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;

    // Handlers live in promise callbacks rather than in the effect body, so
    // no state is set synchronously on mount.
    shiftService
      .listAll()
      .then((data) => {
        if (!isCurrent) return;

        setShifts(data);
        setError("");
      })
      .catch((err: unknown) => {
        if (!isCurrent) return;

        setError(
          err instanceof ApiError ? err.message : "Failed to load shifts.",
        );
      })
      .finally(() => {
        if (!isCurrent) return;

        setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setIsFormOpen(true);
  }

  function openEdit(shift: Shift) {
    setEditingId(shift.id);
    setForm({
      name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      grace_period_minutes: shift.grace_period_minutes ?? 15,
      is_active: shift.is_active,
      notes: shift.notes ?? "",
    });
    setFormError("");
    setIsFormOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setFormError("Shift name is required");
      return;
    }

    if (!form.start_time || !form.end_time) {
      setFormError("Both start and end time are required");
      return;
    }

    setIsSaving(true);
    setFormError("");

    const payload = {
      name: form.name.trim(),
      start_time: form.start_time,
      end_time: form.end_time,
      grace_period_minutes: Number(form.grace_period_minutes) || 0,
      is_active: form.is_active,
      notes: form.notes.trim() || null,
    };

    try {
      if (editingId) {
        await shiftService.update(editingId, payload);
      } else {
        await shiftService.create(payload);
      }

      setIsFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);

      await reloadShifts();
      onChanged();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Failed to save shift.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(shift: Shift) {
    setFormError("");
    setDeletingId(shift.id);

    try {
      await shiftService.remove(shift.id);

      await reloadShifts();
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to delete shift.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded bg-white shadow-lg">
        <div className="flex items-start justify-between border-b border-gray-100 p-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Manage Shifts</h2>
            <p className="mt-1 text-sm text-gray-500">
              Overtime is worked time beyond the shift length. Shifts ending
              after midnight are handled automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded bg-rose-50 p-3 text-sm text-rose-600">
              {error}
            </div>
          )}

          {isLoading ? (
            <p className="py-8 text-center text-sm text-gray-500">
              Loading shifts...
            </p>
          ) : shifts.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              No shifts yet. Add your first shift to start tracking overtime.
            </p>
          ) : (
            <ul className="space-y-3">
              {shifts.map((shift) => (
                <li
                  key={shift.id}
                  className={`rounded border p-4 ${shift.is_active
                    ? "border-gray-100"
                    : "border-gray-100 bg-gray-50 opacity-70"
                    }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {shift.name}
                        </span>
                        {shift.is_overnight && (
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-600">
                            Ends next day
                          </span>
                        )}
                        {!shift.is_active && (
                          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                            Inactive
                          </span>
                        )}
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600">
                          {formatDuration(shift.duration_minutes)}
                        </span>
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          {shift.grace_period_minutes ?? 15}m grace
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-gray-600">
                        {formatShiftTime(shift.start_time)} -{" "}
                        {formatShiftTime(shift.end_time)}
                      </p>

                      <p className="mt-0.5 text-xs text-gray-500">
                        {shift.assigned_employee_count} employee
                        {shift.assigned_employee_count === 1 ? "" : "s"}{" "}
                        assigned
                      </p>

                      {shift.notes && (
                        <p className="mt-1 text-xs text-gray-500">
                          {shift.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(shift)}
                        className="rounded p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                        aria-label={`Edit ${shift.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(shift)}
                        disabled={deletingId === shift.id}
                        className="rounded p-2 text-gray-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                        aria-label={`Delete ${shift.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-100 p-6">
          {isFormOpen ? (
            <div className="space-y-4">
              {formError && (
                <div className="rounded bg-rose-50 p-3 text-sm text-rose-600">
                  {formError}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Shift name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Part-time"
                  className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Start time
                  </label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        start_time: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    End time
                  </label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        end_time: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                  />
                </div>
              </div>

              {durationPreview !== null && (
                <p className="text-xs text-gray-500">
                  Shift length: {formatDuration(durationPreview)}
                  {durationPreview >= 1440
                    ? " (a full 24 hours)"
                    : ""}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Grace period (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={form.grace_period_minutes}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        grace_period_minutes: Math.max(0, parseInt(e.target.value) || 0),
                      }))
                    }
                    placeholder="15"
                    className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    Delay allowed before marked as late
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="e.g. Regular day shift"
                    className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300"
                />
                Active
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingId(null);
                    setForm(emptyForm);
                    setFormError("");
                  }}
                  className="flex-1 rounded border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 rounded bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50"
                >
                  {isSaving
                    ? "Saving..."
                    : editingId
                      ? "Update Shift"
                      : "Add Shift"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="flex flex-1 items-center justify-center gap-2 rounded bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8]"
              >
                <Plus className="h-4 w-4" />
                Add Shift
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
