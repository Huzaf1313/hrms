import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Briefcase,
  CheckCircle2,
  FileText,
  Headphones,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";

import ProfileEditForm from "../../components/admin/profile/ProfileEditForm";
import AdminEmployeeDocuments from "../../components/admin/AdminEmployeeDocuments";
import {
  DetailCard,
  DetailRow,
  InfoGrid,
  ProfileAvatar,
  ProfileSection,
  ProfileTabBar,
  QuickActionRow,
  StatusPill,
} from "../../components/admin/profile/ProfileUi";
import {
  EMPLOYMENT_STATUS_STYLES,
  experienceFrom,
  formatProfileDate,
} from "../../components/admin/profile/profileFields";
import { adminProfileService } from "../../services/adminProfileService";
import { authService } from "../../services/authService";
import { shiftService } from "../../services/shiftService";
import type {
  AdminProfile,
  NotificationPreferences,
  ProfileTab,
} from "../../types/adminProfile";

function roleLabel(role: string): string {
  return role === "hr_admin" ? "HR Admin" : role.replaceAll("_", " ");
}

/** Brings a panel into view, so a quick action can jump to it. */
function scrollToSection(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
          checked ? "bg-[#2563eb]" : "bg-gray-200"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export default function AdminMyProfile() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [notifications, setNotifications] = useState<NotificationPreferences | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updateConfirmation, setUpdateConfirmation] = useState(false);
  const [shiftOptions, setShiftOptions] = useState<string[]>([]);

  const [activeTab, setActiveTab] = useState<ProfileTab>("Overview");
  const [isEditing, setIsEditing] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);

  const support = adminProfileService.getSupportContact();

  useEffect(() => {
    let cancelled = false;

    // Each panel degrades on its own: a failed document lookup must not take
    // the whole profile page down with it.
    Promise.allSettled([
      adminProfileService.getProfile(),
      adminProfileService.getNotificationPreferences(),
      shiftService.list(),
    ]).then(([profileResult, notificationsResult, shiftsResult]) => {
      if (cancelled) return;

      let hasError = false;

      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value);
      } else {
        hasError = true;
      }

      if (notificationsResult.status === "fulfilled") {
        setNotifications(notificationsResult.value);
      } else {
        hasError = true;
      }

      if (shiftsResult.status === "fulfilled") {
        setShiftOptions(shiftsResult.value.map((shift) => shift.name));
      }

      setError(hasError ? "Some profile details could not be loaded." : "");
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePhoto = useCallback(async (file: File) => {
    const previewUrl = URL.createObjectURL(file);

    try {
      setPendingAvatar(previewUrl);
      setNotice("Photo ready. Saving changes to keep it.");

      const saved = await adminProfileService.saveProfileAvatar(file);

      setProfile(saved);
      setPendingAvatar(null);
      setNotice("Profile photo updated.");
    } catch {
      setPendingAvatar(null);
      setError("That image could not be saved.");
    } finally {
      URL.revokeObjectURL(previewUrl);
    }
  }, []);

  const handleRemovePhoto = useCallback(async () => {
    try {
      const saved = await adminProfileService.removeProfileAvatar();
      setProfile(saved);
      setPendingAvatar(null);
      setNotice("Profile photo removed.");
    } catch {
      setError("That profile photo could not be removed.");
    }
  }, []);

  async function handleSave(next: AdminProfile, avatarUrl: string | null) {
    setIsSaving(true);

    try {
      const saved = await adminProfileService.saveProfile({ ...next, avatar_url: avatarUrl });

      setProfile(saved);
      setIsEditing(false);
      setPendingAvatar(null);
      setUpdateConfirmation(true);
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing() {
    setPendingAvatar(profile?.avatar_url ?? null);
    setNotice("");
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setPendingAvatar(null);
  }

  async function updateNotifications(next: NotificationPreferences) {
    setNotifications(next);

    try {
      await adminProfileService.saveNotificationPreferences(next);
    } catch {
      setError("Notification preferences could not be saved.");
    }
  }

  /* ------------------------------------------------------------- fragments */

  function renderBasicInformation() {
    if (!profile) return null;

    return (
      <ProfileSection icon={<UserRound className="icon-accent h-4 w-4" />} title="Basic Information">
        <InfoGrid
          items={[
            { label: "Full Name", value: profile.full_name },
            { label: "Designation", value: profile.designation },
            { label: "Work Location", value: profile.work_location },
            { label: "Employee ID", value: profile.employee_id },
            { label: "Reporting Manager", value: profile.reporting_manager },
            { label: "Shift", value: profile.shift },
            { label: "Date of Joining", value: formatProfileDate(profile.date_of_joining) },
            { label: "Role", value: roleLabel(profile.role) },
            {
              label: "Employee Status",
              value: (
                <StatusPill tone={EMPLOYMENT_STATUS_STYLES[profile.employment_status]}>
                  {profile.employment_status}
                </StatusPill>
              ),
            },
            { label: "Department", value: profile.department },
            { label: "Employment Type", value: profile.employment_type },
            { label: "Experience", value: experienceFrom(profile.date_of_joining) },
          ]}
        />
      </ProfileSection>
    );
  }

  function renderProfileDetails() {
    if (!profile) return null;

    return (
      <ProfileSection icon={<UserRound className="icon-accent h-4 w-4" />} title="Profile Details">
        <div className="grid gap-4 lg:grid-cols-3">
          <DetailCard title="Personal Details">
            <DetailRow label="Date of Birth" value={formatProfileDate(profile.date_of_birth)} />
            <DetailRow label="Gender" value={profile.gender} />
            <DetailRow label="Marital Status" value={profile.marital_status} />
            <DetailRow label="Nationality" value={profile.nationality} />
            <DetailRow label="Blood Group" value={profile.blood_group} />
          </DetailCard>

          <DetailCard title="Address">
            <DetailRow label="Permanent Address" value={profile.permanent_address} />
            <DetailRow label="Current Address" value={profile.current_address} />
          </DetailCard>

          <DetailCard title="Emergency Contact">
            <DetailRow label="Name" value={profile.emergency_name} />
            <DetailRow label="Relationship" value={profile.emergency_relationship} />
            <DetailRow label="Phone" value={profile.emergency_phone} />
            <DetailRow label="Email" value={profile.emergency_email} />
          </DetailCard>
        </div>
      </ProfileSection>
    );
  }

  function renderPersonalTab() {
    if (!profile) return null;

    if (isEditing) {
      return (
        <ProfileSection
          icon={<UserRound className="icon-accent h-4 w-4" />}
          title="Personal Details"
          bodyClassName=""
        >
          <ProfileEditForm
            tab="Personal Details"
            profile={profile}
            avatarUrl={pendingAvatar}
            isSaving={isSaving}
            shiftOptions={shiftOptions}
            onCancel={cancelEditing}
            onSave={handleSave}
          />
        </ProfileSection>
      );
    }

    return (
      <>
        <ProfileSection icon={<UserRound className="icon-accent h-4 w-4" />} title="Personal Details">
          <InfoGrid
            items={[
              { label: "Full Name", value: profile.full_name },
              { label: "Date of Birth", value: formatProfileDate(profile.date_of_birth) },
              { label: "Gender", value: profile.gender },
              { label: "Marital Status", value: profile.marital_status },
              { label: "Nationality", value: profile.nationality },
              { label: "Blood Group", value: profile.blood_group },
            ]}
          />
        </ProfileSection>

        <ProfileSection icon={<UserRound className="icon-accent h-4 w-4" />} title="Emergency Contact">
          <div className="grid gap-4 lg:grid-cols-2">
            <DetailCard title="Primary Contact">
              <DetailRow label="Name" value={profile.emergency_name} />
              <DetailRow label="Relationship" value={profile.emergency_relationship} />
            </DetailCard>

            <DetailCard title="Reach Them At">
              <DetailRow label="Phone" value={profile.emergency_phone} />
              <DetailRow label="Email" value={profile.emergency_email} />
            </DetailCard>
          </div>
        </ProfileSection>
      </>
    );
  }

  function renderProfessionalTab() {
    if (!profile) return null;

    const title = "Professional Details";
    const icon = <Briefcase className="icon-accent h-4 w-4" />;

    if (isEditing) {
      return (
        <ProfileSection icon={icon} title={title} bodyClassName="">
          <ProfileEditForm
            tab="Professional Details"
            profile={profile}
            avatarUrl={pendingAvatar}
            isSaving={isSaving}
            shiftOptions={shiftOptions}
            onCancel={cancelEditing}
            onSave={handleSave}
          />
        </ProfileSection>
      );
    }

    return (
      <ProfileSection icon={icon} title={title}>
        <InfoGrid
          items={[
            { label: "Designation", value: profile.designation },
            { label: "Role", value: roleLabel(profile.role) },
            { label: "Department", value: profile.department },
            { label: "Department Head", value: profile.department_head },
            { label: "Reporting Manager", value: profile.reporting_manager },
            { label: "Work Location", value: profile.work_location },
            { label: "Employment Type", value: profile.employment_type },
            { label: "Shift", value: profile.shift },
            { label: "Date of Joining", value: formatProfileDate(profile.date_of_joining) },
            { label: "Experience", value: experienceFrom(profile.date_of_joining) },
            {
              label: "Employee Status",
              value: (
                <StatusPill tone={EMPLOYMENT_STATUS_STYLES[profile.employment_status]}>
                  {profile.employment_status}
                </StatusPill>
              ),
            },
            { label: "Employee ID", value: profile.employee_id },
          ]}
        />
      </ProfileSection>
    );
  }

  function renderContactTab() {
    if (!profile) return null;

    const title = "Contact & Address";
    const icon = <MapPin className="icon-accent h-4 w-4" />;

    if (isEditing) {
      return (
        <ProfileSection icon={icon} title={title} bodyClassName="">
          <ProfileEditForm
            tab="Contact & Address"
            profile={profile}
            avatarUrl={pendingAvatar}
            isSaving={isSaving}
            shiftOptions={shiftOptions}
            onCancel={cancelEditing}
            onSave={handleSave}
          />
        </ProfileSection>
      );
    }

    return (
      <>
        <ProfileSection icon={icon} title="Contact Information">
          <InfoGrid
            items={[
              { label: "Email", value: profile.email },
              { label: "Phone", value: profile.phone },
              { label: "Office Email", value: profile.office_email },
              { label: "Work Phone", value: profile.work_phone },
            ]}
          />
        </ProfileSection>

        <ProfileSection icon={icon} title="Addresses">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DetailCard title="Permanent Address">
              <DetailRow label="Address" value={profile.permanent_address} />
            </DetailCard>

            <DetailCard title="Current Address">
              <DetailRow label="Address" value={profile.current_address} />
            </DetailCard>
          </div>
        </ProfileSection>
      </>
    );
  }

  function renderDocumentsTab() {
    if (!profile?.employee_id) {
      return (
        <ProfileSection icon={<FileText className="icon-accent h-4 w-4" />} title="My Documents">
          <p className="text-sm text-gray-500">An employee profile is required before documents can be uploaded.</p>
        </ProfileSection>
      );
    }

    return <AdminEmployeeDocuments employeeId={profile.employee_id} />;
  }

  /**
   * Change Password sits under the tab content, so on the Documents tab it
   * lands right below My Documents.
   */
  function renderChangePasswordSection() {
    return (
      <ProfileSection
        id="profile-change-password"
        icon={<Lock className="icon-accent h-4 w-4" />}
        title="Change Password"
      >
        <ChangePasswordForm
          onSubmit={(message) => setNotice(message)}
          isSaving={isSaving}
        />
      </ProfileSection>
    );
  }

  /** Notification Settings lives in the side rail, as it always has. */
  function renderNotificationSection() {
    return (
      <ProfileSection
        id="profile-notifications"
        icon={<Bell className="icon-accent h-4 w-4" />}
        title="Notification Settings"
        // The toggles carry their own vertical padding, so the heading and the
        // body's top padding are both trimmed to keep the gap small.
        headerClassName="px-5 pb-2 pt-4"
        bodyClassName="px-5 pb-5 pt-0"
      >
        {notifications && (
          <div className="divide-y divide-gray-100">
            <Toggle
              label="Email Notifications"
              description="Receive a digest of activity over email."
              checked={notifications.email_notifications}
              onChange={(next) =>
                updateNotifications({ ...notifications, email_notifications: next })
              }
            />

            <Toggle
              label="Push Notifications"
              description="Show in-app alerts while you are signed in."
              checked={notifications.push_notifications}
              onChange={(next) =>
                updateNotifications({ ...notifications, push_notifications: next })
              }
            />

            <Toggle
              label="Leave Updates"
              description="New and decided leave requests."
              checked={notifications.leave_updates}
              onChange={(next) =>
                updateNotifications({ ...notifications, leave_updates: next })
              }
            />

            <Toggle
              label="Payroll Alerts"
              description="Payslips and payroll announcements."
              checked={notifications.payroll_alerts}
              onChange={(next) =>
                updateNotifications({ ...notifications, payroll_alerts: next })
              }
            />
          </div>
        )}
      </ProfileSection>
    );
  }

  function renderTabContent() {
    const current = profile;

    if (!current) return null;

    switch (activeTab) {
      case "Personal Details":
        return renderPersonalTab();
      case "Professional Details":
        return renderProfessionalTab();
      case "Contact & Address":
        return renderContactTab();
      case "Documents":
        return renderDocumentsTab();
      default:
        return (
          <>
            {isEditing ? (
              <ProfileSection
                icon={<UserRound className="icon-accent h-4 w-4" />}
                title="Edit Overview"
                bodyClassName=""
              >
                <ProfileEditForm
                  tab="Overview"
                  profile={current}
                  avatarUrl={pendingAvatar}
                  isSaving={isSaving}
                  shiftOptions={shiftOptions}
                  onCancel={cancelEditing}
                  onSave={handleSave}
                />
              </ProfileSection>
            ) : (
              <>
                {renderBasicInformation()}
                {renderProfileDetails()}
              </>
            )}
          </>
        );
    }
  }

  /* ------------------------------------------------------------------ view */

  if (isLoading) {
    return (
      <div className="px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10">
        <div className="h-56 animate-pulse rounded-2xl bg-white" />
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="h-96 animate-pulse rounded-2xl bg-white xl:col-span-2" />
          <div className="h-96 animate-pulse rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10">
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-6 py-4 text-sm text-rose-600">
          {error || "Your profile could not be loaded."}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10">
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="mb-4 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            className="shrink-0 text-xs font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {updateConfirmation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="presentation"
          onMouseDown={() => setUpdateConfirmation(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-update-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 id="profile-update-title" className="mt-4 text-lg font-bold text-slate-900">
              Profile updated
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Your selected shift and profile changes were saved to the database.
            </p>
            <button
              type="button"
              onClick={() => setUpdateConfirmation(false)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
            >
              Continue
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <ProfileAvatar
            name={profile.full_name}
            avatarUrl={pendingAvatar ?? profile.avatar_url}
            onPickPhoto={(file) => void handlePhoto(file)}
            onRemove={() => void handleRemovePhoto()}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="min-w-0 break-words text-2xl font-bold text-gray-900">
                {profile.full_name}
              </h1>

              <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-[#2563eb]">
                {roleLabel(profile.role)}
              </span>
            </div>

            <p className="mt-1 break-words text-sm font-medium text-gray-600">
              {profile.designation}
            </p>

            <div className="mt-3 space-y-1.5">
              {[
                { icon: <Mail className="h-4 w-4" />, value: profile.email },
                { icon: <Phone className="h-4 w-4" />, value: profile.phone },
                { icon: <MapPin className="h-4 w-4" />, value: profile.work_location },
              ].map((line) => (
                <p key={line.value} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <span className="text-[#2563eb]">{line.icon}</span>
                  {line.value}
                </p>
              ))}
            </div>
          </div>

          {!isEditing && (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-[#2563eb] px-4 text-sm font-semibold text-[#2563eb] transition hover:bg-blue-50"
            >
              <Pencil className="h-4 w-4" />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Body: profile tabs + action rail */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <div className="rounded-2xl border border-gray-100 bg-white px-5 pt-4 shadow-sm">
            <ProfileTabBar active={activeTab} onChange={setActiveTab} />
          </div>

          <div className="mt-4 space-y-4">{renderTabContent()}</div>

          {/* Change Password sits under the tab content, so on the Documents
              tab it lands right below My Documents. */}
          <div className="mt-4 space-y-4">{renderChangePasswordSection()}</div>
        </div>

        <aside className="space-y-4">
          <ProfileSection
            icon={<SlidersHorizontal className="icon-accent h-4 w-4" />}
            title="Quick Actions"
            bodyClassName=""
          >
            <QuickActionRow
              icon={<Pencil className="icon-accent h-4 w-4" />}
              title="Edit Profile"
              description="Update the personal and professional details"
              onClick={startEditing}
            />

            <QuickActionRow
              icon={<Lock className="icon-accent h-4 w-4" />}
              title="Change Password"
              description="Update your account password"
              onClick={() => scrollToSection("profile-change-password")}
            />

            <QuickActionRow
              icon={<FileText className="icon-accent h-4 w-4" />}
              title="Manage Documents"
              description="View and manage your documents"
              onClick={() => {
                setIsEditing(false);
                setActiveTab("Documents");
              }}
            />

            <QuickActionRow
              icon={<Bell className="icon-accent h-4 w-4" />}
              title="Notification Settings"
              description="Configure your notification preferences"
              onClick={() => scrollToSection("profile-notifications")}
            />
          </ProfileSection>

          {renderNotificationSection()}

          <ProfileSection icon={<Headphones className="icon-accent h-4 w-4" />} title="Help &amp; Support">
            <p className="text-sm font-bold text-gray-900">Need help?</p>

            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              Contact IT or HR support for any assistance.
            </p>

            <div className="mt-4 space-y-2.5">
              <a
                href={`tel:${support.phone.replace(/\s/g, "")}`}
                className="flex items-center gap-2.5 text-sm font-semibold text-[#2563eb] hover:underline"
              >
                <Phone className="h-4 w-4" />
                {support.phone}
              </a>

              <a
                href={`mailto:${support.email}`}
                className="flex items-center gap-2.5 text-sm font-semibold text-[#2563eb] hover:underline"
              >
                <Mail className="h-4 w-4" />
                {support.email}
              </a>
            </div>
          </ProfileSection>
        </aside>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- password form */

/**
 * Changes the signed-in admin's password.
 *
 * The rules here mirror the server's (`validate_password_strength` in the
 * auth schemas) so a weak password is caught inline instead of coming back
 * as a 422. The current password is checked by the server, which answers
 * "Current password is incorrect" when it does not match.
 */
function ChangePasswordForm({
  isSaving,
  onSubmit,
}: {
  isSaving: boolean;
  onSubmit: (message: string) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isChanging, setIsChanging] = useState(false);

  const busy = isSaving || isChanging;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    setError("");

    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }

    if (newPassword.length < 8 || newPassword.length > 128) {
      setError("The new password must be between 8 and 128 characters.");
      return;
    }

    const failedRule = [
      { label: "an uppercase letter", ok: /[A-Z]/.test(newPassword) },
      { label: "a lowercase letter", ok: /[a-z]/.test(newPassword) },
      { label: "a number", ok: /[0-9]/.test(newPassword) },
      { label: "a special character", ok: /[^A-Za-z0-9]/.test(newPassword) },
    ].find((rule) => !rule.ok);

    if (failedRule) {
      setError(`The new password needs ${failedRule.label}.`);
      return;
    }

    if (newPassword === currentPassword) {
      setError("The new password must be different from the current one.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }

    setIsChanging(true);

    try {
      await authService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      onSubmit("Password changed successfully.");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to change your password. Please try again.",
      );
    } finally {
      setIsChanging(false);
    }
  }

  const inputClass =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 " +
    "outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="current-password" className="mb-1.5 block text-xs font-semibold text-slate-600">
            Current Password <span className="ml-1 text-red-500">*</span>
          </label>
          <input
            id="current-password"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            disabled={busy}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-xs font-semibold text-slate-600">
            New Password <span className="ml-1 text-red-500">*</span>
          </label>
          <input
            id="new-password"
            type="password"
            required
            autoComplete="new-password"
            value={newPassword}
            disabled={busy}
            onChange={(event) => setNewPassword(event.target.value)}
            className={inputClass}
          />

          <p className="mt-1.5 text-[11px] text-slate-400">
            At least 8 characters with an uppercase letter, a lowercase letter,
            a number and a special character.
          </p>
        </div>

        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-semibold text-slate-600">
            Confirm Password <span className="ml-1 text-red-500">*</span>
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            disabled={busy}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2563eb] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:opacity-60"
      >
        <Lock className="h-4 w-4" />
        {busy ? "Updating..." : "Update Password"}
      </button>
    </form>
  );
}
