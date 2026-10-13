import { useCallback, useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import ExitStatusBadge from "../../components/employee/ExitStatusBadge";
import { ApiError } from "../../services/api";
import {
  adminExitRequestService,
  formatExitDate,
  formatFileSize,
  saveBlob,
} from "../../services/exitRequestService";
import type {
  ExitRequest,
  ExitRequestSummary,
  ExitStatus,
} from "../../types/exitRequest";

const FILTERS: Array<"All" | ExitStatus> = [
  "All",
  "Pending",
  "In Progress",
  "Completed",
  "Rejected",
  "Cancelled",
];

function errorText(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

function AdminExitRequests() {
  const [filter, setFilter] = useState<"All" | ExitStatus>("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<ExitRequest[]>([]);
  const [pages, setPages] = useState(1);
  const [summary, setSummary] = useState<ExitRequestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<ExitRequest | null>(null);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    try {
      const [list, stats] = await Promise.all([
        adminExitRequestService.list({
          page,
          limit: 10,
          status: filter === "All" ? undefined : filter,
          search: search.trim() || undefined,
        }),
        adminExitRequestService.summary(),
      ]);
      setItems(list.items);
      setPages(list.pages);
      setSummary(stats);
      setError("");
    } catch (err) {
      setError(errorText(err, "Unable to load exit requests."));
    } finally {
      setLoading(false);
    }
  }, [filter, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const openRequest = (request: ExitRequest) => {
    setSelected(request);
    setNote("");
    setActionError("");
  };

  const changeStatus = async (status: "In Progress" | "Completed" | "Rejected") => {
    if (!selected) return;

    if (status === "Rejected" && !note.trim()) {
      setActionError("Please add a reason for rejecting.");
      return;
    }

    setActing(true);
    setActionError("");
    try {
      const updated = await adminExitRequestService.updateStatus(selected.id, status, note.trim());
      setSelected(updated);
      setNote("");
      await load();
    } catch (err) {
      setActionError(errorText(err, "Unable to update the request."));
    } finally {
      setActing(false);
    }
  };

  const download = async (request: ExitRequest, attachmentId: string, name: string) => {
    try {
      saveBlob(await adminExitRequestService.downloadAttachment(request.id, attachmentId), name);
    } catch (err) {
      setActionError(errorText(err, "Unable to download the file."));
    }
  };

  const downloadDoc = async (request: ExitRequest, key: string, name: string) => {
    try {
      saveBlob(await adminExitRequestService.downloadDocument(request.id, key), name);
    } catch (err) {
      setActionError(errorText(err, "Unable to download the file."));
    }
  };

  const cards: Array<[string, number | undefined]> = [
    ["Total", summary?.total],
    ["Pending", summary?.pending],
    ["In Progress", summary?.in_progress],
    ["Completed", summary?.completed],
    ["Rejected", summary?.rejected],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Exit Requests</h1>
        <p className="text-sm text-slate-500">Review resignation requests and track clearance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-semibold text-slate-900">{value ?? "—"}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`rounded-full px-3 py-1 text-sm ${
                filter === f ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          className="w-64 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
          placeholder="Search name or employee ID"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Last Working Day</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No exit requests found.</td></tr>
            )}
            {items.map((r) => (
              <tr key={r.id} onClick={() => openRequest(r)} className="cursor-pointer hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{r.employee_name}</p>
                  <p className="text-xs text-slate-500">{r.employee_id} · {r.designation ?? "—"}</p>
                </td>
                <td className="px-4 py-3 text-slate-700">{r.reason}</td>
                <td className="px-4 py-3 text-slate-700">{formatExitDate(r.submitted_at)}</td>
                <td className="px-4 py-3 text-slate-700">{formatExitDate(r.last_working_day)}</td>
                <td className="px-4 py-3"><ExitStatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-3 text-sm">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Previous</button>
        <span className="text-slate-500">Page {page} of {pages}</span>
        <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Next</button>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{selected.employee_name}</h2>
                <p className="text-sm text-slate-500">{selected.employee_id} · {selected.designation ?? "—"}</p>
              </div>
              <div className="flex items-center gap-3">
                <ExitStatusBadge status={selected.status} />
                <button aria-label="Close" onClick={() => setSelected(null)}><X className="h-5 w-5 text-slate-400" /></button>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-slate-500">Reason</dt><dd className="font-medium">{selected.reason}</dd></div>
              <div><dt className="text-slate-500">Notice period</dt><dd className="font-medium">{selected.notice_period_days} days</dd></div>
              <div><dt className="text-slate-500">Submitted</dt><dd className="font-medium">{formatExitDate(selected.submitted_at)}</dd></div>
              <div><dt className="text-slate-500">Last working day</dt><dd className="font-medium">{formatExitDate(selected.last_working_day)}</dd></div>
              {selected.remarks && (
                <div className="col-span-2"><dt className="text-slate-500">Remarks</dt><dd>{selected.remarks}</dd></div>
              )}
              {selected.admin_note && (
                <div className="col-span-2"><dt className="text-slate-500">HR note ({selected.reviewed_by})</dt><dd>{selected.admin_note}</dd></div>
              )}
            </dl>

            {selected.handover_tasks.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-slate-900">Handover</h3>
                <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                  {selected.handover_tasks.map((t) => (
                    <li key={t.task} className="flex justify-between gap-3 px-3 py-2">
                      <span>
                        <span className="font-medium">{t.task}</span>
                        {t.remarks && <span className="block text-slate-500">{t.remarks}</span>}
                      </span>
                      <span className="text-slate-600">{t.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selected.attachments.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-slate-900">Attachments</h3>
                <ul className="mt-2 space-y-2">
                  {selected.attachments.map((a) => (
                    <li key={a.id}>
                      <button
                        onClick={() => void download(selected, a.id, a.file_name)}
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      >
                        <Download className="h-4 w-4" /> {a.file_name}
                        <span className="text-slate-400">({formatFileSize(a.file_size)})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selected.documents.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-slate-900">Exit documents</h3>
                <ul className="mt-2 space-y-2">
                  {selected.documents.map((d) => (
                    <li key={d.key} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{d.label}</span>
                      {d.status === "Submitted" ? (
                        <button
                          onClick={() => void downloadDoc(selected, d.key, d.file_name ?? d.label)}
                          className="inline-flex items-center gap-2 text-blue-600 hover:underline"
                        >
                          <Download className="h-4 w-4" /> {d.file_name}
                        </button>
                      ) : (
                        <span className="text-slate-400">Not submitted</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(selected.status === "Pending" || selected.status === "In Progress") && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <textarea
                  className="h-20 w-full resize-none rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-blue-500"
                  maxLength={500}
                  placeholder="Note to the employee (required when rejecting)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="mt-3 flex justify-end gap-3">
                  <button
                    disabled={acting}
                    onClick={() => void changeStatus("Rejected")}
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  {selected.status === "Pending" ? (
                    <button
                      disabled={acting}
                      onClick={() => void changeStatus("In Progress")}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Approve &amp; Start Clearance
                    </button>
                  ) : (
                    <button
                      disabled={acting}
                      onClick={() => void changeStatus("Completed")}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Mark Completed
                    </button>
                  )}
                </div>
              </div>
            )}

            {actionError && <p className="mt-3 text-sm text-red-600">{actionError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminExitRequests;
