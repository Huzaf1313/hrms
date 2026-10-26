import { useState } from "react";
import {
  Settings as SettingsIcon,
  Building2,
  SlidersHorizontal,
  CalendarDays,
  Plane,
  Wallet,
  FileText,
  Pencil,
  Check,
  X,
} from "lucide-react";

import AddHolidayModal from "../../components/AddHolidayModal";

// ---- Types ------------------------------------------------------------------

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CardId = "organization" | "workingDays" | "payroll";

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
      companyName: "AarMarks Media Pvt. Ltd.",
      address: "123 Business Street, Bengaluru, KA 560001",
      contactEmail: "hr@acme.com",
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

// ---- Reusable card shell ------------------------------------------------------

interface SettingsCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

function SettingsCard({ icon, iconBg, title, children, action }: SettingsCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm flex flex-col">
      <div className="flex items-center gap-2.5 mb-4">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
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

// ---- Page -----------------------------------------------------------------

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingsData>(readSettings);
  const [draft, setDraft] = useState<SettingsData | null>(null);
  const [editingCard, setEditingCard] = useState<CardId | null>(null);
  const [notice, setNotice] = useState("");
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);

  // While editing, the draft is the source of truth for every card's inputs.
  const view = draft ?? settings;
  const isEditingOrganization = editingCard === "organization";
  const isEditingWorkingDays = editingCard === "workingDays";
  const isEditingPayroll = editingCard === "payroll";

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
    setNotice(stored ? "Settings saved" : "Saved for this session only");
    window.setTimeout(() => setNotice(""), 2500);
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

  const canSave = view.organization.companyName.trim().length > 0;

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

        {notice && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <Check className="h-3.5 w-3.5" />
            {notice}
          </span>
        )}
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

          {/* Platform Preferences */}
          <SettingsCard
            icon={<SlidersHorizontal className="h-4 w-4 text-purple-600" />}
            iconBg="bg-purple-50"
            title="Platform Preferences"
            action={
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
              >
                Save
              </button>
            }
          >
            <SelectField label="Date Format" value="DD/MM/YYYY" options={["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]} />
            <SelectField label="Time Format" value="12 Hour (AM/PM)" options={["12 Hour (AM/PM)", "24 Hour"]} />
            <SelectField label="Work Week" value="Monday - Friday" options={["Monday - Friday", "Monday - Saturday", "Sunday - Thursday"]} />
            <SelectField label="Language" value="English" options={["English", "Hindi"]} />
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
                      className={`inline-flex h-9 w-11 items-center justify-center rounded-lg text-xs font-semibold ${
                        isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
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
                    className={`inline-flex h-9 w-11 items-center justify-center rounded-lg text-xs font-semibold transition ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setIsHolidayModalOpen(true)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Manage Holidays →
            </button>
          </SettingsCard>

          {/* Leave Settings */}
          <SettingsCard
            icon={<Plane className="h-4 w-4 text-purple-600" />}
            iconBg="bg-purple-50"
            title="Leave Settings"
            action={
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
              >
                Save
              </button>
            }
          >
            <SelectField label="Leave Year" value="Calendar Year (Jan - Dec)" options={["Calendar Year (Jan - Dec)", "Fiscal Year (Apr - Mar)"]} />
            <InputField label="Carry Forward Days" value="5" hint="Max 10 days" />
            <InputField label="Default Leave Days" value="10" hint="Per year" />
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
          onClose={() => setIsHolidayModalOpen(false)}
          onSaved={() => {
            setNotice("Holiday saved");
            window.setTimeout(() => setNotice(""), 2500);
          }}
        />
      )}
    </div>
  );
}
