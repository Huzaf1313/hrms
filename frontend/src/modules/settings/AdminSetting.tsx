import { useCallback, useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Building2,
  Users2,
  CalendarDays,
  Layers,
  Wallet,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Check,
  X,
} from "lucide-react";

import AddHolidayModal from "../holidays/AddHolidayModal";
import { holidayService } from "../holidays/holidayService";
import type { Holiday } from "../holidays/types";
import { ApiError } from "../../services/api";
import NoticePopup from "../../components/ui/NoticePopup";
import { departmentService } from "../departments/departmentService";
import {
  formatDuration,
  formatShiftTime,
  shiftService,
} from "../shifts/shiftService";
import type { Shift } from "../shifts/types";
import type { Department } from "../departments/types";

// ---- Types ------------------------------------------------------------------

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CardId = "organization" | "workingDays" | "payroll";

interface ShiftForm {
  name: string;
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
  is_active: boolean;
  notes: string;
}

const emptyShiftForm: ShiftForm = {
  name: "",
  start_time: "",
  end_time: "",
  grace_period_minutes: 15,
  is_active: true,
  notes: "",
};

interface DepartmentForm {
  name: string;
  description: string;
}

const emptyDepartmentForm: DepartmentForm = {
  name: "",
  description: "",
};

interface SettingsData {
  organization: {
    companyName: string;
    address: string;
    contactEmail: string;
    phoneNumber: string;
  };
  workingDays: string[];
  payroll: {
    payrollCycle: string;
    paymentDate: string;
  };
}

const STORAGE_KEY = "hrms_settings";

function freshDefaults(): SettingsData {
  return {
    organization: {
      companyName: "PeopleSync Technologies Pvt. Ltd.",
      address: "123 Business Street, Bengaluru, KA 560001",
      contactEmail: "hr@peoplesync.io",
      phoneNumber: "+91 98765 43210",
    },
    workingDays: ["Wed", "Thu", "Fri"],
    payroll: {
      payrollCycle: "Monthly",
      paymentDate: "1",
    },
  };
}

function readSettings(): SettingsData {
  const defaults = freshDefaults();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw) as Partial<SettingsData>;

    return {
      organization: { ...defaults.organization, ...(parsed.organization ?? {}) },
      workingDays: Array.isArray(parsed.workingDays) ? parsed.workingDays : defaults.workingDays,
      payroll: { ...defaults.payroll, ...(parsed.payroll ?? {}) },
    };
  } catch {
    return defaults;
  }
}

function writeSettings(data: SettingsData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    return true;
  } catch {
    return false;
  }
}

/** Mirrors the backend's shift_duration_minutes so the admin sees the length
 *  before saving, including the wrap past midnight for a night shift. */
function previewShiftDurationMinutes(start: string, end: string): number | null {
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

// ---- Reusable card shell ------------------------------------------------------

interface SettingsCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  headerAction?: React.ReactNode;
}

function SettingsCard({ icon, iconBg, title, children, action, headerAction }: SettingsCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm flex flex-col">
      <div className="flex items-center gap-2.5 mb-4">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {headerAction && <div className="ml-auto">{headerAction}</div>}
      </div>

      <div className="flex-1">{children}</div>

      {action && <div className="mt-4 flex justify-end">{action}</div>}
    </div>
  );
}

/** Pencil button while read-only, Save/Cancel while editing. */
function EditActions({
  editing,
  onEdit,
  onSave,
  onCancel,
  canSave = true,
}: {
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  canSave?: boolean;
}) {
  if (!editing) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
      >
        <X className="h-3.5 w-3.5" />
        Cancel
      </button>

      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" />
        Save
      </button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange?: (value: string) => void;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <select
        value={onChange ? value : undefined}
        defaultValue={onChange ? undefined : value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      >
        {options.map((opt) => (
          <option key={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function InputField({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  hint?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <label className="block text-xs text-slate-400 mb-1">
        {label} {hint && <span className="text-slate-300">({hint})</span>}
      </label>
      <input
        value={onChange ? value : undefined}
        defaultValue={onChange ? undefined : value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      />
    </div>
  );
}

// ---- View All popup ---------------------------------------------------------

interface ViewAllModalProps {
  icon: React.ReactNode;
  title: string;
  countLabel: string;
  subtitle: string;
  summary: string;
  onClose: () => void;
  children: React.ReactNode;
}

function ViewAllModal({ icon, title, countLabel, subtitle, summary, onClose, children }: ViewAllModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-lg">
        <div className="flex items-start justify-between border-b border-gray-100 p-6">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg">{icon}</span>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
                  {countLabel}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">{children}</div>

        <div className="flex items-center justify-between border-t border-gray-100 p-6">
          <p className="text-xs font-medium text-gray-500">{summary}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="font-semibold text-gray-800">{value}</dd>
    </div>
  );
}

interface ShiftDetailItemProps {
  shift: Shift;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function ShiftDetailItem({ shift, index, onEdit, onDelete, isDeleting }: ShiftDetailItemProps) {
  return (
    <div
      className={`rounded-2xl border border-l-4 border-gray-100 border-l-violet-300 p-4 shadow-sm transition hover:shadow-md ${shift.is_active ? "" : "bg-gray-50 opacity-70"
        }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-[11px] font-semibold text-gray-400">
          {String(index).padStart(2, "0")}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
          <Users2 className="h-4 w-4 text-violet-600" />
        </span>
        <span className="font-semibold text-gray-900">{shift.name}</span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
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
          <div className="ml-1 flex gap-1">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${shift.name}`}
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              aria-label={`Delete ${shift.name}`}
              className="rounded-full p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
        <DetailRow label="Start Time" value={formatShiftTime(shift.start_time)} />
        <DetailRow label="End Time" value={formatShiftTime(shift.end_time)} />
        <DetailRow
          label="Shift Length"
          value={formatDuration(shift.duration_minutes)}
        />
        <DetailRow
          label="Assigned Employees"
          value={String(shift.assigned_employee_count)}
        />
      </dl>

      {shift.notes && (
        <p className="mt-2 text-xs italic text-gray-500">{shift.notes}</p>
      )}
    </div>
  );
}

interface DepartmentDetailItemProps {
  department: Department;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function DepartmentDetailItem({
  department,
  index,
  onEdit,
  onDelete,
  isDeleting,
}: DepartmentDetailItemProps) {
  return (
    <div className="rounded-2xl border border-l-4 border-gray-100 border-l-blue-300 p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-2.5">
        <span className="text-[11px] font-semibold text-gray-400">
          {String(index).padStart(2, "0")}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
          <Layers className="h-4 w-4 text-blue-600" />
        </span>
        <span className="min-w-0 font-semibold text-gray-900">
          {department.name}
        </span>
        <div className="ml-auto flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${department.name}`}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            aria-label={`Delete ${department.name}`}
            className="rounded-full p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <dl className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
        <DetailRow
          label="Description"
          value={department.description ?? "-"}
        />
      </dl>
    </div>
  );
}

// ---- Page -----------------------------------------------------------------

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingsData>(readSettings);
  const [draft, setDraft] = useState<SettingsData | null>(null);
  const [editingCard, setEditingCard] = useState<CardId | null>(null);
  const [notice, setNotice] = useState("");
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [shiftError, setShiftError] = useState("");
  const [shiftFormError, setShiftFormError] = useState("");
  const [shiftSaving, setShiftSaving] = useState(false);
  const [isShiftFormOpen, setIsShiftFormOpen] = useState(false);
  const [shiftEditingId, setShiftEditingId] = useState<string | null>(null);
  const [shiftForm, setShiftForm] = useState<ShiftForm>(emptyShiftForm);
  const [shiftDeletingId, setShiftDeletingId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [departmentError, setDepartmentError] = useState("");
  const [departmentFormError, setDepartmentFormError] = useState("");
  const [departmentSaving, setDepartmentSaving] = useState(false);
  const [isDepartmentFormOpen, setIsDepartmentFormOpen] = useState(false);
  const [departmentEditingId, setDepartmentEditingId] = useState<string | null>(
    null,
  );
  const [departmentForm, setDepartmentForm] = useState<DepartmentForm>(
    emptyDepartmentForm,
  );
  const [departmentDeletingId, setDepartmentDeletingId] = useState<
    string | null
  >(null);
  const [isShiftDetailModalOpen, setIsShiftDetailModalOpen] = useState(false);
  const [isDepartmentDetailModalOpen, setIsDepartmentDetailModalOpen] =
    useState(false);

  // While editing, the draft is the source of truth for every card's inputs.
  const view = draft ?? settings;
  const isEditingOrganization = editingCard === "organization";
  const isEditingWorkingDays = editingCard === "workingDays";
  const isEditingPayroll = editingCard === "payroll";

  const shiftDurationPreview = previewShiftDurationMinutes(
    shiftForm.start_time,
    shiftForm.end_time,
  );

  useEffect(() => {
    let isCurrent = true;

    shiftService
      .listAll()
      .then((data) => {
        if (!isCurrent) return;

        setShifts(data);
        setShiftError("");
      })
      .catch((err: unknown) => {
        if (!isCurrent) return;

        setShiftError(
          err instanceof ApiError ? err.message : "Failed to load shifts.",
        );
      })
      .finally(() => {
        if (!isCurrent) return;

        setShiftsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    departmentService
      .listAll()
      .then((data) => {
        if (!isCurrent) return;

        setDepartments(data);
        setDepartmentError("");
      })
      .catch((err: unknown) => {
        if (!isCurrent) return;

        setDepartmentError(
          err instanceof ApiError ? err.message : "Failed to load departments.",
        );
      })
      .finally(() => {
        if (!isCurrent) return;

        setDepartmentsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const loadHolidays = useCallback(async () => {
    try {
      setHolidaysLoading(true);
      const data = await holidayService.list();
      setHolidays(data);
    } catch {
      // ignore
    } finally {
      setHolidaysLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHolidays();
  }, [loadHolidays]);

  async function deleteHoliday(id: string, name: string) {
    if (!window.confirm(`Are you sure you want to delete holiday "${name}"?`)) {
      return;
    }
    try {
      await holidayService.remove(id);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      showNotice("Holiday deleted successfully");
    } catch (err) {
      showNotice(err instanceof ApiError ? err.message : "Failed to delete holiday");
    }
  }

  function showNotice(message: string) {
    setNotice(message);
  }

  function startEdit(card: CardId) {
    setDraft(settings);
    setEditingCard(card);
    setNotice("");
  }

  function cancelEdit() {
    setDraft(null);
    setEditingCard(null);
  }

  function saveEdit() {
    if (!draft) {
      return;
    }

    setSettings(draft);
    const stored = writeSettings(draft);

    cancelEdit();
    showNotice(stored ? "Settings saved" : "Saved for this session only");
  }

  function toggleDay(day: string) {
    if (!draft) {
      return;
    }

    setDraft({
      ...draft,
      workingDays: draft.workingDays.includes(day)
        ? draft.workingDays.filter((item) => item !== day)
        : [...draft.workingDays, day],
    });
  }

  function updateOrganization(key: keyof SettingsData["organization"], value: string) {
    if (!draft) {
      return;
    }

    setDraft({ ...draft, organization: { ...draft.organization, [key]: value } });
  }

  function updatePayroll(key: keyof SettingsData["payroll"], value: string) {
    if (!draft) {
      return;
    }

    setDraft({ ...draft, payroll: { ...draft.payroll, [key]: value } });
  }

  async function reloadShifts() {
    setShiftsLoading(true);

    try {
      const data = await shiftService.listAll();

      setShifts(data);
      setShiftError("");
    } catch (err) {
      setShiftError(
        err instanceof ApiError ? err.message : "Failed to load shifts.",
      );
    } finally {
      setShiftsLoading(false);
    }
  }

  function updateShiftForm(key: keyof ShiftForm, value: string | boolean | number) {
    setShiftForm((prev) => ({ ...prev, [key]: value }));
  }

  function openShiftCreate() {
    setShiftEditingId(null);
    setShiftForm(emptyShiftForm);
    setShiftFormError("");
    setIsShiftFormOpen(true);
  }

  function openShiftEdit(shift: Shift) {
    setShiftEditingId(shift.id);
    setShiftForm({
      name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      grace_period_minutes: shift.grace_period_minutes ?? 15,
      is_active: shift.is_active,
      notes: shift.notes ?? "",
    });
    setShiftFormError("");
    setIsShiftFormOpen(true);
  }

  function closeShiftForm() {
    setIsShiftFormOpen(false);
    setShiftEditingId(null);
    setShiftForm(emptyShiftForm);
    setShiftFormError("");
  }

  async function saveShift() {
    if (!shiftForm.name.trim()) {
      setShiftFormError("Shift name is required");
      return;
    }

    if (!shiftForm.start_time || !shiftForm.end_time) {
      setShiftFormError("Both start and end time are required");
      return;
    }

    setShiftSaving(true);
    setShiftFormError("");

    const payload = {
      name: shiftForm.name.trim(),
      start_time: shiftForm.start_time,
      end_time: shiftForm.end_time,
      grace_period_minutes: Number(shiftForm.grace_period_minutes) || 0,
      is_active: shiftForm.is_active,
      notes: shiftForm.notes.trim() || null,
    };

    try {
      if (shiftEditingId) {
        await shiftService.update(shiftEditingId, payload);
      } else {
        await shiftService.create(payload);
      }

      const wasEditing = Boolean(shiftEditingId);

      closeShiftForm();
      await reloadShifts();
      showNotice(wasEditing ? "Shift updated" : "Shift saved");
    } catch (err) {
      setShiftFormError(
        err instanceof ApiError ? err.message : "Failed to save shift.",
      );
    } finally {
      setShiftSaving(false);
    }
  }

  async function deleteShift(shift: Shift) {
    setShiftError("");
    setShiftDeletingId(shift.id);

    try {
      await shiftService.remove(shift.id);

      await reloadShifts();
      showNotice("Shift deleted");
    } catch (err) {
      setShiftError(
        err instanceof ApiError
          ? err.message
          : "Failed to delete shift.",
      );
    } finally {
      setShiftDeletingId(null);
    }
  }

  async function reloadDepartments() {
    setDepartmentsLoading(true);

    try {
      const data = await departmentService.listAll();

      setDepartments(data);
      setDepartmentError("");
    } catch (err) {
      setDepartmentError(
        err instanceof ApiError ? err.message : "Failed to load departments.",
      );
    } finally {
      setDepartmentsLoading(false);
    }
  }

  function updateDepartmentForm(key: keyof DepartmentForm, value: string) {
    setDepartmentForm((prev) => ({ ...prev, [key]: value }));
  }

  function openDepartmentCreate() {
    setDepartmentEditingId(null);
    setDepartmentForm(emptyDepartmentForm);
    setDepartmentFormError("");
    setIsDepartmentFormOpen(true);
  }

  function openDepartmentEdit(department: Department) {
    setDepartmentEditingId(department.id);
    setDepartmentForm({
      name: department.name,
      description: department.description ?? "",
    });
    setDepartmentFormError("");
    setIsDepartmentFormOpen(true);
  }

  function closeDepartmentForm() {
    setIsDepartmentFormOpen(false);
    setDepartmentEditingId(null);
    setDepartmentForm(emptyDepartmentForm);
    setDepartmentFormError("");
  }

  async function saveDepartment() {
    if (departmentForm.name.trim().length < 2) {
      setDepartmentFormError("Department name is required");
      return;
    }

    setDepartmentSaving(true);
    setDepartmentFormError("");

    const payload = {
      name: departmentForm.name.trim(),
      description: departmentForm.description.trim() || undefined,
    };

    try {
      if (departmentEditingId) {
        await departmentService.update(departmentEditingId, payload);
      } else {
        await departmentService.create(payload);
      }

      const wasEditing = Boolean(departmentEditingId);

      closeDepartmentForm();
      await reloadDepartments();
      showNotice(wasEditing ? "Department updated" : "Department saved");
    } catch (err) {
      setDepartmentFormError(
        err instanceof ApiError ? err.message : "Failed to save department.",
      );
    } finally {
      setDepartmentSaving(false);
    }
  }

  async function deleteDepartment(department: Department) {
    setDepartmentError("");
    setDepartmentDeletingId(department.id);

    try {
      await departmentService.remove(department.id);

      await reloadDepartments();
      showNotice("Department deleted");
    } catch (err) {
      setDepartmentError(
        err instanceof ApiError
          ? err.message
          : "Failed to delete department.",
      );
    } finally {
      setDepartmentDeletingId(null);
    }
  }

  const canSave = view.organization.companyName.trim().length > 0;

  const shiftFormView = (
    <div className="space-y-3">
      {shiftFormError && (
        <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-600">
          {shiftFormError}
        </div>
      )}

      <InputField
        label="Shift Name"
        value={shiftForm.name}
        onChange={(value) => updateShiftForm("name", value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Start Time
          </label>
          <input
            type="time"
            value={shiftForm.start_time}
            onChange={(event) =>
              updateShiftForm("start_time", event.target.value)
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            End Time
          </label>
          <input
            type="time"
            value={shiftForm.end_time}
            onChange={(event) =>
              updateShiftForm("end_time", event.target.value)
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      </div>

      {shiftDurationPreview !== null && (
        <p className="text-xs text-slate-500">
          Shift length: {formatDuration(shiftDurationPreview)}
          {shiftDurationPreview >= 1440 ? " (a full 24 hours)" : ""}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Grace Period (minutes)
          </label>
          <input
            type="number"
            min="0"
            max="120"
            value={shiftForm.grace_period_minutes}
            onChange={(event) =>
              updateShiftForm(
                "grace_period_minutes",
                Math.max(0, parseInt(event.target.value) || 0)
              )
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <div>
          <InputField
            label="Notes (optional)"
            value={shiftForm.notes}
            onChange={(value) => updateShiftForm("notes", value)}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={shiftForm.is_active}
          onChange={(event) =>
            updateShiftForm("is_active", event.target.checked)
          }
          className="rounded border-slate-300"
        />
        Active
      </label>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={closeShiftForm}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={saveShift}
          disabled={shiftSaving}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          {shiftSaving
            ? "Saving..."
            : shiftEditingId
              ? "Update Shift"
              : "Add Shift"}
        </button>
      </div>
    </div>
  );

  const departmentFormView = (
    <div className="space-y-3">
      {departmentFormError && (
        <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-600">
          {departmentFormError}
        </div>
      )}

      <InputField
        label="Department Name"
        value={departmentForm.name}
        onChange={(value) => updateDepartmentForm("name", value)}
      />

      <InputField
        label="Description (optional)"
        value={departmentForm.description}
        onChange={(value) => updateDepartmentForm("description", value)}
      />

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={closeDepartmentForm}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={saveDepartment}
          disabled={departmentSaving}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          {departmentSaving
            ? "Saving..."
            : departmentEditingId
              ? "Update Department"
              : "Add Department"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 shrink-0">
          <SettingsIcon className="h-5 w-5 text-white" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your HRMS platform settings and preferences.
          </p>
        </div>

        {/* Fixed-position, so where it sits in the header does not matter.
            It closes itself; showNotice no longer needs a timer. */}
        <NoticePopup
          notice={notice ? { type: "success", text: notice } : null}
          onDismiss={() => setNotice("")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Organization Details */}
        <SettingsCard
          icon={<Building2 className="h-4 w-4 text-blue-600" />}
          iconBg="bg-blue-50"
          title="Organization Details"
          action={
            <EditActions
              editing={isEditingOrganization}
              onEdit={() => startEdit("organization")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              canSave={canSave}
            />
          }
        >
          {isEditingOrganization ? (
            <>
              <InputField
                label="Company Name"
                value={view.organization.companyName}
                onChange={(value) => updateOrganization("companyName", value)}
              />
              <InputField
                label="Address"
                value={view.organization.address}
                onChange={(value) => updateOrganization("address", value)}
              />
              <InputField
                label="Contact Email"
                value={view.organization.contactEmail}
                onChange={(value) => updateOrganization("contactEmail", value)}
              />
              <InputField
                label="Phone Number"
                value={view.organization.phoneNumber}
                onChange={(value) => updateOrganization("phoneNumber", value)}
              />
            </>
          ) : (
            <>
              <Field label="Company Name" value={view.organization.companyName} />
              <Field label="Address" value={view.organization.address} />
              <Field label="Contact Email" value={view.organization.contactEmail} />
              <Field label="Phone Number" value={view.organization.phoneNumber} />
            </>
          )}
        </SettingsCard>

        {/* Shift Management */}
        <SettingsCard
          icon={<Users2 className="h-4 w-4 text-violet-600" />}
          iconBg="bg-violet-50"
          title="Shift Management"
          headerAction={
            !isShiftFormOpen && shifts.length > 0 ? (
              <button
                type="button"
                onClick={() => setIsShiftDetailModalOpen(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                View All →
              </button>
            ) : undefined
          }
          action={
            isShiftFormOpen ? undefined : (
              <button
                type="button"
                onClick={openShiftCreate}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Shift
              </button>
            )
          }
        >
          {isShiftFormOpen && !isShiftDetailModalOpen ? (
            shiftFormView
          ) : (
            <div className="h-[192px] overflow-y-auto pr-1">
              {shiftsLoading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-slate-500">Loading shifts...</p>
                </div>
              ) : shiftError ? (
                <div className="flex h-full items-center justify-center px-4">
                  <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-600">
                    {shiftError}
                  </div>
                </div>
              ) : shifts.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-slate-500">
                    No shifts yet. Add your first shift to start tracking
                    overtime.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {shifts.slice(0, 2).map((shift) => (
                    <li
                      key={shift.id}
                      className={`rounded-xl border border-slate-100 p-3 ${shift.is_active ? "bg-white" : "bg-slate-50 opacity-70"
                        }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold text-slate-900">
                              {shift.name}
                            </span>
                            {shift.is_overnight && (
                              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-600">
                                Ends next day
                              </span>
                            )}
                            {!shift.is_active && (
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
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

                          <p className="mt-0.5 text-xs text-slate-600">
                            {formatShiftTime(shift.start_time)} -{" "}
                            {formatShiftTime(shift.end_time)}
                          </p>

                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {shift.assigned_employee_count} employee
                            {shift.assigned_employee_count === 1 ? "" : "s"}{" "}
                            assigned
                          </p>

                          {shift.notes && (
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {shift.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => openShiftEdit(shift)}
                            aria-label={`Edit ${shift.name}`}
                            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteShift(shift)}
                            disabled={shiftDeletingId === shift.id}
                            aria-label={`Delete ${shift.name}`}
                            className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </SettingsCard>

        {/* Working Days & Holidays */}
        <SettingsCard
          icon={<CalendarDays className="h-4 w-4 text-blue-600" />}
          iconBg="bg-blue-50"
          title="Working Days & Holidays"
          action={
            <EditActions
              editing={isEditingWorkingDays}
              onEdit={() => startEdit("workingDays")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              canSave={canSave}
            />
          }
        >
          <p className="text-xs text-slate-400 mb-2">Work Week</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {weekDays.map((day) => {
              const isSelected = view.workingDays.includes(day);

              if (!isEditingWorkingDays) {
                return (
                  <span
                    key={day}
                    className={`inline-flex h-9 w-11 items-center justify-center rounded-lg text-xs font-semibold ${isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                      }`}
                  >
                    {day}
                  </span>
                );
              }

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  aria-pressed={isSelected}
                  className={`inline-flex h-9 w-11 items-center justify-center rounded-lg text-xs font-semibold transition ${isSelected
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Holidays ({holidays.length})
                </h4>
                <p className="text-[11px] text-slate-400">
                  Public, company, optional, & department-specific holidays
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingHoliday(null);
                  setIsHolidayModalOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Holiday
              </button>
            </div>

            {holidaysLoading ? (
              <p className="py-3 text-center text-xs text-slate-400">Loading holidays...</p>
            ) : holidays.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center">
                <CalendarDays className="mx-auto h-6 w-6 text-slate-300" />
                <p className="mt-1 text-xs text-slate-500">No holidays scheduled yet.</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingHoliday(null);
                    setIsHolidayModalOpen(true);
                  }}
                  className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                >
                  + Add your first holiday
                </button>
              </div>
            ) : (
              <div className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50">
                {holidays.map((h) => {
                  const badgeStyles: Record<string, string> = {
                    public: "bg-emerald-50 text-emerald-700 border-emerald-100",
                    company: "bg-blue-50 text-blue-700 border-blue-100",
                    optional: "bg-purple-50 text-purple-700 border-purple-100",
                    restricted: "bg-amber-50 text-amber-700 border-amber-100",
                  };
                  const badgeStyle = badgeStyles[h.type] ?? "bg-slate-100 text-slate-600 border-slate-200";

                  return (
                    <div
                      key={h.id}
                      className="flex items-center justify-between px-3.5 py-2.5 text-xs transition hover:bg-white"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-slate-800">{h.name}</span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${badgeStyle}`}
                          >
                            {h.type}
                          </span>
                          {h.department_name ? (
                            <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                              Dept: {h.department_name}
                            </span>
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-400">
                              All Depts
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {new Date(h.date).toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {h.description ? ` • ${h.description}` : ""}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingHoliday(h);
                            setIsHolidayModalOpen(true);
                          }}
                          title="Edit holiday"
                          aria-label={`Edit ${h.name}`}
                          className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteHoliday(h.id, h.name)}
                          title="Delete holiday"
                          aria-label={`Delete ${h.name}`}
                          className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SettingsCard>

        {/* Department Management */}
        <SettingsCard
          icon={<Layers className="h-4 w-4 text-blue-600" />}
          iconBg="bg-blue-50"
          title="Department Management"
          headerAction={
            !isDepartmentFormOpen && departments.length > 0 ? (
              <button
                type="button"
                onClick={() => setIsDepartmentDetailModalOpen(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                View All →
              </button>
            ) : undefined
          }
          action={
            isDepartmentFormOpen ? undefined : (
              <button
                type="button"
                onClick={openDepartmentCreate}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Department
              </button>
            )
          }
        >
          {isDepartmentFormOpen && !isDepartmentDetailModalOpen ? (
            departmentFormView
          ) : (
            <div className="h-[192px] overflow-y-auto pr-1">
              {departmentsLoading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-slate-500">
                    Loading departments...
                  </p>
                </div>
              ) : departmentError ? (
                <div className="flex h-full items-center justify-center px-4">
                  <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-600">
                    {departmentError}
                  </div>
                </div>
              ) : departments.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-slate-500">
                    No departments yet. Add your first department to organize
                    employees.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {departments.slice(0, 2).map((department) => (
                    <li
                      key={department.id}
                      className="rounded-xl border border-slate-100 p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-slate-900">
                            {department.name}
                          </span>

                          {department.description && (
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {department.description}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => openDepartmentEdit(department)}
                            aria-label={`Edit ${department.name}`}
                            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteDepartment(department)}
                            disabled={departmentDeletingId === department.id}
                            aria-label={`Delete ${department.name}`}
                            className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </SettingsCard>

        {/* Payroll Settings */}
        <SettingsCard
          icon={<Wallet className="h-4 w-4 text-blue-600" />}
          iconBg="bg-blue-50"
          title="Payroll Settings"
          action={
            <EditActions
              editing={isEditingPayroll}
              onEdit={() => startEdit("payroll")}
              onSave={saveEdit}
              onCancel={cancelEdit}
              canSave={canSave}
            />
          }
        >
          {isEditingPayroll ? (
            <>
              <SelectField
                label="Payroll Cycle"
                value={view.payroll.payrollCycle}
                options={["Monthly", "Bi-Weekly", "Weekly"]}
                onChange={(value) => updatePayroll("payrollCycle", value)}
              />
              <InputField
                label="Payment Date"
                value={view.payroll.paymentDate}
                onChange={(value) => updatePayroll("paymentDate", value)}
              />
            </>
          ) : (
            <>
              <Field label="Payroll Cycle" value={view.payroll.payrollCycle} />
              <Field label="Payment Date" value={view.payroll.paymentDate} />
            </>
          )}
        </SettingsCard>

        {/* Document Settings */}
        <SettingsCard
          icon={<FileText className="h-4 w-4 text-purple-600" />}
          iconBg="bg-purple-50"
          title="Document Settings"
          action={
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              Save
            </button>
          }
        >
          <Field label="Allowed File Types" value="PDF, DOC, DOCX, XLS, XLSX, JPG, PNG" />
          <Field label="Max File Size" value="10 MB" />
        </SettingsCard>
      </div>

      {/* Mounted only while open, so the form always starts blank. */}
      {isHolidayModalOpen && (
        <AddHolidayModal
          holiday={editingHoliday}
          onClose={() => {
            setIsHolidayModalOpen(false);
            setEditingHoliday(null);
          }}
          onSaved={() => {
            setIsHolidayModalOpen(false);
            setEditingHoliday(null);
            void loadHolidays();
            showNotice(editingHoliday ? "Holiday updated" : "Holiday saved");
          }}
        />
      )}

      {isShiftDetailModalOpen && (
        <ViewAllModal
          icon={<Users2 className="h-4 w-4 text-violet-600" />}
          title="All Shifts"
          countLabel={`${shifts.length}`}
          subtitle={`${shifts.length} shift${shifts.length === 1 ? "" : "s"} configured`}
          summary={`Showing all ${shifts.length} shift${shifts.length === 1 ? "" : "s"}`}
          onClose={() => setIsShiftDetailModalOpen(false)}
        >
          {isShiftFormOpen ? (
            shiftFormView
          ) : shifts.length === 0 ? (
            <div className="flex min-h-[160px] items-center justify-center text-sm text-gray-500">
              No shifts yet. Add your first shift to start tracking overtime.
            </div>
          ) : (
            shifts.map((shift, index) => (
              <ShiftDetailItem
                key={shift.id}
                shift={shift}
                index={index + 1}
                onEdit={() => openShiftEdit(shift)}
                onDelete={() => deleteShift(shift)}
                isDeleting={shiftDeletingId === shift.id}
              />
            ))
          )}
        </ViewAllModal>
      )}

      {isDepartmentDetailModalOpen && (
        <ViewAllModal
          icon={<Layers className="h-4 w-4 text-blue-600" />}
          title="All Departments"
          countLabel={`${departments.length}`}
          subtitle={`${departments.length} department${departments.length === 1 ? "" : "s"}`}
          summary={`Showing all ${departments.length} department${departments.length === 1 ? "" : "s"}`}
          onClose={() => setIsDepartmentDetailModalOpen(false)}
        >
          {isDepartmentFormOpen ? (
            departmentFormView
          ) : departments.length === 0 ? (
            <div className="flex min-h-[160px] items-center justify-center text-sm text-gray-500">
              No departments yet. Add your first department to organize
              employees.
            </div>
          ) : (
            departments.map((department, index) => (
              <DepartmentDetailItem
                key={department.id}
                department={department}
                index={index + 1}
                onEdit={() => openDepartmentEdit(department)}
                onDelete={() => deleteDepartment(department)}
                isDeleting={departmentDeletingId === department.id}
              />
            ))
          )}
        </ViewAllModal>
      )}
    </div>
  );
}
