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
} from "lucide-react";

// ---- Types ------------------------------------------------------------------

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function SelectField({ label, value, options }: { label: string; value: string; options: string[] }) {
  return (
    <div className="mb-3 last:mb-0">
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <select
        defaultValue={value}
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
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <label className="block text-xs text-slate-400 mb-1">
        {label} {hint && <span className="text-slate-300">({hint})</span>}
      </label>
      <input
        defaultValue={value}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      />
    </div>
  );
}

// ---- Page -----------------------------------------------------------------

export default function AdminSettings() {
  const [selectedDays, setSelectedDays] = useState<string[]>(["Wed", "Thu", "Fri"]);

  function toggleDay(day: string) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Organization Details */}
          <SettingsCard
            icon={<Building2 className="h-4 w-4 text-blue-600" />}
            iconBg="bg-blue-50"
            title="Organization Details"
            action={
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            }
          >
            <Field label="Company Name" value="AarMarks Media Pvt. Ltd." />
            <Field label="Address" value="123 Business Street, Bengaluru, KA 560001" />
            <Field label="Contact Email" value="hr@acme.com" />
            <Field label="Phone Number" value="+91 98765 43210" />
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
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            }
          >
            <p className="text-xs text-slate-400 mb-2">Work Week</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {weekDays.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`h-9 w-11 rounded-lg text-xs font-semibold transition ${
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
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            }
          >
            <SelectField label="Payroll Cycle" value="Monthly" options={["Monthly", "Bi-Weekly", "Weekly"]} />
            <InputField label="Payment Date" value="1" />
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
    </div>
  );
}