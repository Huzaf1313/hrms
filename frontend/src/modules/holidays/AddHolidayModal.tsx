import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { ApiError } from "../../services/api";
import { holidayService } from "./holidayService";
import { departmentService } from "../departments/departmentService";
import type { Department } from "../departments/types";
import {
  HOLIDAY_TYPE_LABELS,
  type Holiday,
  type HolidayType,
} from "./types";

interface AddHolidayModalProps {
  onClose: () => void;
  /** Prefills the date field from the day clicked in the calendar. */
  initialDate?: string;
  /** Present when editing an existing holiday rather than creating one. */
  holiday?: Holiday | null;
  /** Called after a successful create, update or delete. */
  onSaved: () => void;
}

const holidayTypes = Object.keys(HOLIDAY_TYPE_LABELS) as HolidayType[];

/** The parent mounts this with a fresh key on every open, so seeding state from
 *  props in the initialisers gives a blank form each time without an effect. */
function AddHolidayModal({
  onClose,
  initialDate,
  holiday,
  onSaved,
}: AddHolidayModalProps) {
  const isEditing = Boolean(holiday);

  const [name, setName] = useState(holiday?.name ?? "");
  const [date, setDate] = useState(holiday?.date ?? initialDate ?? "");
  const [type, setType] = useState<HolidayType>(holiday?.type ?? "public");
  const [description, setDescription] = useState(holiday?.description ?? "");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState(holiday?.department_id ?? "");

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    departmentService.list().then(setDepartments).catch(() => {});
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Holiday name is required.");
      return;
    }

    if (!date) {
      setError("Please choose a date for this holiday.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const selectedDept = departments.find((d) => d.id === departmentId);
      const departmentName = selectedDept ? selectedDept.name : null;

      if (holiday) {
        await holidayService.update(holiday.id, {
          name: trimmedName,
          date,
          type,
          department_id: departmentId || null,
          department_name: departmentName,
          // Sent even when blank, which is what clears a saved description.
          description: description.trim() || null,
        });
      } else {
        await holidayService.create({
          name: trimmedName,
          date,
          type,
          department_id: departmentId || null,
          department_name: departmentName,
          description: description.trim() || null,
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : `Failed to ${holiday ? "update" : "create"} the holiday. Please try again.`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!holiday) return;

    try {
      setIsDeleting(true);
      setError(null);

      await holidayService.remove(holiday.id);

      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to delete the holiday. Please try again.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-[#17213a]">
              {isEditing ? "Edit Holiday" : "Add Holiday"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {isEditing
                ? "Update this holiday. Employees see the change on their attendance calendar."
                : "Mark a non-working day. It appears on every employee's attendance calendar."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded text-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-6">
            <div>
              <label
                htmlFor="holiday-name"
                className="text-sm font-semibold text-gray-700"
              >
                Holiday Name <span className="text-red-500">*</span>
              </label>

              <input
                id="holiday-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                placeholder="e.g. Independence Day"
                className="mt-2 w-full rounded border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15"
              />
            </div>

            <div>
              <label
                htmlFor="holiday-date"
                className="text-sm font-semibold text-gray-700"
              >
                Date <span className="text-red-500">*</span>
              </label>

              <input
                id="holiday-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-2 w-full rounded border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15"
              />
            </div>

            <div>
              <label
                htmlFor="holiday-type"
                className="text-sm font-semibold text-gray-700"
              >
                Type
              </label>

              <select
                id="holiday-type"
                value={type}
                onChange={(event) =>
                  setType(event.target.value as HolidayType)
                }
                className="mt-2 w-full rounded border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15"
              >
                {holidayTypes.map((option) => (
                  <option key={option} value={option}>
                    {HOLIDAY_TYPE_LABELS[option]}
                  </option>
                ))}
              </select>

              <p className="mt-1.5 text-xs text-gray-400">
                The type sets the colour this day uses on the employee
                calendar.
              </p>
            </div>

            <div>
              <label
                htmlFor="holiday-dept"
                className="text-sm font-semibold text-gray-700"
              >
                Applicable Department
              </label>

              <select
                id="holiday-dept"
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
                className="mt-2 w-full rounded border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15"
              >
                <option value="">All Departments (Organization-wide)</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>

              <p className="mt-1.5 text-xs text-gray-400">
                Leave as All Departments for company-wide holidays.
              </p>
            </div>

            <div>
              <label
                htmlFor="holiday-description"
                className="text-sm font-semibold text-gray-700"
              >
                Description
              </label>

              <textarea
                id="holiday-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Optional note shown as a tooltip on the calendar"
                className="mt-2 w-full resize-y rounded border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded bg-red-50 px-3 py-2.5 text-sm text-red-600"
              >
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4">
            {holiday ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving || isDeleting}
                className="rounded bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving
                  ? "Saving..."
                  : isEditing
                    ? "Save Changes"
                    : "Add Holiday"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddHolidayModal;