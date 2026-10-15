import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Briefcase,
  CalendarClock,
  Download,
  Eye,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";

import {
  CandidateModal,
  JobModal,
} from "../../components/admin/RecruitmentModals";
import ResumeViewerModal from "../../components/admin/ResumeViewerModal";
import { departmentService } from "../../services/departmentService";
import { recruitmentService } from "../../services/recruitmentService";
import {
  ALL_STAGES,
  PIPELINE_STAGES,
  STAGE_COLORS,
  STAGE_LABELS,
  type Candidate,
  type CandidateStage,
  type JobPosition,
  type Paginated,
  type PipelineColumn,
  type RecruitmentStats,
} from "../../types/recruitment";

interface Notice {
  type: "success" | "error";
  text: string;
}

// ------------------------------------------------------------------ helpers

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);

  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

// ---------------------------------------------------------- small components

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
          <span className="text-blue-600">{icon}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function StageBadge({ stage }: { stage: CandidateStage }) {
  const color = STAGE_COLORS[stage];

  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}

function StageSelect({
  value,
  onChange,
}: {
  value: CandidateStage;
  onChange: (stage: CandidateStage) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as CandidateStage)}
      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {ALL_STAGES.map((stage) => (
        <option key={stage} value={stage}>
          {STAGE_LABELS[stage]}
        </option>
      ))}
    </select>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-400">{children}</p>;
}

/**
 * Books or cancels the interview that the dashboard's Upcoming Interviews card
 * reads. Only rendered for candidates actually at the interview stage, matching
 * the server rule, so nobody is offered a booking the API would reject.
 */
function InterviewScheduler({
  candidate,
  onChanged,
}: {
  candidate: Candidate;
  onChanged: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (candidate.stage !== "interview") return null;

  const scheduled = candidate.interview_scheduled_at;

  async function save() {
    if (!value) return;

    setBusy(true);
    setError(null);

    try {
      // datetime-local yields a naive local time; the offset has to be added
      // explicitly or the server would read it as UTC.
      await recruitmentService.scheduleInterview(
        candidate.id,
        new Date(value).toISOString(),
      );
      setOpen(false);
      setValue("");
      onChanged(`Interview scheduled for ${candidate.full_name}`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!window.confirm(`Cancel ${candidate.full_name}'s scheduled interview?`)) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await recruitmentService.scheduleInterview(candidate.id, null);
      setOpen(false);
      onChanged(`Interview cancelled for ${candidate.full_name}`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {scheduled ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
              <CalendarClock className="h-3 w-3" />
              {formatDateTimeLabel(scheduled)}
            </span>

            <button
              type="button"
              disabled={busy}
              onClick={cancel}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-violet-700"
          >
            <CalendarClock className="h-3 w-3" />
            Schedule interview
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50/60 p-1.5">
        <input
          type="datetime-local"
          value={value}
          min={new Date().toISOString().slice(0, 16)}
          onChange={(e) => setValue(e.target.value)}
          aria-label={`Interview date and time for ${candidate.full_name}`}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button
          type="button"
          disabled={busy || !value}
          onClick={save}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-violet-700 disabled:opacity-40"
        >
          {busy ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(false)}
          className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100"
        >
          Dismiss
        </button>
      </div>

      {error && (
        <p className="max-w-[280px] text-[10px] leading-4 text-red-600">{error}</p>
      )}
    </div>
  );
}

/** "20 Oct 2026, 02:30 PM" in the admin's own timezone. */
function formatDateTimeLabel(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --------------------------------------------------------------------- page

function AdminRecruitment() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState<RecruitmentStats | null>(null);
  const [jobs, setJobs] = useState<JobPosition[]>([]);
  const [pipeline, setPipeline] = useState<PipelineColumn[]>([]);
  const [pipelineJobId, setPipelineJobId] = useState("");
  const [candidates, setCandidates] = useState<Paginated<Candidate> | null>(null);
  const [resumes, setResumes] = useState<Paginated<Candidate> | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<CandidateStage | "">("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [jobModal, setJobModal] = useState<{ job: JobPosition | null } | null>(null);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [viewingResume, setViewingResume] = useState<Candidate | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    kind: "job" | "candidate";
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  // Wait a moment after typing before searching.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Hide the message banner after a few seconds.
  useEffect(() => {
    if (!notice) return;

    const timer = setTimeout(() => setNotice(null), notice.type === "error" ? 10000 : 6000);

    return () => clearTimeout(timer);
  }, [notice]);

  // Department names for the "Add job" form suggestions (loaded once).
  useEffect(() => {
    let active = true;

    departmentService
      .listAll()
      .then((list) => {
        if (active) setDepartments(list.map((department) => department.name));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  // Top cards, jobs table and resume list.
  useEffect(() => {
    let active = true;

    Promise.all([
      recruitmentService.getStats(),
      recruitmentService.listJobs({ limit: 100 }),
      recruitmentService.listCandidates({ has_resume: true, limit: 100 }),
    ])
      .then(([statsData, jobsData, resumeData]) => {
        if (!active) return;
        setStats(statsData);
        setJobs(jobsData.items);
        setResumes(resumeData);
      })
      .catch((error) => {
        if (active) setNotice({ type: "error", text: errorText(error) });
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  // Pipeline board.
  useEffect(() => {
    let active = true;

    recruitmentService
      .getPipeline(pipelineJobId || undefined, 50)
      .then((data) => {
        if (active) setPipeline(data);
      })
      .catch((error) => {
        if (active) setNotice({ type: "error", text: errorText(error) });
      });

    return () => {
      active = false;
    };
  }, [refreshKey, pipelineJobId]);

  // Candidate list (search + stage filter).
  useEffect(() => {
    let active = true;

    recruitmentService
      .listCandidates({
        search: debouncedSearch || undefined,
        stage: stageFilter || undefined,
        limit: 100,
      })
      .then((data) => {
        if (active) setCandidates(data);
      })
      .catch((error) => {
        if (active) setNotice({ type: "error", text: errorText(error) });
      });

    return () => {
      active = false;
    };
  }, [refreshKey, debouncedSearch, stageFilter]);

  // Run an action, show a message, and reload the page data.
  async function run(action: () => Promise<unknown>, successText?: string) {
    try {
      await action();

      if (successText) setNotice({ type: "success", text: successText });

      refresh();
    } catch (error) {
      setNotice({ type: "error", text: errorText(error) });
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;

    const target = pendingDelete;

    setDeleting(true);

    await run(
      () =>
        target.kind === "job"
          ? recruitmentService.deleteJob(target.id)
          : recruitmentService.deleteCandidate(target.id),
      target.kind === "job" ? "Job position deleted" : "Candidate deleted",
    );

    setDeleting(false);
    setPendingDelete(null);
  }

  async function handleStageChange(
    candidateId: string,
    name: string,
    stage: CandidateStage,
  ) {
    try {
      const updated = await recruitmentService.changeStage(candidateId, stage);

      setNotice({
        type: "success",
        text: updated.job_auto_closed
          ? `${name} moved to ${STAGE_LABELS[stage]}. All openings are filled, so "${updated.job_title}" was closed automatically.`
          : `${name} moved to ${STAGE_LABELS[stage]}`,
      });
      refresh();
    } catch (error) {
      setNotice({ type: "error", text: errorText(error) });
    }
  }

  async function handleDownload(candidate: Candidate) {
    try {
      const blob = await recruitmentService.downloadResume(candidate.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = candidate.resume_file_name ?? "resume";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setNotice({ type: "error", text: errorText(error) });
    }
  }

  function handleSaved(message: string) {
    setJobModal(null);
    setCandidateModalOpen(false);
    setNotice({ type: "success", text: message });
    refresh();
  }

  // ------------------------------------------------------- report numbers

  const stageEntries = PIPELINE_STAGES.map((stage) => ({
    stage,
    count: stats?.stage_counts[stage] ?? 0,
  }));
  const donutTotal = stageEntries.reduce((sum, entry) => sum + entry.count, 0);

  let running = 0;
  const donutSegments = stageEntries
    .filter((entry) => entry.count > 0)
    .map((entry) => {
      const start = (running / donutTotal) * 100;

      running += entry.count;

      const end = (running / donutTotal) * 100;

      return `${STAGE_COLORS[entry.stage]} ${start}% ${end}%`;
    });
  const donutBackground =
    donutTotal === 0 ? "#e2e8f0" : `conic-gradient(${donutSegments.join(", ")})`;

  const departmentCounts = stats?.applications_by_department ?? [];
  const maxDepartmentCount = Math.max(1, ...departmentCounts.map((d) => d.count));

  const kpiCards = [
    {
      label: "Total Job Positions",
      value: stats?.total_job_positions ?? 0,
      sub: `${stats?.active_job_positions ?? 0} active`,
      icon: <Briefcase className="h-6 w-6" />,
      tone: "border-blue-100 bg-blue-50 text-blue-600",
    },
    {
      label: "Total Applications",
      value: stats?.total_applications ?? 0,
      sub: "All candidates",
      icon: <Users className="h-6 w-6" />,
      tone: "border-emerald-100 bg-emerald-50 text-emerald-600",
    },
    {
      label: "Interviews Scheduled",
      value: stats?.interviews_scheduled ?? 0,
      sub: "In interview stage",
      icon: <CalendarClock className="h-6 w-6" />,
      tone: "border-violet-100 bg-violet-50 text-violet-600",
    },
    {
      label: "Hired Candidates",
      value: stats?.hired_candidates ?? 0,
      sub: "Total hired",
      icon: <UserCheck className="h-6 w-6" />,
      tone: "border-orange-100 bg-orange-50 text-orange-600",
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Title */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Recruitment</h1>
          <p className="text-sm text-slate-500">
            Find the right talent for a better tomorrow
          </p>
        </div>
        <button
          type="button"
          onClick={() => setJobModal({ job: null })}
          className="flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Job Position
        </button>
      </div>

      {notice && (
        <div
          role="alert"
          className={`fixed right-6 top-24 z-[60] flex max-w-md items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <span className="flex-1">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {/* Top cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className={`flex items-center gap-4 rounded-2xl border p-5 ${card.tone}`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
              {card.icon}
            </span>
            <div>
              <p className="text-sm text-slate-700">{card.label}</p>
              <p className="text-3xl font-bold text-slate-800">{card.value}</p>
              <p className="text-xs text-slate-500">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <Section
        title="Recruitment Pipeline"
        icon={<Users className="h-5 w-5" />}
        action={
          <select
            value={pipelineJobId}
            onChange={(e) => setPipelineJobId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
          >
            <option value="">All Job Positions</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        }
      >
        <div className="overflow-x-auto">
          <div className="grid min-w-[980px] grid-cols-7 gap-3">
            {pipeline.map((column) => (
              <div
                key={column.stage}
                className="rounded-xl border bg-slate-50/60"
                style={{ borderColor: `${STAGE_COLORS[column.stage]}55` }}
              >
                <div
                  className="flex items-center justify-between rounded-t-xl px-3 py-2 text-sm font-semibold"
                  style={{
                    backgroundColor: `${STAGE_COLORS[column.stage]}1a`,
                    color: STAGE_COLORS[column.stage],
                  }}
                >
                  <span>{STAGE_LABELS[column.stage]}</span>
                  <span>{column.count}</span>
                </div>

                <div className="max-h-[340px] space-y-2 overflow-y-auto overscroll-contain p-2">
                  {column.candidates.length === 0 && (
                    <p className="py-4 text-center text-xs text-slate-400">
                      No candidates
                    </p>
                  )}

                  {column.candidates.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-lg border border-slate-200 bg-white p-2"
                    >
                      <p className="truncate text-sm font-medium text-slate-800">
                        {card.full_name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {card.job_title}
                      </p>
                      <p className="mb-1 text-[11px] text-slate-400">
                        {timeAgo(card.stage_updated_at)}
                      </p>
                      <StageSelect
                        value={column.stage}
                        onChange={(stage) =>
                          void handleStageChange(card.id, card.full_name, stage)
                        }
                      />
                    </div>
                  ))}

                  {column.count > column.candidates.length && (
                    <p className="text-center text-xs font-medium text-slate-500">
                      + {column.count - column.candidates.length} more
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Job positions */}
        <Section
          title="Job Positions"
          icon={<Briefcase className="h-5 w-5" />}
          action={
            <button
              type="button"
              onClick={() => setJobModal({ job: null })}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Add Job
            </button>
          }
        >
          {jobs.length === 0 ? (
            <EmptyText>No job positions yet. Click "Add Job" to create one.</EmptyText>
          ) : (
            <div className="max-h-[360px] overflow-auto overscroll-contain">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white text-slate-500 shadow-[0_1px_0_0_#e2e8f0]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Title</th>
                    <th className="py-2 pr-3 font-medium">Department</th>
                    <th className="py-2 pr-3 font-medium">Location</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td className="py-3 pr-3 font-medium text-slate-800">
                        {job.title}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{job.department}</td>
                      <td className="py-3 pr-3 text-slate-600">{job.location}</td>
                      <td className="py-3 pr-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            job.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {job.status === "active" ? "Active" : "Closed"}
                        </span>
                      </td>
                      <td className="space-x-3 whitespace-nowrap py-3 text-xs">
                        <button
                          type="button"
                          className="font-medium text-blue-600 hover:underline"
                          onClick={() => setJobModal({ job })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="font-medium text-amber-600 hover:underline"
                          onClick={() =>
                            void run(
                              () =>
                                recruitmentService.updateJob(job.id, {
                                  status: job.status === "active" ? "closed" : "active",
                                }),
                              job.status === "active"
                                ? "Job position closed"
                                : "Job position reopened",
                            )
                          }
                        >
                          {job.status === "active" ? "Close" : "Reopen"}
                        </button>
                        <button
                          type="button"
                          title="Delete job position"
                          aria-label={`Delete ${job.title}`}
                          className="inline-flex translate-y-0.5 rounded p-1 text-red-600 hover:bg-red-50"
                          onClick={() =>
                            setPendingDelete({ kind: "job", id: job.id, name: job.title })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Candidate profiles */}
        <Section
          title="Candidate Profiles"
          icon={<Users className="h-5 w-5" />}
          action={
            <button
              type="button"
              onClick={() => setCandidateModalOpen(true)}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Add Candidate
            </button>
          }
        >
          <div className="mb-3 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or skills..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as CandidateStage | "")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
            >
              <option value="">All Stages</option>
              {ALL_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
          </div>

          {!candidates || candidates.items.length === 0 ? (
            <EmptyText>No candidates found.</EmptyText>
          ) : (
            <>
              <ul className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto overscroll-contain pr-1">
                {candidates.items.map((candidate) => (
                  <li key={candidate.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                      {initials(candidate.full_name)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800">
                        {candidate.full_name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {candidate.email}
                        {candidate.phone ? ` · ${candidate.phone}` : ""}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {candidate.job_title}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {candidate.skills.slice(0, 4).map((skill) => (
                          <span
                            key={skill}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <StageBadge stage={candidate.stage} />
                      <StageSelect
                        value={candidate.stage}
                        onChange={(stage) =>
                          void handleStageChange(candidate.id, candidate.full_name, stage)
                        }
                      />
                      <span className="text-[11px] text-slate-400">
                        Applied {formatDate(candidate.applied_at)}
                      </span>
                      <div className="flex gap-3 text-[11px] font-medium">
                        <label className="cursor-pointer text-blue-600 hover:underline">
                          {candidate.resume_file_name ? "Replace resume" : "Upload resume"}
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];

                              e.target.value = "";

                              if (file) {
                                void run(
                                  () => recruitmentService.uploadResume(candidate.id, file),
                                  "Resume uploaded",
                                );
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={() =>
                            setPendingDelete({
                              kind: "candidate",
                              id: candidate.id,
                              name: candidate.full_name,
                            })
                          }
                        >
                          Delete
                        </button>
                      </div>

                      <InterviewScheduler
                        candidate={candidate}
                        onChanged={(message) =>
                          run(() => Promise.resolve(), message)
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="pt-2 text-xs text-slate-400">
                Showing {candidates.items.length} of {candidates.total}
              </p>
            </>
          )}
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Resumes */}
        <Section title="Resume" icon={<Download className="h-5 w-5" />}>
          {!resumes || resumes.items.length === 0 ? (
            <EmptyText>No resumes uploaded yet.</EmptyText>
          ) : (
            <div className="max-h-[320px] overflow-auto overscroll-contain">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white text-slate-500 shadow-[0_1px_0_0_#e2e8f0]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Candidate</th>
                    <th className="py-2 pr-3 font-medium">File</th>
                    <th className="py-2 pr-3 font-medium">Uploaded</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resumes.items.map((candidate) => {
                    const canView = (candidate.resume_file_name ?? "")
                      .toLowerCase()
                      .endsWith(".pdf");

                    return (
                      <tr key={candidate.id}>
                        <td className="py-3 pr-3 font-medium text-slate-800">
                          {candidate.full_name}
                        </td>
                        <td className="max-w-[160px] truncate py-3 pr-3 text-slate-600">
                          {candidate.resume_file_name}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-3 text-slate-600">
                          {candidate.resume_uploaded_at
                            ? formatDate(candidate.resume_uploaded_at)
                            : "-"}
                        </td>
                        <td className="whitespace-nowrap py-3">
                          <button
                            type="button"
                            disabled={!canView}
                            title={
                              canView
                                ? "View resume"
                                : "Preview is available for PDF files only"
                            }
                            aria-label={`View resume of ${candidate.full_name}`}
                            onClick={() => setViewingResume(candidate)}
                            className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Download resume"
                            aria-label={`Download resume of ${candidate.full_name}`}
                            onClick={() => void handleDownload(candidate)}
                            className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Reports */}
        <Section title="Recruitment Reports" icon={<Briefcase className="h-5 w-5" />}>
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Stage mix */}
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
              <div className="relative h-40 w-40 shrink-0">
                <div
                  className="h-full w-full rounded-full"
                  style={{ background: donutBackground }}
                />
                <div className="absolute inset-[26px] flex flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-3xl font-bold tracking-tight text-slate-800">
                    {donutTotal}
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Candidates
                  </span>
                </div>
              </div>

              <ul className="w-full min-w-0 flex-1 space-y-1.5">
                {stageEntries.map((entry) => {
                  const percent =
                    donutTotal > 0
                      ? Math.round((entry.count / donutTotal) * 100)
                      : 0;

                  return (
                    <li
                      key={entry.stage}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-1 transition hover:bg-slate-50"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: STAGE_COLORS[entry.stage] }}
                      />

                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600">
                        {STAGE_LABELS[entry.stage]}
                      </span>

                      {/* nowrap keeps the count and share on one line instead
                          of the share wrapping under a squeezed count. */}
                      <span className="shrink-0 whitespace-nowrap text-xs text-slate-400 tabular-nums">
                        {percent}%
                      </span>

                      <span className="w-7 shrink-0 text-right text-sm font-semibold text-slate-800 tabular-nums">
                        {entry.count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Department split */}
            <div className="min-w-0">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700">
                  Applications by Department
                </p>

                {departmentCounts.length > 0 && (
                  <p className="text-xs text-slate-400">
                    {departmentCounts.length} department
                    {departmentCounts.length === 1 ? "" : "s"}
                  </p>
                )}
              </div>

              {departmentCounts.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                  No applications yet.
                </p>
              ) : (
                <ul className="max-h-[220px] space-y-2.5 overflow-y-auto overscroll-contain pr-1">
                  {departmentCounts.map((item) => {
                    const percent = donutTotal
                      ? Math.round((item.count / donutTotal) * 100)
                      : 0;

                    return (
                      <li key={item.department}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                          <span className="min-w-0 truncate font-medium text-slate-600">
                            {item.department}
                          </span>

                          <span className="shrink-0 whitespace-nowrap text-slate-400 tabular-nums">
                            <span className="font-semibold text-slate-800">
                              {item.count}
                            </span>{" "}
                            · {percent}%
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                            style={{
                              width: `${
                                (item.count / maxDepartmentCount) * 100
                              }%`,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </Section>
      </div>

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            if (!deleting) setPendingDelete(null);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-900">
              Delete {pendingDelete.kind === "job" ? "job position" : "candidate"}?
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              "{pendingDelete.name}" will be deleted permanently
              {pendingDelete.kind === "candidate" ? ", including their resume." : "."}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirmDelete()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingResume && (
        <ResumeViewerModal
          candidate={viewingResume}
          onClose={() => setViewingResume(null)}
          onDownload={() => void handleDownload(viewingResume)}
        />
      )}

      {jobModal && (
        <JobModal
          job={jobModal.job}
          departments={departments}
          onClose={() => setJobModal(null)}
          onSaved={handleSaved}
        />
      )}

      {candidateModalOpen && (
        <CandidateModal
          jobs={jobs}
          onClose={() => setCandidateModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

export default AdminRecruitment;
