import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  User,
  UserRound,
  Users,
  X,
} from "lucide-react";
import SecuritySessionsSection from "../auth/SecuritySessionsSection";
import { Button } from "../../components/ui/Button";
import { Tabs } from "../../components/ui/Tabs";

import { employeeService } from "./employeeService";
import { departmentService } from "../departments/departmentService";
import { shiftService } from "../shifts/shiftService";
import type { Employee } from "./types";
import type { Department } from "../departments/types";
import type { Shift } from "../shifts/types";
import { authService } from "../auth/authService";
import { clearSession } from "../../services/api";
import { clearAuthQueries } from "../../lib/queryClient";
import { setLoginRedirectNotice } from "../../lib/session";

interface UserResponse {
  id: string;
  employee_id: string | null;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

interface InfoItemProps {
  icon: ElementType;
  label: string;
  value?: string | null;
  muted?: boolean;
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: InfoItemProps) {
  const isMissing = !value;

  return (
    <div className="flex items-start gap-3 rounded-[2px] border border-[#E5E7EB] bg-[#F9FAFB]/60 px-3.5 py-2.5 transition-colors hover:bg-[#F9FAFB]">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#6B7280] ring-1 ring-[#E5E7EB]">
        <Icon size={15} strokeWidth={1.8} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[#6B7280]">
          {label}
        </p>

        <p
          className={`mt-0.5 break-words text-[13px] font-medium ${
            isMissing ? "text-[#9CA3AF]" : "text-[#111827]"
          }`}
        >
          {value || "Not provided"}
        </p>
      </div>
    </div>
  );
}

function EmptyInformation({
  icon: Icon,
  title,
  description,
}: {
  icon: ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-[2px] border border-dashed border-[#D1D5DB] bg-[#F9FAFB]/70 px-4 py-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#6B7280] ring-1 ring-[#E5E7EB]">
        <Icon size={18} />
      </div>

      <div>
        <p className="text-[13px] font-semibold text-[#374151]">{title}</p>
        <p className="mt-0.5 text-[12px] text-[#6B7280]">{description}</p>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#E5E7EB] py-3 last:border-b-0">
      <span className="text-[13px] text-[#6B7280]">{label}</span>

      <div className="flex items-center gap-2">
        {active !== undefined && (
          <span
            className={`h-2 w-2 rounded-full ${
              active ? "bg-emerald-500" : "bg-slate-300"
            }`}
          />
        )}

        <span className="text-right text-[13px] font-semibold text-[#111827]">
          {value}
        </span>
      </div>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Not provided";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatEmploymentType(value?: string) {
  if (!value) return "Not provided";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatStatus(value?: string) {
  if (!value) return "Not provided";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function maskAccountNumber(accountNumber?: string) {
  if (!accountNumber) return "Not provided";

  if (accountNumber.length <= 4) {
    return accountNumber;
  }

  return `•••• •••• ${accountNumber.slice(-4)}`;
}

type ProfileTabKey = "overview" | "employment" | "security";

export default function EmployeeProfile() {
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("overview");

  const [user, setUser] = useState<UserResponse | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [employeeLoadError, setEmployeeLoadError] = useState<string | null>(
    null,
  );
  const [isEditingEmergencyContact, setIsEditingEmergencyContact] =
    useState(false);
  const [emergencyContactSuccess, setEmergencyContactSuccess] = useState("");
  const [emergencyContactError, setEmergencyContactError] = useState("");

  const [emergencyContactForm, setEmergencyContactForm] = useState({
    name: "",
    relationship: "",
    phone: "",
    alternate_phone: "",
    address: "",
  });

  const [isSavingEmergencyContact, setIsSavingEmergencyContact] =
    useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordChangedConfirmation, setPasswordChangedConfirmation] =
    useState(false);

  const finishPasswordChangeRedirect = useCallback(() => {
    setLoginRedirectNotice("password_changed");
    clearSession();
    clearAuthQueries();
    window.location.href = "/login";
  }, []);

  // Even if the OK button is never clicked, leave for the login page a few
  // seconds after the confirmation appears.
  useEffect(() => {
    if (!passwordChangedConfirmation) return;

    const timer = window.setTimeout(finishPasswordChangeRedirect, 3000);

    return () => window.clearTimeout(timer);
  }, [passwordChangedConfirmation, finishPasswordChangeRedirect]);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [showDeletePhotoModal, setShowDeletePhotoModal] = useState(false);
  const [showPhotoPreviewModal, setShowPhotoPreviewModal] = useState(false);

  useEffect(() => {
    if (!showPhotoPreviewModal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowPhotoPreviewModal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPhotoPreviewModal]);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        setIsLoading(true);
        setEmployeeLoadError(null);

        /*
         * /employees/me returns the logged-in employee's own profile
         * (the admin-only /employees list endpoint is not used).
         *
         * Departments and shifts are only used to turn IDs into
         * display names, so a failure there should not block the
         * profile from loading. Those two requests fail softly.
         */
        const [employeeProfile, departmentList, shiftList] =
          await Promise.all([
            employeeService.getMyProfile(),
            departmentService.listAll().catch((lookupError) => {
              console.warn("Unable to load departments:", lookupError);
              return [] as Department[];
            }),
            shiftService.list().catch((lookupError) => {
              console.warn("Unable to load shifts:", lookupError);
              return [] as Shift[];
            }),
          ]);

        if (!isMounted) return;

        setEmployee(employeeProfile);
        setProfilePhotoUrl(employeeProfile?.avatar_url ?? null);
        setDepartments(departmentList);
        setShifts(shiftList);

        /*
         * Keep the stored user information for account status,
         * role and account creation date.
         */
        try {
          const storedUser = localStorage.getItem("user");

          if (storedUser) {
            setUser(JSON.parse(storedUser) as UserResponse);
          }
        } catch (storageError) {
          console.warn("Unable to read stored user information:", storageError);
        }
      } catch (err) {
        if (!isMounted) return;

        console.error("Failed to load employee profile:", err);

        setEmployee(null);
        setEmployeeLoadError(
          "Unable to load your employee information. Please try again.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleProfilePhotoChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setPhotoSuccess("");
    setPhotoError("");

    const allowedTypes = ["image/jpeg", "image/png"];

    if (!allowedTypes.includes(file.type)) {
      setPhotoError("Please upload a JPG, JPEG, or PNG image.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Profile photo must not exceed 5 MB.");
      event.target.value = "";
      return;
    }

    try {
      setIsUploadingPhoto(true);

      const response = await employeeService.uploadMyProfilePhoto(file);

      window.dispatchEvent(
        new Event("employee-profile-photo-updated"),
      );

      setEmployee((current) =>
        current
          ? { ...current, avatar_url: response.avatar_url }
          : current,
      );
      setProfilePhotoUrl(response.avatar_url);

      setPhotoSuccess("Profile photo updated successfully.");
      } catch (error) {
        console.error("Profile photo upload failed:", error);
        setPhotoError("Unable to update profile photo. Please try again.");
      } finally {
        setIsUploadingPhoto(false);
        event.target.value = "";
      }
    };

  const handleDeleteProfilePhoto = async () => {
  if (!employee?.id || !profilePhotoUrl) return;

  setPhotoSuccess("");
  setPhotoError("");

  try {
    setIsUploadingPhoto(true);

    await employeeService.removeMyProfilePhoto();

    setEmployee((current) =>
      current
        ? { ...current, avatar_url: undefined }
        : current,
    );

    setProfilePhotoUrl(null);
    setShowDeletePhotoModal(false);

    window.dispatchEvent(
      new Event("employee-profile-photo-updated"),
    );

    setPhotoSuccess("Profile photo deleted successfully.");
  } catch (error) {
    console.error("Profile photo deletion failed:", error);
    setPhotoError(
      "Unable to delete profile photo. Please try again.",
    );
  } finally {
    setIsUploadingPhoto(false);
  }
};

  const handleEditEmergencyContact = () => {
    setEmergencyContactError("");
    setEmergencyContactSuccess("");
    setEmergencyContactForm({
      name: employee?.emergency_contact?.name || "",
      relationship: employee?.emergency_contact?.relationship || "",
      phone: employee?.emergency_contact?.phone || "",
      alternate_phone: employee?.emergency_contact?.alternate_phone || "",
      address: employee?.emergency_contact?.address || "",
    });

    setIsEditingEmergencyContact(true);
  };

  const handleSaveEmergencyContact = async () => {
    if (!employee?.id) return;

    setEmergencyContactError("");
    setEmergencyContactSuccess("");

    if (
      !emergencyContactForm.name.trim() ||
      !emergencyContactForm.relationship.trim() ||
      !emergencyContactForm.phone.trim()
    ) {
      setEmergencyContactError("Please fill in all required fields (Name, Relationship, Phone).");
      return;
    }

    try {
      setIsSavingEmergencyContact(true);

      const contactPayload = {
        name: emergencyContactForm.name.trim(),
        relationship: emergencyContactForm.relationship.trim(),
        phone: emergencyContactForm.phone.trim(),
        alternate_phone:
          emergencyContactForm.alternate_phone.trim() || undefined,
        address: emergencyContactForm.address.trim() || undefined,
      };

      const updated = await employeeService.update(employee.id, {
        emergency_contact: contactPayload,
      });

      setEmployee((current) =>
        current
          ? {
              ...current,
              emergency_contact: updated.emergency_contact || contactPayload,
            }
          : current,
      );

      setIsEditingEmergencyContact(false);
      setEmergencyContactSuccess("Emergency contact updated successfully.");
      setTimeout(() => setEmergencyContactSuccess(""), 4000);
    } catch (error) {
      console.error("Failed to save emergency contact:", error);
      const message =
        error instanceof Error ? error.message : "Failed to save emergency contact. Please try again.";
      setEmergencyContactError(message);
    } finally {
      setIsSavingEmergencyContact(false);
    }
  };

const handleChangePassword = async (
  event: React.FormEvent<HTMLFormElement>,
) => {
  event.preventDefault();

  setPasswordSuccess("");
  setPasswordError("");

  if (!currentPassword || !newPassword || !confirmPassword) {
    setPasswordError("Please fill in all password fields.");
    return;
  }

  if (newPassword.length < 8 || newPassword.length > 128) {
    setPasswordError("Password must be between 8 and 128 characters.");
    return;
  }

  if (
    !/[A-Z]/.test(newPassword) ||
    !/[a-z]/.test(newPassword) ||
    !/[0-9]/.test(newPassword) ||
    !/[^A-Za-z0-9]/.test(newPassword)
  ) {
    setPasswordError(
      "Password must contain uppercase and lowercase letters, a number, and a special character.",
    );
    return;
  }

  if (newPassword !== confirmPassword) {
    setPasswordError("New password and confirmation do not match.");
    return;
  }

  if (currentPassword === newPassword) {
    setPasswordError(
      "Your new password must be different from your current password.",
    );
    return;
  }

    setIsChangingPassword(true);

  try {
    await authService.changePassword({
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });

    // The server has already revoked every session of this user, so the
    // only way back in is a fresh login. Confirm with a popup first, then
    // hand off to the login page.
    setPasswordChangedConfirmation(true);

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to change password. Please try again.";

    setPasswordError(message);
  } finally {
    setIsChangingPassword(false);
  }
};

  const profileCompletion = useMemo(() => {
    if (!employee) return 0;

    const checks = [
      Boolean(employee.first_name),
      Boolean(employee.last_name),
      Boolean(employee.email),
      Boolean(employee.phone),
      Boolean(employee.date_of_birth),
      Boolean(employee.gender),
      Boolean(employee.address),
      Boolean(employee.department_id),
      Boolean(employee.designation),
      Boolean(employee.joining_date),
      Boolean(employee.employment_type),
      Boolean(employee.work_location),
      Boolean(employee.reporting_manager),
      Boolean(employee.emergency_contact?.name),
      Boolean(employee.emergency_contact?.relationship),
      Boolean(employee.emergency_contact?.phone),
      Boolean(employee.bank_information?.bank_name),
      Boolean(employee.bank_information?.account_holder_name),
      Boolean(employee.bank_information?.account_number),
      Boolean(employee.bank_information?.ifsc_code),
    ];

    const completed = checks.filter(Boolean).length;

    return Math.round((completed / checks.length) * 100);
  }, [employee]);

  // Resolve IDs to display names (IDs stay internal).
  const departmentName = useMemo(() => {
    if (!employee?.department_id) return "Not assigned";

    return (
      departments.find(
        (department) => department.id === employee.department_id,
      )?.name ?? "Not provided"
    );
  }, [departments, employee]);

  const shiftName = useMemo(() => {
    if (!employee?.shift_id) return "Not assigned";

    return (
      shifts.find((shift) => shift.id === employee.shift_id)?.name ??
      "Not assigned"
    );
  }, [shifts, employee]);

  const displayName = employee
    ? `${employee.first_name} ${employee.last_name}`.trim()
    : user?.full_name || "Employee";

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const roleLabel = user?.role
    ? user.role
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase())
    : "Employee";

  const isActive =
    employee?.status === "active"
      ? true
      : employee?.status
        ? false
        : user?.is_active ?? false;

  const passwordRules = useMemo(() => {
    return [
      {
        label: "At least 8 characters",
        met: newPassword.length >= 8 && newPassword.length <= 128,
      },
      {
        label: "Uppercase & lowercase letters",
        met: /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword),
      },
      {
        label: "At least one number",
        met: /[0-9]/.test(newPassword),
      },
      {
        label: "One special character",
        met: /[^A-Za-z0-9]/.test(newPassword),
      },
      {
        label: "Matches confirmation",
        met: Boolean(confirmPassword) && newPassword === confirmPassword,
      },
    ];
  }, [newPassword, confirmPassword]);

  const missingHints = useMemo(() => {
    const hints: string[] = [];
    if (!employee?.emergency_contact?.name) hints.push("Emergency contact");
    if (!employee?.bank_information?.bank_name) hints.push("Bank details (HR)");
    if (!employee?.address) hints.push("Address");
    return hints;
  }, [employee]);

  if (isLoading) {
    return (
      <div className="flex w-full flex-col gap-5 pb-10">
        <div className="h-36 animate-pulse rounded-[2px] border border-[#E5E7EB] bg-white" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-[2px] border border-[#E5E7EB] bg-white"
            />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 h-80 animate-pulse rounded-[2px] border border-[#E5E7EB] bg-white lg:col-span-7" />
          <div className="col-span-12 h-80 animate-pulse rounded-[2px] border border-[#E5E7EB] bg-white lg:col-span-5" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-5 pb-10">
      {/* Error */}
      {employeeLoadError && (
        <div className="flex items-start gap-3 rounded-[2px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
          <div>
            <p className="font-semibold">Profile information unavailable</p>
            <p className="mt-0.5 text-xs text-amber-700">{employeeLoadError}</p>
          </div>
        </div>
      )}

      {/* Clean Profile Header Card */}
      <section className="rounded-[2px] border border-[#E5E7EB] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Avatar & Identity */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  if (profilePhotoUrl) {
                    setShowPhotoPreviewModal(true);
                  } else {
                    profilePhotoInputRef.current?.click();
                  }
                }}
                title={profilePhotoUrl ? "View profile photo" : "Upload profile photo"}
                aria-label={profilePhotoUrl ? "View profile photo" : "Upload profile photo"}
                className="group relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-[2px] border border-[#E5E7EB] bg-[#F3F4F6] text-xl font-bold text-[#4B5563] transition hover:border-[#2563EB]"
              >
                {profilePhotoUrl ? (
                  <>
                    <img
                      src={profilePhotoUrl}
                      alt={displayName}
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                    />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                      <Eye size={18} />
                    </span>
                  </>
                ) : (
                  initials || <UserRound size={30} />
                )}
              </button>
              <span
                title={isActive ? "Active" : "Inactive"}
                className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${
                  isActive ? "bg-emerald-500" : "bg-slate-400"
                }`}
              />
            </div>

            <input
              ref={profilePhotoInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleProfilePhotoChange}
            />

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-[#111827]">
                  {displayName}
                </h1>

                {isActive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 size={12} />
                    Active
                  </span>
                ) : (
                  employee && (
                    <span className="inline-flex items-center rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[11px] font-semibold text-[#4B5563]">
                      {formatStatus(employee.status)}
                    </span>
                  )
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#6B7280]">
                <span className="inline-flex items-center gap-1.5">
                  <BriefcaseBusiness size={14} className="text-[#9CA3AF]" />
                  {employee?.designation || roleLabel}
                </span>

                {employee?.employee_id && (
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-[#9CA3AF]" />
                    {employee.employee_id}
                  </span>
                )}

                {employee?.work_location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={14} className="text-[#9CA3AF]" />
                    {employee.work_location}
                  </span>
                )}
              </div>

              {/* Photo Actions */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => profilePhotoInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  leftIcon={<Camera size={14} />}
                >
                  {isUploadingPhoto
                    ? "Uploading..."
                    : profilePhotoUrl
                      ? "Change Photo"
                      : "Upload Photo"}
                </Button>

                {profilePhotoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeletePhotoModal(true)}
                    disabled={isUploadingPhoto}
                    leftIcon={<Trash2 size={14} />}
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    Remove
                  </Button>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab("security")}
                  leftIcon={<KeyRound size={14} />}
                >
                  Security &amp; Password
                </Button>
              </div>
            </div>
          </div>

          {/* Right: Profile Completion Widget */}
          <div className="w-full rounded-[2px] border border-[#E5E7EB] bg-[#F9FAFB] p-4 lg:w-72 lg:shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Profile Completion
              </p>
              <span className="text-[14px] font-bold text-[#111827]">
                {profileCompletion}%
              </span>
            </div>

            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  profileCompletion >= 90
                    ? "bg-emerald-500"
                    : "bg-[#2563EB]"
                }`}
                style={{ width: `${profileCompletion}%` }}
              />
            </div>

            <p className="mt-2 text-[11px] text-[#6B7280]">
              {profileCompletion === 100
                ? "Your profile is complete."
                : missingHints.length > 0
                  ? `Pending: ${missingHints.join(", ")}`
                  : "Keep your profile details up to date."}
            </p>
          </div>
        </div>

        {(photoSuccess || photoError) && (
          <div className="mt-3 border-t border-[#E5E7EB] pt-3">
            {photoSuccess && (
              <p className="text-xs font-medium text-emerald-600">
                {photoSuccess}
              </p>
            )}
            {photoError && (
              <p className="text-xs font-medium text-rose-600">{photoError}</p>
            )}
          </div>
        )}
      </section>

      {/* 4 Quick Info KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Email",
            value: employee?.email || user?.email || "Not provided",
            icon: Mail,
            tone: "bg-blue-50 text-[#2563EB]",
          },
          {
            label: "Phone",
            value: employee?.phone || "Not provided",
            icon: Phone,
            tone: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "Department",
            value: departmentName,
            icon: Building2,
            tone: "bg-purple-50 text-purple-600",
          },
          {
            label: "Joining Date",
            value: formatDate(employee?.joining_date),
            icon: CalendarDays,
            tone: "bg-amber-50 text-amber-600",
          },
        ].map((card) => {
          const CardIcon = card.icon;
          return (
            <div
              key={card.label}
              className="flex items-start justify-between gap-3 rounded-[2px] border-2 border-[#E5E7EB] bg-white p-4 shadow-kpi"
            >
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-[#6B7280]">
                  {card.label}
                </p>
                <p className="mt-1.5 truncate text-[14px] font-semibold text-[#111827]">
                  {card.value}
                </p>
              </div>
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.tone}`}
              >
                <CardIcon size={16} />
              </span>
            </div>
          );
        })}
      </section>

      {/* Section Navigation Tabs */}
      <div className="rounded-[2px] border border-[#E5E7EB] bg-white px-5 pt-2">
        <Tabs
          variant="underline"
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as ProfileTabKey)}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "employment", label: "Employment & Bank" },
            { id: "security", label: "Security & Activity" },
          ]}
        />
      </div>

      {/* TAB 1: OVERVIEW (Personal Info + Emergency Contact) */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-12 items-stretch gap-5">
          {/* Personal Information */}
          <section className="col-span-12 flex flex-col rounded-[2px] border border-[#E5E7EB] bg-white lg:col-span-7">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
              <div>
                <h2 className="text-[14px] font-semibold text-[#111827]">
                  Personal Information
                </h2>
                <p className="mt-0.5 text-[12px] text-[#6B7280]">
                  Your personal details and contact information
                </p>
              </div>

              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3F4F6] text-[#6B7280]">
                <UserRound size={16} />
              </span>
            </div>

            <div className="grid flex-1 gap-3 p-5 sm:grid-cols-2">
              <InfoItem
                icon={User}
                label="First Name"
                value={employee?.first_name}
              />
              <InfoItem
                icon={User}
                label="Last Name"
                value={employee?.last_name}
              />
              <InfoItem
                icon={CalendarDays}
                label="Date of Birth"
                value={formatDate(employee?.date_of_birth)}
              />
              <InfoItem
                icon={Users}
                label="Gender"
                value={employee?.gender}
              />
              <InfoItem
                icon={Mail}
                label="Email"
                value={employee?.email || user?.email}
              />
              <InfoItem
                icon={Phone}
                label="Contact Number"
                value={employee?.phone}
              />
              <div className="sm:col-span-2">
                <InfoItem
                  icon={MapPin}
                  label="Address"
                  value={employee?.address}
                />
              </div>
            </div>
          </section>

          {/* Emergency Contact */}
          <section className="col-span-12 flex flex-col rounded-[2px] border border-[#E5E7EB] bg-white lg:col-span-5">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
              <div>
                <h2 className="text-[14px] font-semibold text-[#111827]">
                  Emergency Contact
                </h2>
                <p className="mt-0.5 text-[12px] text-[#6B7280]">
                  Someone to reach in case of an emergency
                </p>
              </div>

              {!isEditingEmergencyContact && employee?.emergency_contact && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleEditEmergencyContact}
                  leftIcon={<Edit3 size={13} />}
                >
                  Edit
                </Button>
              )}
            </div>

            <div className="flex-1 p-5">
              {emergencyContactSuccess && (
                <div className="mb-4 flex items-center gap-2 rounded-[2px] border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                  <span>{emergencyContactSuccess}</span>
                </div>
              )}

              {emergencyContactError && (
                <div className="mb-4 rounded-[2px] border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
                  {emergencyContactError}
                </div>
              )}

              {isEditingEmergencyContact ? (
                <div className="space-y-3.5">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#374151]">
                      Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={emergencyContactForm.name}
                      onChange={(e) =>
                        setEmergencyContactForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="Enter emergency contact name"
                      className="h-9 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-[13px] text-[#111827] outline-none transition focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#DBEAFE]"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#374151]">
                        Relationship <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={emergencyContactForm.relationship}
                        onChange={(e) =>
                          setEmergencyContactForm((prev) => ({
                            ...prev,
                            relationship: e.target.value,
                          }))
                        }
                        placeholder="e.g. Father, Spouse"
                        className="h-9 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-[13px] text-[#111827] outline-none transition focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#DBEAFE]"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#374151]">
                        Phone <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={emergencyContactForm.phone}
                        onChange={(e) =>
                          setEmergencyContactForm((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                        placeholder="Phone number"
                        className="h-9 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-[13px] text-[#111827] outline-none transition focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#DBEAFE]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#374151]">
                      Alternate Phone
                    </label>
                    <input
                      type="tel"
                      value={emergencyContactForm.alternate_phone}
                      onChange={(e) =>
                        setEmergencyContactForm((prev) => ({
                          ...prev,
                          alternate_phone: e.target.value,
                        }))
                      }
                      placeholder="Optional alternate number"
                      className="h-9 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-[13px] text-[#111827] outline-none transition focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#DBEAFE]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#374151]">
                      Address
                    </label>
                    <textarea
                      value={emergencyContactForm.address}
                      onChange={(e) =>
                        setEmergencyContactForm((prev) => ({
                          ...prev,
                          address: e.target.value,
                        }))
                      }
                      placeholder="Emergency contact address"
                      rows={2}
                      className="w-full resize-none rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-[13px] text-[#111827] outline-none transition focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#DBEAFE]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingEmergencyContact(false)}
                      disabled={isSavingEmergencyContact}
                      leftIcon={<X size={14} />}
                    >
                      Cancel
                    </Button>

                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleSaveEmergencyContact}
                      disabled={
                        isSavingEmergencyContact ||
                        !emergencyContactForm.name.trim() ||
                        !emergencyContactForm.relationship.trim() ||
                        !emergencyContactForm.phone.trim()
                      }
                      leftIcon={<Save size={14} />}
                    >
                      {isSavingEmergencyContact ? "Saving..." : "Save Contact"}
                    </Button>
                  </div>
                </div>
              ) : employee?.emergency_contact ? (
                <div className="space-y-3">
                  <InfoItem
                    icon={User}
                    label="Name"
                    value={employee.emergency_contact.name}
                  />
                  <InfoItem
                    icon={Users}
                    label="Relationship"
                    value={employee.emergency_contact.relationship}
                  />
                  <InfoItem
                    icon={Phone}
                    label="Phone"
                    value={employee.emergency_contact.phone}
                  />
                  {employee.emergency_contact.alternate_phone && (
                    <InfoItem
                      icon={Phone}
                      label="Alternate Phone"
                      value={employee.emergency_contact.alternate_phone}
                    />
                  )}
                  {employee.emergency_contact.address && (
                    <InfoItem
                      icon={MapPin}
                      label="Address"
                      value={employee.emergency_contact.address}
                    />
                  )}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center py-6 text-center">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3F4F6] text-[#6B7280]">
                    <Phone size={20} />
                  </div>
                  <h3 className="text-[13px] font-semibold text-[#111827]">
                    No emergency contact
                  </h3>
                  <p className="mt-1 max-w-xs text-[12px] text-[#6B7280]">
                    Add someone we can reach in case of an emergency.
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleEditEmergencyContact}
                    leftIcon={<Plus size={14} />}
                    className="mt-4"
                  >
                    Add Emergency Contact
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: EMPLOYMENT & BANK */}
      {activeTab === "employment" && (
        <div className="space-y-5">
          {/* Employment Information */}
          <section className="rounded-[2px] border border-[#E5E7EB] bg-white">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
              <div>
                <h2 className="text-[14px] font-semibold text-[#111827]">
                  Employment Information
                </h2>
                <p className="mt-0.5 text-[12px] text-[#6B7280]">
                  Your current role, reporting structure, and shift details
                </p>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3F4F6] text-[#6B7280]">
                <BriefcaseBusiness size={16} />
              </span>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoItem
                icon={ShieldCheck}
                label="Employee ID"
                value={employee?.employee_id}
              />
              <InfoItem
                icon={BriefcaseBusiness}
                label="Designation"
                value={employee?.designation}
              />
              <InfoItem
                icon={Building2}
                label="Department"
                value={departmentName}
              />
              <InfoItem
                icon={CalendarDays}
                label="Joining Date"
                value={formatDate(employee?.joining_date)}
              />
              <InfoItem
                icon={Clock3}
                label="Employment Type"
                value={formatEmploymentType(employee?.employment_type)}
              />
              <InfoItem
                icon={MapPin}
                label="Work Location"
                value={employee?.work_location}
              />
              <InfoItem
                icon={User}
                label="Reporting Manager"
                value={employee?.reporting_manager}
              />
              <InfoItem
                icon={Banknote}
                label="Salary Structure"
                value={employee?.salary_structure}
              />
              <InfoItem icon={Clock3} label="Shift" value={shiftName} />
            </div>
          </section>

          {/* Account Overview + Bank Information */}
          <div className="grid grid-cols-12 items-stretch gap-5">
            <section className="col-span-12 flex flex-col rounded-[2px] border border-[#E5E7EB] bg-white lg:col-span-5">
              <div className="border-b border-[#E5E7EB] px-5 py-4">
                <h2 className="text-[14px] font-semibold text-[#111827]">
                  Account Overview
                </h2>
                <p className="mt-0.5 text-[12px] text-[#6B7280]">
                  Current portal account status
                </p>
              </div>

              <div className="flex-1 px-5 py-2">
                <StatusRow
                  label="Account status"
                  value={isActive ? "Active" : "Inactive"}
                  active={isActive}
                />
                <StatusRow
                  label="Security status"
                  value={user?.is_locked ? "Locked" : "Secure"}
                  active={!user?.is_locked}
                />
                <StatusRow label="Account role" value={roleLabel} />
                <StatusRow
                  label="Member since"
                  value={formatDate(user?.created_at)}
                />
                <StatusRow
                  label="Employment"
                  value={formatEmploymentType(employee?.employment_type)}
                />
                <StatusRow
                  label="Status"
                  value={formatStatus(employee?.status)}
                  active={employee?.status === "active"}
                />
              </div>
            </section>

            <section className="col-span-12 flex flex-col rounded-[2px] border border-[#E5E7EB] bg-white lg:col-span-7">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
                <div>
                  <h2 className="text-[14px] font-semibold text-[#111827]">
                    Bank Information
                  </h2>
                  <p className="mt-0.5 text-[12px] text-[#6B7280]">
                    Your salary and banking details
                  </p>
                </div>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3F4F6] text-[#6B7280]">
                  <CreditCard size={16} />
                </span>
              </div>

              <div className="flex-1 p-5">
                {employee?.bank_information ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoItem
                      icon={Building2}
                      label="Bank Name"
                      value={employee.bank_information.bank_name}
                    />
                    <InfoItem
                      icon={User}
                      label="Account Holder"
                      value={employee.bank_information.account_holder_name}
                    />
                    <InfoItem
                      icon={CreditCard}
                      label="Account Number"
                      value={maskAccountNumber(
                        employee.bank_information.account_number,
                      )}
                    />
                    <InfoItem
                      icon={ShieldCheck}
                      label="IFSC Code"
                      value={employee.bank_information.ifsc_code}
                    />
                    {employee.bank_information.branch && (
                      <InfoItem
                        icon={MapPin}
                        label="Branch"
                        value={employee.bank_information.branch}
                      />
                    )}
                  </div>
                ) : (
                  <EmptyInformation
                    icon={CreditCard}
                    title="Bank information not added"
                    description="Your bank information has not been provided by HR yet."
                  />
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY & ACTIVITY */}
      {activeTab === "security" && (
        <div className="grid grid-cols-12 items-start gap-5">
          {/* Change Password */}
          <section className="col-span-12 rounded-[2px] border border-[#E5E7EB] bg-white p-5 lg:col-span-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                <KeyRound size={18} />
              </div>

              <div>
                <h2 className="text-[14px] font-semibold text-[#111827]">
                  Change Password
                </h2>
                <p className="mt-0.5 text-[12px] text-[#6B7280]">
                  Changing your password signs out other active devices.
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {[
                {
                  label: "Current Password",
                  value: currentPassword,
                  setValue: setCurrentPassword,
                  visible: showCurrentPassword,
                  setVisible: setShowCurrentPassword,
                  placeholder: "Enter current password",
                  autoComplete: "current-password",
                },
                {
                  label: "New Password",
                  value: newPassword,
                  setValue: setNewPassword,
                  visible: showNewPassword,
                  setVisible: setShowNewPassword,
                  placeholder: "Enter new password",
                  autoComplete: "new-password",
                },
                {
                  label: "Confirm New Password",
                  value: confirmPassword,
                  setValue: setConfirmPassword,
                  visible: showConfirmPassword,
                  setVisible: setShowConfirmPassword,
                  placeholder: "Confirm new password",
                  autoComplete: "new-password",
                },
              ].map((field) => (
                <div key={field.label}>
                  <label className="mb-1.5 block text-xs font-medium text-[#374151]">
                    {field.label}
                  </label>

                  <div className="relative">
                    <input
                      type={field.visible ? "text" : "password"}
                      value={field.value}
                      onChange={(event) => {
                        field.setValue(event.target.value);
                        setPasswordError("");
                        setPasswordSuccess("");
                      }}
                      placeholder={field.placeholder}
                      autoComplete={field.autoComplete}
                      maxLength={128}
                      required
                      disabled={isChangingPassword}
                      className="h-9 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 pr-10 text-[13px] text-[#111827] outline-none transition focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#DBEAFE] disabled:cursor-not-allowed disabled:bg-[#F9FAFB]"
                    />

                    <button
                      type="button"
                      onClick={() => field.setVisible(!field.visible)}
                      aria-label={field.visible ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-[#6B7280] hover:text-[#111827]"
                    >
                      {field.visible ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              ))}

              {/* Live Password Requirements */}
              <div className="rounded-[2px] border border-[#E5E7EB] bg-[#F9FAFB] p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                  Password Requirements
                </p>
                <ul className="space-y-1.5">
                  {passwordRules.map((rule) => (
                    <li
                      key={rule.label}
                      className={`flex items-center gap-2 text-[12px] ${
                        rule.met ? "font-medium text-emerald-700" : "text-[#6B7280]"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                          rule.met
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-[#E5E7EB] text-[#9CA3AF]"
                        }`}
                      >
                        <Check size={10} />
                      </span>
                      {rule.label}
                    </li>
                  ))}
                </ul>
              </div>

              {passwordError && (
                <div
                  role="alert"
                  className="rounded-[2px] border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700"
                >
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-[2px] border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-700"
                >
                  <CheckCircle2 size={16} />
                  {passwordSuccess}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isChangingPassword}
                leftIcon={<ShieldCheck size={15} />}
                className="w-full"
              >
                {isChangingPassword ? "Changing Password..." : "Update Password"}
              </Button>
            </form>
          </section>

          {/* Active Sessions & Login History */}
          <div className="col-span-12 lg:col-span-7">
            <SecuritySessionsSection />
          </div>
        </div>
      )}

      {passwordChangedConfirmation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-[2px] bg-white p-6 text-center shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-changed-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 id="password-changed-title" className="mt-4 text-lg font-bold text-[#111827]">
              Password changed successfully
            </h2>
            <p className="mt-2 text-sm text-[#6B7280]">
              Your password has been updated and all other sessions were
              logged out. You will now be redirected to the login page.
            </p>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={finishPasswordChangeRedirect}
              className="mt-5"
            >
              Go to Login
            </Button>
          </div>
        </div>
      )}

      {/* Profile Photo Preview Lightbox */}
      {showPhotoPreviewModal && profilePhotoUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${displayName} profile photo`}
          onClick={() => setShowPhotoPreviewModal(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-[2px] bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-[#111827]">
                  {displayName}
                </h2>
                <p className="text-xs text-[#6B7280]">
                  {employee?.designation || roleLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoPreviewModal(false)}
                aria-label="Close photo preview"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-hidden rounded-[2px] bg-[#F3F4F6]">
              <img
                src={profilePhotoUrl}
                alt={displayName}
                className="max-h-[70vh] w-full object-contain"
              />
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowPhotoPreviewModal(false);
                  profilePhotoInputRef.current?.click();
                }}
                leftIcon={<Camera size={14} />}
              >
                Change Photo
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setShowPhotoPreviewModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Profile Photo Confirmation Modal */}
      {showDeletePhotoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2px] bg-white p-6 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
              <Trash2 size={24} className="text-rose-600" />
            </div>

            <div className="mt-4 text-center">
              <h2 className="text-lg font-bold text-[#111827]">
                Delete Profile Photo?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
                Are you sure you want to delete your profile photo?
                This action cannot be undone.
              </p>
            </div>

            <div className="mt-6 flex justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setShowDeletePhotoModal(false)}
                disabled={isUploadingPhoto}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="danger"
                size="md"
                onClick={handleDeleteProfilePhoto}
                disabled={isUploadingPhoto}
                leftIcon={<Trash2 size={15} />}
              >
                {isUploadingPhoto ? "Deleting..." : "Delete Photo"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}