import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  Headphones,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Quote,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserRound,
} from "lucide-react";

import ProfileEditForm from "../../components/admin/profile/ProfileEditForm";
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
  DOCUMENT_STATUS_STYLES,
  EMPLOYMENT_STATUS_STYLES,
  PROFILE_QUOTE,
  experienceFrom,
  formatProfileDate,
  formatProfileDateTime,
} from "../../components/admin/profile/profileFields";
import { adminProfileService } from "../../services/adminProfileService";
import type {
  AdminProfile,
  NotificationPreferences,
  ProfileActivity,
  ProfileDocument,
  ProfileTab,
  SessionInfo,
} from "../../types/adminProfile";

function roleLabel(role: string): string {
  return role === "hr_admin" ? "HR Admin" : role.replaceAll("_", " ");
}

/** Opens a picked image in memory so the preview works before any upload. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [activities, setActivities] = useState<ProfileActivity[]>([]);
  const [documents, setDocuments] = useState<ProfileDocument[]>([]);
  const [notifications, setNotifications] = useState<NotificationPreferences | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [activeTab, setActiveTab] = useState<ProfileTab>("Overview");
  const [isEditing, setIsEditing] = useState(false);
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);

  const support = adminProfileService.getSupportContact();

  useEffect(() => {
    let cancelled = false;

    // Each panel degrades on its own: a failed session lookup must not take the
    // whole profile page down with it.
    Promise.allSettled([
      adminProfileService.getProfile(),
      adminProfileService.getSession(),
      adminProfileService.listActivities(),
      adminProfileService.listDocuments(),
      adminProfileService.getNotificationPreferences(),
    ]).then(([profileResult, sessionResult, activityResult, documentsResult, notificationsResult]) => {
      if (cancelled) return;

      let hasError = false;

      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value);
      } else {
        hasError = true;
      }

      if (sessionResult.status === "fulfilled") setSession(sessionResult.value);

      if (activityResult.status === "fulfilled") {
        setActivities(activityResult.value);
      } else {
        hasError = true;
      }

      if (documentsResult.status === "fulfilled") {
        setDocuments(documentsResult.value);
      } else {
        hasError = true;
      }

      if (notificationsResult.status === "fulfilled") {
        setNotifications(notificationsResult.value);
      } else {
        hasError = true;
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
    try {
      setPendingAvatar(await readAsDataUrl(file));
      setNotice("Photo ready. Save changes to keep it.");
    } catch {
      setError("That image could not be read.");
    }
  }, []);

  async function handleSave(next: AdminProfile, avatarUrl: string | null) {
    setIsSaving(true);

    try {
      const saved = await adminProfileService.saveProfile({ ...next, avatar_url: avatarUrl });

      setProfile(saved);
      setIsEditing(false);
      setPendingAvatar(null);
      setNotice("Profile updated successfully.");
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

  function renderWorkInformation() {
    if (!profile) return null;

    return (
      <ProfileSection icon={<Briefcase className="icon-accent h-4 w-4" />} title="Work Information">
        <InfoGrid
          columns="sm:grid-cols-2 xl:grid-cols-4"
          items={[
            { label: "Office Email", value: profile.office_email },
            { label: "Work Phone", value: profile.work_phone },
            { label: "Manager", value: profile.department_head },
            { label: "Department Head", value: profile.department_head },
          ]}
        />
      </ProfileSection>
    );
  }

  function renderActivityTable() {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th className="pb-3">Date &amp; Time</th>
              <th className="pb-3">Activity</th>
              <th className="pb-3">Module</th>
              <th className="pb-3">Details</th>
            </tr>
          </thead>

          <tbody>
            {activities.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-500">
                  No recent activity.
                </td>
              </tr>
            ) : (
              activities.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-3.5 text-gray-600">{formatProfileDateTime(entry.occurred_at)}</td>
                  <td className="py-3.5 font-medium text-[#2563eb]">{entry.activity}</td>
                  <td className="py-3.5 text-gray-600">{entry.module}</td>
                  <td className="py-3.5 text-gray-600">{entry.details}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function renderRecentActivities() {
    return (
      <ProfileSection
        icon={<Clock className="icon-accent h-4 w-4" />}
        title="Recent Activities"
        action={
          <button
            type="button"
            onClick={() => setActiveTab("Account Settings")}
            className="text-xs font-semibold text-[#2563eb] hover:underline"
          >
            View All
          </button>
        }
      >
        {renderActivityTable()}
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
    return (
      <ProfileSection
        icon={<FileText className="icon-accent h-4 w-4" />}
        title="My Documents"
        action={
          <button
            type="button"
            onClick={() => setNotice("Uploads will be connected once document storage is available.")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="pb-3">Document</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Uploaded On</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    No documents uploaded yet.
                  </td>
                </tr>
              ) : (
                documents.map((document) => (
                  <tr key={document.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3.5 font-medium text-gray-800">{document.name}</td>
                    <td className="py-3.5 text-gray-600">{document.type}</td>
                    <td className="py-3.5 text-gray-600">{formatProfileDate(document.uploaded_on)}</td>
                    <td className="py-3.5">
                      <StatusPill tone={DOCUMENT_STATUS_STYLES[document.status]}>
                        {document.status}
                      </StatusPill>
                    </td>
                    <td className="py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setNotice(`Opening ${document.name} will be connected once document storage is available.`)
                        }
                        className="text-xs font-semibold text-[#2563eb] hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ProfileSection>
    );
  }

  function renderAccountTab() {
    return (
      <>
        <ProfileSection icon={<ShieldCheck className="icon-accent h-4 w-4" />} title="Session & Security">
          <div className="space-y-4">
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Login Status</p>
                <div className="mt-1">
                  <StatusPill tone="bg-emerald-50 text-emerald-600">
                    {session?.login_status ?? "Active"}
                  </StatusPill>
                </div>
              </div>

              <InfoGrid
                columns="sm:col-span-3 sm:grid-cols-3"
                items={[
                  { label: "Last Login", value: formatProfileDateTime(session?.last_login) },
                  { label: "Device", value: session?.device ?? "—" },
                  { label: "IP Address", value: session?.ip_address ?? "—" },
                ]}
              />
            </div>

            {showLoginHistory ? (
              renderActivityTable()
            ) : (
              <button
                type="button"
                onClick={() => setShowLoginHistory(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                <RotateCcw className="h-4 w-4" />
                View Login History
              </button>
            )}
          </div>
        </ProfileSection>

        <ProfileSection icon={<Lock className="icon-accent h-4 w-4" />} title="Change Password">
          <ChangePasswordForm
            onSubmit={(message) => setNotice(message)}
            isSaving={isSaving}
          />
        </ProfileSection>

        <ProfileSection icon={<Bell className="icon-accent h-4 w-4" />} title="Notification Settings">
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
      </>
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
      case "Account Settings":
        return renderAccountTab();
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

            {renderWorkInformation()}
            {renderRecentActivities()}
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

      {/* Hero */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <ProfileAvatar
            name={profile.full_name}
            avatarUrl={pendingAvatar ?? profile.avatar_url}
            onPickPhoto={(file) => void handlePhoto(file)}
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

          <div className="flex w-full flex-wrap items-center gap-4 sm:w-auto">
            <div className="min-w-0 flex-1 rounded-xl bg-blue-50/60 px-5 py-4 sm:max-w-xs">
              <Quote className="icon-accent h-4 w-4" />

              <p className="mt-2 text-sm font-semibold italic leading-relaxed text-[#1e3a8a]">
                &ldquo;{PROFILE_QUOTE}&rdquo;
              </p>

              <p className="mt-2 text-xs font-semibold text-gray-500">
                &mdash; {profile.full_name}
              </p>
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
      </div>

      {/* Body: profile tabs + action rail */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <div className="rounded-2xl border border-gray-100 bg-white px-5 pt-4 shadow-sm">
            <ProfileTabBar active={activeTab} onChange={setActiveTab} />
          </div>

          <div className="mt-4 space-y-4">{renderTabContent()}</div>
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
              onClick={() => {
                setIsEditing(false);
                setActiveTab("Account Settings");
              }}
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
              onClick={() => {
                setIsEditing(false);
                setActiveTab("Account Settings");
              }}
            />
          </ProfileSection>

          <ProfileSection icon={<ShieldCheck className="icon-accent h-4 w-4" />} title="System Access">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-600">Login Status</span>
                <StatusPill tone="bg-emerald-50 text-emerald-600">
                  {session?.login_status ?? "Active"}
                </StatusPill>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="shrink-0 text-sm text-gray-600">Last Login</span>
                <span className="min-w-0 text-right text-sm font-semibold text-gray-800">
                  {formatProfileDateTime(session?.last_login)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="shrink-0 text-sm text-gray-600">Device</span>
                <span className="min-w-0 text-right text-sm font-semibold text-gray-800">
                  {session?.device ?? "—"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="shrink-0 text-sm text-gray-600">IP Address</span>
                <span className="min-w-0 text-right text-sm font-semibold text-gray-800">
                  {session?.ip_address ?? "—"}
                </span>
              </div>

              <div className="border-t border-gray-100 pt-3.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setActiveTab("Account Settings");
                    setShowLoginHistory(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  View Login History
                </button>
              </div>
            </div>
          </ProfileSection>

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
 * Validated locally. The submit reports that the auth endpoint is not wired up
 * yet rather than pretending the password changed.
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (currentPassword.length < 6) {
      setError("Enter your current password.");
      return;
    }

    if (newPassword.length < 8) {
      setError("The new password must be at least 8 characters.");
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

    onSubmit("Password changes will be connected once the auth endpoint is updated.");

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  const inputClass =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 " +
    "outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="current-password" className="mb-1.5 block text-xs font-semibold text-slate-600">
            Current Password
          </label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            disabled={isSaving}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-xs font-semibold text-slate-600">
            New Password
          </label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            disabled={isSaving}
            onChange={(event) => setNewPassword(event.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-semibold text-slate-600">
            Confirm Password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            disabled={isSaving}
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
        disabled={isSaving}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2563eb] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:opacity-60"
      >
        <Lock className="h-4 w-4" />
        Update Password
      </button>
    </form>
  );
}
