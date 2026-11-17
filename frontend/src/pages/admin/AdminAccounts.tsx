/**
 * Admin Accounts: the super admin's page for creating and deleting HR admin
 * and manager accounts, and for unlocking accounts that locked themselves
 * after too many failed sign-ins.
 *
 * Every call goes to /users/admin-accounts, which the backend guards with
 * require_super_admin. Hiding the page from other roles (canAccessPage,
 * Sidebar) is only a UI convenience.
 */
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  BadgeCheck,
  Lock,
  LockOpen,
  Plus,
  Power,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";

import {
  InlineNoticeBanner,
  Panel,
} from "../../components/admin/exit/ExitUi";
import {
  INPUT_CLASS,
  type InlineNotice,
} from "../../components/admin/exit/exitUiUtils";
import { TableSkeleton } from "../../components/ui";
import { roleLabel } from "../../lib/access";
import { ApiError } from "../../services/api";
import {
  userService,
  type AdminAccount,
  type AdminAccountCreate,
  type ManagedAdminRole,
} from "../../services/userService";

/** Value of the role dropdown above the accounts table. */
type RoleFilter = "all" | ManagedAdminRole;

// No email_verification_token here: it is only added at submit time, once
// the address has been verified with an OTP.
const EMPTY_FORM: AdminAccountCreate = {
  full_name: "",
  email: "",
  password: "",
  role: "hr_admin",
};

// A loose shape check so an obvious typo does not use up an OTP request.
// The server validates the address properly (EmailStr).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_HINT =
  "At least 8 characters, with an uppercase letter, a lowercase letter, a number and a symbol.";

/** The server's message for an ApiError, otherwise a generic fallback. */
function errorText(cause: unknown, fallback: string): string {
  return cause instanceof ApiError ? cause.message : fallback;
}

/** Mirrors the backend's validate_password_strength, so most mistakes are
 *  caught before the request goes out. The server still has the final say. */
function passwordProblem(value: string): string | null {
  if (value.length < 8) return "Password must be at least 8 characters long.";
  if (!/[A-Z]/.test(value)) return "Password needs an uppercase letter.";
  if (!/[a-z]/.test(value)) return "Password needs a lowercase letter.";
  if (!/[0-9]/.test(value)) return "Password needs a number.";
  if (!/[^A-Za-z0-9]/.test(value)) return "Password needs a special character.";
  return null;
}

/** One status per row. An account that is both inactive and locked shows
 *  as Inactive. */
function StatusBadge({ account }: { account: AdminAccount }) {
  if (!account.is_active) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
        Inactive
      </span>
    );
  }

  if (account.is_locked) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
        Locked
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
      Active
    </span>
  );
}

/** Coloured pill for the account's role: blue for HR admin, violet for manager. */
function RoleBadge({ role }: { role: ManagedAdminRole }) {
  const tone =
    role === "hr_admin"
      ? "bg-blue-50 text-blue-700"
      : "bg-violet-50 text-violet-700";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {roleLabel(role)}
    </span>
  );
}

/** One count in the KPI row above the table. */
function StatCard({
  label,
  value,
  icon,
  iconBg,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  iconBg: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

/** In-app replacement for window.confirm before deleting an account.
 *  Unlock and activate only restore access, so they apply straight away. */
function ConfirmDeleteDialog({
  account,
  working,
  onConfirm,
  onCancel,
}: {
  account: AdminAccount;
  working: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const title = "Delete account";

  // Escape cancels, like the backdrop click below, but neither does while
  // the request is in flight.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) onCancel();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, working]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-6"
      onClick={working ? undefined : onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50">
            <Trash2 className="h-5 w-5 text-rose-600" />
          </span>

          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Delete {account.full_name}'s {roleLabel(account.role)} account? They
              will be signed out and can no longer sign in. This cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={working}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={working}
            autoFocus
            className="inline-flex h-10 items-center rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {working ? "Deleting..." : "Delete account"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Create an HR admin or manager account.
 *
 * The email must be verified first: Send OTP emails a 6-digit code to the
 * new address, Verify OTP trades it for a verification token, and the create
 * request carries that token. The server rejects a create without one and
 * consumes it on success, so each verification is good for one account.
 */
function CreateAccountForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (account: AdminAccount) => void;
}) {
  const [form, setForm] = useState<AdminAccountCreate>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email OTP verification. The token is tied to verifiedEmail, so editing
  // the address afterwards throws the verification away.
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpInfo, setOtpInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Count down the resend cooldown the server reported, one tick a second.
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const normalizedEmail = form.email.trim().toLowerCase();
  // Only true while the field still holds the address that was verified.
  const emailVerified =
    Boolean(verificationToken) && verifiedEmail === normalizedEmail;

  const update = <K extends keyof AdminAccountCreate>(
    key: K,
    value: AdminAccountCreate[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const changeEmail = (value: string) => {
    update("email", value);

    // A code or verification belongs to the address it was sent to.
    if (otpSent || verifiedEmail || otpError) {
      setVerifiedEmail(null);
      setVerificationToken(null);
      setOtpSent(false);
      setOtpValue("");
      setOtpError(null);
      setOtpInfo(null);
      setCooldown(0);
    }
  };

  /** Email a code to the new account's address. The server refuses an
   *  address that already has an account and rate limits requests per
   *  address; cooldown_seconds drives the Resend button. */
  const sendOtp = async () => {
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setOtpError("Enter a valid email address before requesting an OTP.");
      return;
    }

    setSendingOtp(true);
    setOtpError(null);
    setOtpInfo(null);

    try {
      const response = await userService.requestAdminEmailOtp(normalizedEmail);

      setOtpSent(true);
      setOtpValue("");
      setCooldown(response.cooldown_seconds);
      setOtpInfo(
        `Code sent to ${normalizedEmail}. It expires in ${response.expires_in_minutes} minutes.`,
      );
    } catch (cause: unknown) {
      setOtpError(errorText(cause, "Unable to send the verification code."));
    } finally {
      setSendingOtp(false);
    }
  };

  /** Trade the code for the verification token the create call needs. */
  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(otpValue)) {
      setOtpError("Enter the 6-digit code.");
      return;
    }

    setVerifyingOtp(true);
    setOtpError(null);

    try {
      const response = await userService.verifyAdminEmailOtp(normalizedEmail, otpValue);

      // Remember which address the token is for; see emailVerified.
      setVerifiedEmail(response.email.toLowerCase());
      setVerificationToken(response.verification_token);
      setOtpInfo(null);
      // Clears a "verify the email first" error left by an early submit.
      setError(null);
    } catch (cause: unknown) {
      setOtpError(errorText(cause, "Invalid or expired OTP. Try again."));
    } finally {
      setVerifyingOtp(false);
    }
  };

  /** Check the fields locally, then create the account with the
   *  verification token attached. */
  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const name = form.full_name.trim();
    const email = form.email.trim();

    if (name.length < 2) {
      setError("Enter the person's full name.");
      return;
    }

    if (!email) {
      setError("Enter an email address.");
      return;
    }

    const problem = passwordProblem(form.password);

    if (problem) {
      setError(problem);
      return;
    }

    if (!emailVerified || !verificationToken) {
      setError("Verify the email address with an OTP before creating the account.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const account = await userService.createAdminAccount({
        ...form,
        full_name: name,
        email,
        email_verification_token: verificationToken,
      });

      onCreated(account);
    } catch (cause: unknown) {
      setError(errorText(cause, "Unable to create the account."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Create admin account"
      description="The person signs in with this email and password, and can change the password later."
      className="mb-5"
      action={
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Full name<span className="text-rose-500"> *</span></span>
          <input
            className={INPUT_CLASS}
            value={form.full_name}
            onChange={(event) => update("full_name", event.target.value)}
            autoComplete="off"
            maxLength={100}
            required
          />
        </label>

        <div>
          <label
            htmlFor="admin-account-email"
            className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600"
          >
            <span>
              Email<span className="text-rose-500"> *</span>
            </span>
            {emailVerified && (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <input
              id="admin-account-email"
              className={INPUT_CLASS}
              type="email"
              value={form.email}
              onChange={(event) => changeEmail(event.target.value)}
              autoComplete="off"
              required
            />
            <button
              type="button"
              onClick={sendOtp}
              disabled={sendingOtp || verifyingOtp || cooldown > 0 || emailVerified}
              className="inline-flex h-9 shrink-0 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
            >
              {sendingOtp
                ? "Sending..."
                : emailVerified
                  ? "Verified"
                  : cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : otpSent
                      ? "Resend OTP"
                      : "Send OTP"}
            </button>
          </div>
          {!otpSent && !emailVerified && !otpError && (
            <p className="mt-1 text-[11px] text-slate-500">
              Send an OTP to confirm this address before creating the account.
            </p>
          )}
          {!otpSent && otpError && (
            <p className="mt-1 text-[11px] text-rose-600" role="alert">
              {otpError}
            </p>
          )}
        </div>

        {/* OTP entry: shown once a code has been sent, gone once verified. */}
        {otpSent && !emailVerified && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 sm:col-span-2">
            <label
              htmlFor="admin-account-otp"
              className="mb-1 block text-xs font-semibold text-slate-600"
            >
              Enter the 6-digit OTP sent to {normalizedEmail}
            </label>
            <div className="flex gap-2">
              <input
                id="admin-account-otp"
                className={`${INPUT_CLASS} max-w-48 font-mono tracking-widest`}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={otpValue}
                onChange={(event) => {
                  setOtpValue(event.target.value.replace(/\D/g, "").slice(0, 6));
                  setOtpError(null);
                }}
                onKeyDown={(event) => {
                  // Enter here verifies the code rather than submitting the form.
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (otpValue.length === 6 && !verifyingOtp) void verifyOtp();
                  }
                }}
              />
              <button
                type="button"
                onClick={verifyOtp}
                disabled={verifyingOtp || sendingOtp || otpValue.length !== 6}
                className="inline-flex h-9 shrink-0 items-center rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifyingOtp ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
            {otpError ? (
              <p className="mt-2 text-xs text-rose-600" role="alert">
                {otpError}
              </p>
            ) : (
              otpInfo && <p className="mt-2 text-xs text-slate-500">{otpInfo}</p>
            )}
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Role<span className="text-rose-500"> *</span></span>
          <select
            className={INPUT_CLASS}
            value={form.role}
            onChange={(event) => update("role", event.target.value as ManagedAdminRole)}
            required
          >
            <option value="hr_admin">HR: full access</option>
            <option value="manager">Manager: own team, no payroll or recruitment</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Password<span className="text-rose-500"> *</span></span>
          <input
            className={INPUT_CLASS}
            type="password"
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            autoComplete="new-password"
            maxLength={128}
            required
          />
          <span className="mt-1 block text-[11px] text-slate-500">{PASSWORD_HINT}</span>
        </label>

        {error && (
          <p className="text-sm text-rose-600 sm:col-span-2" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 sm:col-span-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !emailVerified}
            title={emailVerified ? undefined : "Verify the email address first"}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create account"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

/** Super admin page: KPI counts, the create form and the accounts table. */
export default function AdminAccounts() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<InlineNotice>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");
  // The account waiting on the delete confirmation, if any.
  const [pendingDelete, setPendingDelete] = useState<AdminAccount | null>(null);

  // Load once on mount. `active` stops a late response from updating the
  // page after it has unmounted.
  useEffect(() => {
    let active = true;

    userService
      .listAdminAccounts()
      .then((rows) => {
        if (!active) return;
        setAccounts(rows);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorText(cause, "Unable to load admin accounts."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  /** Swap in the server's copy of one account, keeping the list order. */
  const replaceAccount = (updated: AdminAccount) =>
    setAccounts((current) =>
      current.map((account) => (account.id === updated.id ? updated : account)),
    );

  /**
   * Unlock (which also resets the failed-login counter) or reactivate an
   * account that was deactivated before Delete replaced Deactivate.
   */
  const changeStatus = async (
    account: AdminAccount,
    change: { is_active?: boolean; is_locked?: boolean },
    successText: string,
  ) => {
    setBusyId(account.id);

    try {
      const updated = await userService.updateAdminAccountStatus(account.id, change);
      replaceAccount(updated);
      setNotice({ type: "success", text: successText });
    } catch (cause: unknown) {
      setNotice({
        type: "error",
        text: errorText(cause, "Unable to update the account."),
      });
    } finally {
      setBusyId(null);
    }
  };

  // The dialog closes whether or not the delete worked; the result shows in
  // the notice banner (e.g. a manager who still has a team is refused).
  const confirmDelete = async () => {
    if (!pendingDelete) return;

    const account = pendingDelete;
    setBusyId(account.id);

    try {
      await userService.deleteAdminAccount(account.id);
      setAccounts((current) => current.filter((row) => row.id !== account.id));
      setNotice({ type: "success", text: `${account.full_name}'s account was deleted.` });
    } catch (cause: unknown) {
      setNotice({
        type: "error",
        text: errorText(cause, "Unable to delete the account."),
      });
    } finally {
      setBusyId(null);
      setPendingDelete(null);
    }
  };

  const counts = useMemo(
    () => ({
      hr: accounts.filter((a) => a.role === "hr_admin").length,
      managers: accounts.filter((a) => a.role === "manager").length,
      // Accounts that cannot sign in, for either reason.
      blocked: accounts.filter((a) => !a.is_active || a.is_locked).length,
    }),
    [accounts],
  );

  // Role filter and name/email search, both applied in the browser.
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();

    return accounts.filter(
      (account) =>
        (roleFilter === "all" || account.role === roleFilter) &&
        (!query ||
          account.full_name.toLowerCase().includes(query) ||
          account.email.toLowerCase().includes(query)),
    );
  }, [accounts, roleFilter, search]);

  return (
    <div className="px-5 pb-10 pt-8 sm:px-8 xl:px-10">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-slate-900 sm:text-3xl">
            Admin Accounts
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create, delete and unlock the HR admin and manager accounts.
          </p>
        </div>

        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Account
          </button>
        )}
      </div>

      <InlineNoticeBanner notice={notice} onDismiss={() => setNotice(null)} />

      {creating && (
        <CreateAccountForm
          onCancel={() => setCreating(false)}
          onCreated={(account) => {
            // The server creates the account even when the welcome email
            // fails, and reports that in welcome_email_sent.
            setAccounts((current) => [...current, account]);
            setCreating(false);
            setNotice({
              type: "success",
              text: `${roleLabel(account.role)} account created for ${account.full_name}. ${
                account.welcome_email_sent
                  ? `A welcome email was sent to ${account.email}.`
                  : "The welcome email could not be sent, so share the sign-in details yourself."
              }`,
            });
          }}
        />
      )}

      {/* KPI row */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="HR"
          value={counts.hr}
          icon={<ShieldCheck className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Managers"
          value={counts.managers}
          icon={<UserCog className="h-5 w-5 text-violet-600" />}
          iconBg="bg-violet-50"
        />
        <StatCard
          label="Inactive or Locked"
          value={counts.blocked}
          icon={<Lock className="h-5 w-5 text-amber-600" />}
          iconBg="bg-amber-50"
        />
      </div>

      <Panel
        title="All admin accounts"
        description="Deleting an account signs it out on every device straight away. Accounts lock themselves after 5 failed sign-ins."
        bodyClassName="p-0"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${INPUT_CLASS} w-48`}
              placeholder="Search name or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search admin accounts"
            />
            <select
              className={`${INPUT_CLASS} w-36`}
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
              aria-label="Filter by role"
            >
              <option value="all">All roles</option>
              <option value="hr_admin">HR</option>
              <option value="manager">Managers</option>
            </select>
          </div>
        }
      >
        {loading ? (
          <div className="p-5">
            <TableSkeleton />
          </div>
        ) : error ? (
          <p className="py-10 text-center text-sm text-rose-600">{error}</p>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Users className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">
              {accounts.length === 0
                ? "No HR admin or manager accounts yet."
                : "No accounts match these filters."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Employee ID</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((account) => {
                  const busy = busyId === account.id;

                  return (
                    <tr key={account.id} className="align-middle">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900">{account.full_name}</p>
                        <p className="text-xs text-slate-500">{account.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <RoleBadge role={account.role} />
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {account.employee_id ?? "-"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge account={account} />
                      </td>
                      <td className="px-5 py-3">
                        {/* Unlock (accounts lock themselves after 5 failed
                            sign-ins) and Activate (accounts deactivated before
                            Delete existed) apply at once; Delete asks first. */}
                        <div className="flex justify-end gap-2">
                          {account.is_locked && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                changeStatus(
                                  account,
                                  { is_locked: false },
                                  `${account.full_name} unlocked.`,
                                )
                              }
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                              <LockOpen className="h-3.5 w-3.5" />
                              Unlock
                            </button>
                          )}

                          {!account.is_active && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                changeStatus(
                                  account,
                                  { is_active: true },
                                  `${account.full_name} reactivated.`,
                                )
                              }
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                            >
                              <Power className="h-3.5 w-3.5" />
                              Activate
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setPendingDelete(account)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {pendingDelete && (
        <ConfirmDeleteDialog
          account={pendingDelete}
          working={busyId === pendingDelete.id}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
