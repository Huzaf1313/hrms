import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Save, X } from "lucide-react";

import {
  PROFILE_FIELDS,
  PROFILE_INPUT_CLASS,
  PROFILE_LABEL_CLASS,
  PROFILE_TEXTAREA_CLASS,
  type ProfileFieldSpec,
} from "./profileFields";
import type { AdminProfile, ProfileTab } from "./adminProfileTypes";
import { isSuperAdmin } from "../../lib/access";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Identity fields the person must fill in themselves. */
const REQUIRED_FIELDS: (keyof AdminProfile)[] = [
  "full_name",
  "designation",
  "department",
  "email",
  "phone",
];

/**
 * The super admin is not an employee, so it has no designation, department
 * or phone on file and must still be able to save. It only needs a name.
 */
const SUPER_ADMIN_REQUIRED_FIELDS: (keyof AdminProfile)[] = ["full_name", "email"];

const FIELD_LIMITS: Partial<Record<keyof AdminProfile, number>> = {
  full_name: 80,
  permanent_address: 300,
  current_address: 300,
};

interface ProfileEditFormProps {
  tab: ProfileTab;
  profile: AdminProfile;
  /** Unsaved photo picked in the hero, if any. */
  avatarUrl: string | null;
  isSaving: boolean;
  shiftOptions: readonly string[];
  onCancel: () => void;
  onSave: (profile: AdminProfile, avatarUrl: string | null) => Promise<void>;
}

/**
 * Error message for one field, or "" when it is valid. `required` is passed
 * in because the list differs for the super admin.
 */
function validateField(
  spec: ProfileFieldSpec,
  value: string,
  required: readonly (keyof AdminProfile)[],
): string {
  const trimmed = value.trim();

  if (required.includes(spec.name) && trimmed.length === 0) {
    return `${spec.label} is required.`;
  }

  const limit = FIELD_LIMITS[spec.name];

  if (limit !== undefined && trimmed.length > limit) {
    return `${spec.label} cannot exceed ${limit} characters.`;
  }

  if (spec.type === "email" && trimmed.length > 0 && !EMAIL_PATTERN.test(trimmed)) {
    return "Enter a valid email address.";
  }

  if (spec.type === "tel" && trimmed.length > 0) {
    const digits = trimmed.replace(/\D/g, "");

    if (digits.length < 10 || digits.length > 15) {
      return "Enter a valid phone number.";
    }
  }

  return "";
}

export default function ProfileEditForm({
  tab,
  profile,
  avatarUrl,
  isSaving,
  shiftOptions,
  onCancel,
  onSave,
}: ProfileEditFormProps) {
  const [draft, setDraft] = useState<AdminProfile>(profile);
  const [errors, setErrors] = useState<Partial<Record<keyof AdminProfile, string>>>({});
  const [error, setError] = useState("");

  // Nobody sits above the super admin to manage its name, so it edits it here.
  const superAdmin = useMemo(() => isSuperAdmin(), []);
  const requiredFields = superAdmin ? SUPER_ADMIN_REQUIRED_FIELDS : REQUIRED_FIELDS;

  const fields = useMemo(
    () =>
      PROFILE_FIELDS[tab].map((field): ProfileFieldSpec => {
        // Full Name is read-only ("Managed by your administrator") for HR and
        // managers; unlock it and drop that hint for the super admin.
        if (field.name === "full_name" && superAdmin) {
          return { ...field, readOnly: false, hint: undefined };
        }

        if (field.name === "shift") {
          return {
            ...field,
            options: shiftOptions.length > 0
              ? shiftOptions
              : profile.shift
                ? [profile.shift]
                : [],
          };
        }

        return field;
      }),
    [profile.shift, shiftOptions, superAdmin, tab],
  );

  function update(name: keyof AdminProfile, value: string) {
    setDraft((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) return;

    const nextErrors: Partial<Record<keyof AdminProfile, string>> = {};

    for (const spec of fields) {
      const message = validateField(spec, String(draft[spec.name] ?? ""), requiredFields);

      if (message) nextErrors[spec.name] = message;
    }

    setErrors(nextErrors);
    setError("");

    if (Object.keys(nextErrors).length > 0) {
      setError("Please fix the highlighted fields before saving.");
      return;
    }

    try {
      await onSave({ ...draft, avatar_url: avatarUrl }, avatarUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the profile.");
    }
  }

  return (
    // The id is the scroll target AdminMyProfile uses when Edit is clicked;
    // scroll-mt keeps the top of the form clear of the sticky header.
    <form id="profile-edit-form" onSubmit={handleSubmit} className="scroll-mt-24">
      <div className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((spec) => {
            const fieldId = `profile-${spec.name}`;
            const message = errors[spec.name] ?? "";

            return (
              <div key={spec.name} className={spec.full ? "sm:col-span-2" : ""}>
                <label htmlFor={fieldId} className={PROFILE_LABEL_CLASS}>
                  {spec.label}
                </label>

                {spec.type === "select" ? (
                  <select
                    id={fieldId}
                    value={String(draft[spec.name] ?? "")}
                    disabled={isSaving || spec.readOnly}
                    aria-invalid={Boolean(message)}
                    onChange={(event) => update(spec.name, event.target.value)}
                    className={`${PROFILE_INPUT_CLASS} ${message ? "border-rose-300" : ""}`}
                  >
                    {(spec.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : spec.type === "textarea" ? (
                  <textarea
                    id={fieldId}
                    rows={3}
                    value={String(draft[spec.name] ?? "")}
                    disabled={isSaving || spec.readOnly}
                    aria-invalid={Boolean(message)}
                    maxLength={FIELD_LIMITS[spec.name]}
                    onChange={(event) => update(spec.name, event.target.value)}
                    className={`${PROFILE_TEXTAREA_CLASS} ${message ? "border-rose-300" : ""}`}
                  />
                ) : (
                  <input
                    id={fieldId}
                    type={spec.type}
                    value={String(draft[spec.name] ?? "")}
                    disabled={isSaving || spec.readOnly}
                    aria-invalid={Boolean(message)}
                    maxLength={FIELD_LIMITS[spec.name]}
                    onChange={(event) => update(spec.name, event.target.value)}
                    className={`${PROFILE_INPUT_CLASS} ${message ? "border-rose-300" : ""}`}
                  />
                )}

                {message ? (
                  <p role="alert" className="mt-1 text-[11px] font-medium text-rose-600">
                    {message}
                  </p>
                ) : spec.readOnly && spec.hint ? (
                  <p className="mt-1 text-[11px] text-gray-400">{spec.hint}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-[2px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600"
          >
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2563eb] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:opacity-60"
        >
          {isSaving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </form>
  );
}
