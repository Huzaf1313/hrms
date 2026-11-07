import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Lock,
  LockOpen,
  Plus,
  Power,
  ShieldCheck,
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

type RoleFilter = "all" | ManagedAdminRole;

const EMPTY_FORM: AdminAccountCreate = {
  full_name: "",
  email: "",
  password: "",
  role: "hr_admin",
};

const PASSWORD_HINT =
  "At least 8 characters, with an uppercase letter, a lowercase letter, a number and a symbol.";

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

  const update = <K extends keyof AdminAccountCreate>(
    key: K,
    value: AdminAccountCreate[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

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

    setSaving(true);
    setError(null);

    try {
      const account = await userService.createAdminAccount({
        ...form,
        full_name: name,
        email,
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
          <span className="mb-1 block text-xs font-semibold text-slate-600">Full name</span>
          <input
            className={INPUT_CLASS}
            value={form.full_name}
            onChange={(event) => update("full_name", event.target.value)}
            autoComplete="off"
            maxLength={100}
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Email</span>
          <input
            className={INPUT_CLASS}
            type="email"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            autoComplete="off"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Role</span>
          <select
            className={INPUT_CLASS}
            value={form.role}
            onChange={(event) => update("role", event.target.value as ManagedAdminRole)}
          >
            <option value="hr_admin">HR Admin: full access</option>
            <option value="manager">Manager: own team, no payroll or recruitment</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Password</span>
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
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create account"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

export default function AdminAccounts() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<InlineNotice>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");

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

  const replaceAccount = (updated: AdminAccount) =>
    setAccounts((current) =>
      current.map((account) => (account.id === updated.id ? updated : account)),
    );

  const changeStatus = async (
    account: AdminAccount,
    change: { is_active?: boolean; is_locked?: boolean },
    successText: string,
    confirmText?: string,
  ) => {
    if (confirmText && !window.confirm(confirmText)) return;

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

  const counts = useMemo(
    () => ({
      hr: accounts.filter((a) => a.role === "hr_admin").length,
      managers: accounts.filter((a) => a.role === "manager").length,
      blocked: accounts.filter((a) => !a.is_active || a.is_locked).length,
    }),
    [accounts],
  );

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
            Create, deactivate and unlock the HR admin and manager accounts.
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
            setAccounts((current) => [...current, account]);
            setCreating(false);
            setNotice({
              type: "success",
              text: `${roleLabel(account.role)} account created for ${account.full_name}.`,
            });
          }}
        />
      )}

      {/* KPI row */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="HR Admins"
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
        description="Deactivating or locking an account signs it out on every device straight away."
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
              <option value="hr_admin">HR Admins</option>
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
                        <div className="flex justify-end gap-2">
                          {account.is_locked ? (
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
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                changeStatus(
                                  account,
                                  { is_locked: true },
                                  `${account.full_name} locked.`,
                                  `Lock ${account.full_name}'s account? They will be signed out and cannot sign in until unlocked.`,
                                )
                              }
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                              <Lock className="h-3.5 w-3.5" />
                              Lock
                            </button>
                          )}

                          {account.is_active ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                changeStatus(
                                  account,
                                  { is_active: false },
                                  `${account.full_name} deactivated.`,
                                  `Deactivate ${account.full_name}'s account? They will be signed out and cannot sign in until reactivated.`,
                                )
                              }
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                            >
                              <Power className="h-3.5 w-3.5" />
                              Deactivate
                            </button>
                          ) : (
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
    </div>
  );
}
