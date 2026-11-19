import { useEffect, useState } from "react";
import {
  Clock,
  Globe,
  Laptop,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import {
  authService,
  type LoginHistoryRecord,
  type UserSession,
} from "./authService";

function parseDevice(userAgent: string | null): {
  type: "mobile" | "desktop";
  name: string;
} {
  if (!userAgent) return { type: "desktop", name: "Unknown Device" };
  const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
  let browser = "Web Browser";
  if (/edg/i.test(userAgent)) browser = "Microsoft Edge";
  else if (/chrome/i.test(userAgent)) browser = "Google Chrome";
  else if (/safari/i.test(userAgent)) browser = "Apple Safari";
  else if (/firefox/i.test(userAgent)) browser = "Mozilla Firefox";

  let os = "Desktop";
  if (/windows/i.test(userAgent)) os = "Windows";
  else if (/macintosh|mac os/i.test(userAgent)) os = "macOS";
  else if (/android/i.test(userAgent)) os = "Android";
  else if (/iphone|ipad/i.test(userAgent)) os = "iOS";
  else if (/linux/i.test(userAgent)) os = "Linux";

  return {
    type: isMobile ? "mobile" : "desktop",
    name: `${browser} on ${os}`,
  };
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

export default function SecuritySessionsSection() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sessionsData, historyData] = await Promise.all([
        authService.getSessions().catch(() => []),
        authService.getLoginHistory().catch(() => []),
      ]);
      setSessions(sessionsData);
      setLoginHistory(historyData);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRevokeSession = async (sessionId: string) => {
    try {
      setRevokingId(sessionId);
      await authService.revokeSession(sessionId);
      setMessage({ type: "success", text: "Session terminated successfully." });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      setMessage({
        type: "error",
        text: "Failed to revoke session. Please try again.",
      });
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    try {
      setRevokingOthers(true);
      await authService.revokeOtherSessions();
      setMessage({
        type: "success",
        text: "All other active sessions have been terminated.",
      });
      setSessions((prev) => prev.filter((s) => s.is_current));
    } catch {
      setMessage({
        type: "error",
        text: "Failed to revoke other sessions. Please try again.",
      });
    } finally {
      setRevokingOthers(false);
    }
  };

  const otherSessions = sessions.filter((s) => !s.is_current);

  return (
    <div className="space-y-6">
      {/* ACTIVE SESSIONS CARD */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Active Sessions &amp; Devices
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage devices currently logged in to your account.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            {otherSessions.length > 0 && (
              <button
                type="button"
                onClick={handleRevokeOthers}
                disabled={revokingOthers}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                {revokingOthers ? "Logging out..." : "Log out other devices"}
              </button>
            )}
          </div>
        </div>

        {message && (
          <div
            className={`mt-4 rounded-xl p-3 text-xs font-medium ${
              message.type === "success"
                ? "border border-green-200 bg-green-50 text-green-700"
                : "border border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mt-5 space-y-3">
          {loading && sessions.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">
              Loading active sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">
              No active session information available.
            </div>
          ) : (
            sessions.map((session) => {
              const device = parseDevice(session.user_agent);
              return (
                <div
                  key={session.id}
                  className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                    session.is_current
                      ? "border-blue-200 bg-blue-50/40"
                      : "border-gray-100 bg-gray-50/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        session.is_current
                          ? "bg-blue-100 text-blue-600"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {device.type === "mobile" ? (
                        <Smartphone className="h-5 w-5" />
                      ) : (
                        <Laptop className="h-5 w-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {device.name}
                        </p>
                        {session.is_current && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            <ShieldCheck className="h-3 w-3" />
                            This Device
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        {session.ip_address && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            IP: {session.ip_address}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last active: {formatDate(session.last_used_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!session.is_current && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(session.id)}
                      disabled={revokingId === session.id}
                      className="self-end rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 sm:self-center"
                    >
                      {revokingId === session.id
                        ? "Revoking..."
                        : "Revoke Access"}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* LOGIN HISTORY CARD */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Login History
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Audit log of recent sign-in attempts for your account.
          </p>
        </div>

        <div className="mt-5 overflow-x-auto">
          {loading && loginHistory.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">
              Loading login history...
            </div>
          ) : loginHistory.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">
              No recent login activity recorded.
            </div>
          ) : (
            <table className="w-full min-w-[550px] text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 uppercase tracking-wide text-gray-400">
                  <th className="pb-3 font-semibold">Date &amp; Time</th>
                  <th className="pb-3 font-semibold">Device &amp; Browser</th>
                  <th className="pb-3 font-semibold">IP Address</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loginHistory.map((record) => {
                  const dev = parseDevice(record.user_agent);
                  return (
                    <tr key={record.id} className="hover:bg-gray-50/50">
                      <td className="py-3 font-medium text-gray-800">
                        {formatDate(record.created_at)}
                      </td>
                      <td className="py-3 text-gray-600">{dev.name}</td>
                      <td className="py-3 text-gray-500">
                        {record.ip_address || "—"}
                      </td>
                      <td className="py-3">
                        {record.status === "success" ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                            Successful
                          </span>
                        ) : record.status === "blocked" ? (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                            Blocked ({record.failure_reason || "Locked"})
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                            Failed ({record.failure_reason || "Invalid credentials"})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
