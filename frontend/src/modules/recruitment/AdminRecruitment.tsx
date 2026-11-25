import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Mail,
  Plus,
  Search,
  Send,
  Trash2,
  UserCheck,
  Users,
  ChevronDown,
} from "lucide-react";

import {
  CandidateModal,
  JobModal,
  OfferModal,
  OnboardCandidateModal,
  RejectionModal,
} from "./RecruitmentModals";
import ResumeViewerModal from "./ResumeViewerModal";
import NoticePopup from "../../components/ui/NoticePopup";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { departmentService } from "../departments/departmentService";
import { recruitmentService } from "./recruitmentService";
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
} from "./types";

interface Notice {
  type: "success" | "error";
  text: string;
}

// ------------------------------------------------------------------ helpers

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#111827]">
          <span className="text-[#2563EB]">{icon}</span>
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
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
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
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as CandidateStage)}
        className="h-9 appearance-none rounded-lg border border-[#D1D5DB] bg-white px-3 pr-8 text-[13px] text-[#374151] outline-none transition focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#DBEAFE]"
      >
        {ALL_STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {STAGE_LABELS[stage]}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
    </div>
  );
}

function EmptyText({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <EmptyState
      icon={<FileText className="h-5 w-5" />}
      title={String(children)}
      description="There is nothing to show here yet."
      action={action}
      className="max-w-none py-6"
    />
  );
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
  const [meetingLink, setMeetingLink] = useState(candidate.meeting_link ?? "");
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (candidate.stage !== "interview") return null;

  const scheduled = candidate.interview_scheduled_at;

  async function save() {
    if (!value) return;

    setBusy(true);
    setError(null);

    try {
      await recruitmentService.scheduleInterview(candidate.id, {
        interview_scheduled_at: new Date(value).toISOString(),
        meeting_link: meetingLink.trim() || undefined,
        notes: notes.trim() || undefined,
        send_email: sendEmail,
      });
      setOpen(false);
      setValue("");
      setNotes("");
      onChanged(
        sendEmail
          ? `Interview scheduled for ${candidate.full_name} and invitation email sent.`
          : `Interview scheduled for ${candidate.full_name}.`
      );
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F3FF] px-2.5 py-1 text-[12px] font-medium text-[#6D28D9]">
              <CalendarClock className="h-4 w-4" />
              {formatDateTimeLabel(scheduled)}
            </span>

            <button
              type="button"
              disabled={busy}
              onClick={cancel}
              className="rounded-lg border border-[#E5E7EB] px-2.5 py-1 text-[12px] font-medium text-[#6B7280] transition hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626] disabled:opacity-40"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-[#1D4ED8]"
          >
            <CalendarClock className="h-4 w-4" />
            Schedule interview
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[320px] flex-col items-end gap-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-3">
      <div className="w-full space-y-1.5">
        <label className="block text-[12px] font-medium text-[#374151]">
          Date & Time
        </label>
        <input
          type="datetime-local"
          value={value}
          min={new Date().toISOString().slice(0, 16)}
          onChange={(e) => setValue(e.target.value)}
          aria-label={`Interview date and time for ${candidate.full_name}`}
          className="h-9 w-full rounded-lg border border-[#D1D5DB] bg-white px-2 text-[13px] text-[#374151] outline-none focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#DBEAFE]"
        />

        <label className="block text-[12px] font-medium text-[#374151]">
          Meeting Link (Google Meet / Zoom)
        </label>
        <input
          type="url"
          placeholder="https://meet.google.com/..."
          value={meetingLink}
          onChange={(e) => setMeetingLink(e.target.value)}
          className="h-9 w-full rounded-lg border border-[#D1D5DB] bg-white px-2 text-[13px] text-[#374151] outline-none focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#DBEAFE]"
        />

        <label className="block text-[12px] font-medium text-[#374151]">
          Notes / Instructions
        </label>
        <input
          type="text"
          placeholder="e.g. Technical Round 1 with Team Lead"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-9 w-full rounded-lg border border-[#D1D5DB] bg-white px-2 text-[13px] text-[#374151] outline-none focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#DBEAFE]"
        />

        <label className="flex items-center gap-1.5 cursor-pointer pt-0.5">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
          />
          <span className="text-[12px] text-[#6B7280] flex items-center gap-1">
            <Mail className="h-4 w-4 text-[#2563EB]" />
            Send invitation email to candidate
          </span>
        </label>
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <button
          type="button"
          disabled={busy || !value}
          onClick={save}
          className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-[#1D4ED8] disabled:opacity-40"
        >
          {busy ? "Scheduling..." : "Confirm & Send"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(false)}
          className="rounded-lg px-2 py-1.5 text-[12px] font-medium text-[#6B7280] transition hover:bg-[#F3F4F6]"
        >
          Cancel
        </button>
      </div>

      {error && (
        <p className="w-full text-[12px] leading-4 text-[#DC2626]">{error}</p>
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [offerModalCandidate, setOfferModalCandidate] = useState<Candidate | null>(null);
  const [onboardModalCandidate, setOnboardModalCandidate] = useState<Candidate | null>(null);
  const [rejectionCandidate, setRejectionCandidate] = useState<{ id: string; name: string } | null>(null);
  const [draggedCandidate, setDraggedCandidate] = useState<{
    id: string;
    name: string;
    currentStage: CandidateStage;
  } | null>(null);
  const [dragOverStage, setDragOverStage] = useState<CandidateStage | null>(null);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  // Wait a moment after typing before searching.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);

    return () => clearTimeout(timer);
  }, [search]);

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
        setIsLoading(false);
        setLoadError(null);
        setStats(statsData);
        setJobs(jobsData.items);
        setResumes(resumeData);
      })
      .catch((error) => {
        if (active) {
          setIsLoading(false);
          setLoadError(errorText(error));
          setNotice({ type: "error", text: errorText(error) });
        }
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
    if (stage === "rejected") {
      setRejectionCandidate({ id: candidateId, name });
      return;
    }

    try {
      const updated = await recruitmentService.changeStage(candidateId, stage);

      setNotice({
        type: "success",
        text: updated.job_auto_closed
          ? `${name} moved to ${STAGE_LABELS[stage]}. All openings are filled, so "${updated.job_title}" was closed automatically.`
          : `${name} moved to ${STAGE_LABELS[stage]}`,
      });
      refresh();

      if (stage === "offer" && !updated.offer_details) {
        setOfferModalCandidate(updated);
      } else if (stage === "hired" && !updated.is_onboarded) {
        setOnboardModalCandidate(updated);
      }
    } catch (error) {
      setNotice({ type: "error", text: errorText(error) });
    }
  }

  async function handleConfirmRejection(sendEmail: boolean, reason: string) {
    if (!rejectionCandidate) return;
    const { id, name } = rejectionCandidate;
    setRejectionCandidate(null);

    try {
      await recruitmentService.changeStage(id, "rejected", sendEmail, reason);
      setNotice({
        type: "success",
        text: sendEmail
          ? `${name} marked as Rejected and notification email sent.`
          : `${name} marked as Rejected.`,
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
  const totalDepartmentApplications = departmentCounts.reduce((sum, d) => sum + d.count, 0);

  const kpiCards = [
    {
      label: "Total Job Positions",
      value: stats?.total_job_positions ?? 0,
      sub: `${stats?.active_job_positions ?? 0} active`,
      icon: <Briefcase className="h-5 w-5" />,
      tone: "bg-[#EFF6FF] text-[#2563EB]",
    },
    {
      label: "Total Applications",
      value: stats?.total_applications ?? 0,
      sub: "All candidates",
      icon: <Users className="h-5 w-5" />,
      tone: "bg-[#ECFDF5] text-[#047857]",
    },
    {
      label: "Interviews Scheduled",
      value: stats?.interviews_scheduled ?? 0,
      sub: "In interview stage",
      icon: <CalendarClock className="h-5 w-5" />,
      tone: "bg-[#F5F3FF] text-[#7C3AED]",
    },
    {
      label: "Hired Candidates",
      value: stats?.hired_candidates ?? 0,
      sub: "Total hired",
      icon: <UserCheck className="h-5 w-5" />,
      tone: "bg-[#FFF7ED] text-[#C2410C]",
    },
  ];

  const pipelineColumns: PipelineColumn[] =
    pipeline.length > 0
      ? pipeline
      : PIPELINE_STAGES.map((stage) => ({
        stage,
        count: 0,
        candidates: [],
      }));

  return (
    <div className="flex w-full flex-col gap-5 pb-10">
      {/* Title */}
      <div className="flex flex-col gap-3 border-b border-[#E5E7EB] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[20px] font-semibold leading-tight text-[#111827]">Recruitment</h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Find the right talent for a better tomorrow
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCandidateModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
            Add Candidate
          </Button>
          <Button variant="primary" size="sm" onClick={() => setJobModal({ job: null })} leftIcon={<Plus className="h-4 w-4" />}>
            Add Job Position
          </Button>
        </div>
      </div>

      {/* Successes close themselves; errors now stay until dismissed. */}
      <NoticePopup notice={notice} onDismiss={() => setNotice(null)} />
      {loadError && stats && (
        <ErrorState
          title="Some recruitment data could not be refreshed"
          message={loadError}
          onRetry={refresh}
          className="max-w-none rounded-xl border border-[#FECACA] bg-white py-5"
        />
      )}

      {/* Top cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading && !stats
          ? Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="min-h-[128px] rounded-xl border border-[#E5E7EB] bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <Skeleton className="h-3 w-28 rounded" />
                  <Skeleton className="h-8 w-16 rounded" />
                  <Skeleton className="h-3 w-32 rounded" />
                </div>
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
            </div>
          ))
          : kpiCards.map((card) => (
            <div
              key={card.label}
              className={`flex items-center gap-4 rounded-2xl border border-gray-100 p-5 shadow-kpi ${card.tone}`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
                {card.icon}
              </span>
              <div>
                <p className="text-sm text-slate-700">{card.label}</p>
                <p className="text-3xl font-bold text-slate-800">{card.value}</p>
                <p className="text-xs text-slate-500">{card.sub}</p>
              </div>
              <p className="mt-auto pt-3 text-[12px] text-[#6B7280]">{card.sub}</p>
            </div>
          ))}
      </div>

      {/* Pipeline */}
      <Section
        title="Recruitment Pipeline"
        icon={<Users className="h-4 w-4" />}
        action={
          <div className="relative">
            <select
              value={pipelineJobId}
              onChange={(e) => setPipelineJobId(e.target.value)}
              className="h-9 appearance-none rounded-lg border border-[#D1D5DB] bg-white pl-3 pr-8 text-[13px] text-[#374151] outline-none focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#DBEAFE]"
            >
              <option value="">All Job Positions</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          </div>
        }
      >
        <div className="overflow-x-auto pb-1">
          <div className="grid min-w-[980px] grid-cols-7 gap-3">
            {pipelineColumns.map((column) => {
              const isOver = dragOverStage === column.stage;
              return (
                <div
                  key={column.stage}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverStage !== column.stage) {
                      setDragOverStage(column.stage);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverStage(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverStage(null);
                    const candidateId =
                      e.dataTransfer.getData("text/plain") || draggedCandidate?.id;
                    if (candidateId && draggedCandidate) {
                      if (draggedCandidate.currentStage !== column.stage) {
                        void handleStageChange(
                          candidateId,
                          draggedCandidate.name,
                          column.stage,
                        );
                      }
                    }
                    setDraggedCandidate(null);
                  }}
                  className={`relative overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] transition-all ${isOver
                    ? "ring-2 ring-[#2563EB]"
                    : ""
                    }`}
                >
                  <div className="h-[3px]" style={{ backgroundColor: STAGE_COLORS[column.stage] }} />
                  <div className="flex items-center justify-between px-3 py-3">
                    <span className="text-[13px] font-medium text-[#374151]">{STAGE_LABELS[column.stage]}</span>
                    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#E5E7EB] px-2 py-0.5 text-[12px] font-medium text-[#4B5563]">{column.count}</span>
                  </div>

                  <div className="max-h-[330px] space-y-2 overflow-y-auto overscroll-contain px-2 pb-2">
                    {column.candidates.length === 0 && (
                      <div className={`flex min-h-[118px] flex-col items-center justify-center rounded-lg border border-dashed ${isOver ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#D1D5DB]"}`}>
                        <Users className="mb-2 h-5 w-5 text-[#9CA3AF]" />
                        <span className="text-[12px] text-[#9CA3AF]">{isOver ? "Drop candidate here" : "No candidates"}</span>
                      </div>
                    )}

                    {column.candidates.map((card) => {
                      const fullCandidate = candidates?.items.find(
                        (c) => c.id === card.id,
                      );

                      return (
                        <div
                          key={card.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", card.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDraggedCandidate({
                              id: card.id,
                              name: card.full_name,
                              currentStage: column.stage,
                            });
                          }}
                          onDragEnd={() => setDraggedCandidate(null)}
                          className="cursor-grab rounded-lg border border-[#E5E7EB] bg-white p-3 transition hover:border-[#BFDBFE] active:cursor-grabbing"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar name={card.full_name} size="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-semibold text-[#111827]">{card.full_name}</p>
                              <p className="truncate text-[12px] text-[#6B7280]">{card.job_title}</p>
                            </div>
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: STAGE_COLORS[column.stage] }} />
                          </div>
                          <p className="mt-2 text-[12px] text-[#9CA3AF]">{timeAgo(card.stage_updated_at)}</p>

                          {/* Quick stage action badges */}
                          {column.stage === "offer" && (
                            <div className="mb-2">
                              {card.offer_details ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (fullCandidate) setOfferModalCandidate(fullCandidate);
                                    else {
                                      void recruitmentService
                                        .listCandidates({ search: card.full_name })
                                        .then((res) => {
                                          const c = res.items.find((i) => i.id === card.id);
                                          if (c) setOfferModalCandidate(c);
                                        });
                                    }
                                  }}
                                  className="w-full truncate rounded-md bg-[#FDF2F8] px-2 py-1.5 text-left text-[12px] font-medium text-[#BE185D] hover:bg-[#FCE7F3]"
                                >
                                  ₹{Number(card.offer_details.offered_salary).toLocaleString("en-IN")} · Edit
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (fullCandidate) setOfferModalCandidate(fullCandidate);
                                    else {
                                      void recruitmentService
                                        .listCandidates({ search: card.full_name })
                                        .then((res) => {
                                          const c = res.items.find((i) => i.id === card.id);
                                          if (c) setOfferModalCandidate(c);
                                        });
                                    }
                                  }}
                                  className="w-full rounded-md border border-[#FBCFE8] bg-white px-2 py-1.5 text-[12px] font-medium text-[#BE185D] hover:bg-[#FDF2F8]"
                                >
                                  + Issue Offer
                                </button>
                              )}
                            </div>
                          )}

                          {column.stage === "hired" && (
                            <div className="mb-2">
                              {card.is_onboarded ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-1 text-[12px] font-medium text-[#047857]">
                                  <CheckCircle2 className="h-4 w-4" />
                                  Onboarded ({card.employee_code ?? "EMP"})
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (fullCandidate) setOnboardModalCandidate(fullCandidate);
                                    else {
                                      void recruitmentService
                                        .listCandidates({ search: card.full_name })
                                        .then((res) => {
                                          const c = res.items.find((i) => i.id === card.id);
                                          if (c) setOnboardModalCandidate(c);
                                        });
                                    }
                                  }}
                                  className="w-full rounded-md bg-[#16A34A] px-2 py-1.5 text-[12px] font-medium text-white hover:bg-[#15803D]"
                                >
                                  Onboard as Employee
                                </button>
                              )}
                            </div>
                          )}

                          <StageSelect
                            value={column.stage}
                            onChange={(stage) =>
                              void handleStageChange(card.id, card.full_name, stage)
                            }
                          />
                        </div>
                      );
                    })}

                    {column.count > column.candidates.length && (
                      <p className="text-center text-[12px] font-medium text-[#6B7280]">
                        + {column.count - column.candidates.length} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[7fr_5fr]">
        {/* Job positions */}
        <Section
          title="Job Positions"
          icon={<Briefcase className="h-4 w-4" />}
          action={
            <Button variant="primary" size="sm" onClick={() => setJobModal({ job: null })} leftIcon={<Plus className="h-4 w-4" />}>Add Job</Button>
          }
        >
          {jobs.length === 0 ? (
            <EmptyText action={<Button variant="primary" size="sm" onClick={() => setJobModal({ job: null })} leftIcon={<Plus className="h-4 w-4" />}>Add Job</Button>}>
              No job positions yet
            </EmptyText>
          ) : (
            <div className="max-h-[360px] overflow-auto overscroll-contain">
              <table className="w-full min-w-[550px] text-left text-sm">
                <thead className="sticky top-0 bg-white text-slate-500 shadow-[0_1px_0_0_#e2e8f0]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Title</th>
                    <th className="py-2 pr-3 font-medium">Department</th>
                    <th className="py-2 pr-3 font-medium">Location</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium text-right">Actions</th>
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
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${job.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                            }`}
                        >
                          {job.status === "active" ? "Active" : "Closed"}
                        </span>
                      </td>
                      <td className="space-x-3 whitespace-nowrap py-3 pr-4 text-right text-xs">
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
          icon={<Users className="h-4 w-4" />}
        >
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search candidates..."
                className="h-9 w-full rounded-lg border border-[#D1D5DB] py-2 pl-9 pr-3 text-[13px] text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#DBEAFE]"
              />
            </div>
            <div className="relative">
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as CandidateStage | "")}
                className="h-9 appearance-none rounded-lg border border-[#D1D5DB] bg-white pl-3 pr-8 text-[13px] text-[#374151] outline-none focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#DBEAFE]"
              >
                <option value="">All Stages</option>
                {ALL_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {STAGE_LABELS[stage]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            </div>
            <Button variant="primary" size="sm" onClick={() => setCandidateModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>Add Candidate</Button>
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

                      {candidate.stage === "offer" && (
                        <div className="mt-1">
                          {candidate.offer_details ? (
                            <button
                              type="button"
                              onClick={() => setOfferModalCandidate(candidate)}
                              className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-[11px] font-semibold text-pink-700 hover:bg-pink-100"
                            >
                              <FileText className="h-3 w-3" />
                              Offer: ₹{Number(candidate.offer_details.offered_salary).toLocaleString("en-IN")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setOfferModalCandidate(candidate)}
                              className="inline-flex items-center gap-1 rounded-full bg-pink-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-pink-700"
                            >
                              <Send className="h-3 w-3" />
                              Issue Job Offer
                            </button>
                          )}
                        </div>
                      )}

                      {candidate.stage === "hired" && (
                        <div className="mt-1">
                          {candidate.is_onboarded ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Onboarded ({candidate.employee_code ?? "EMP"})
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setOnboardModalCandidate(candidate)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-700"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              Onboard as Employee
                            </button>
                          )}
                        </div>
                      )}
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

      {/* Resumes */}
      <Section title="Resume" icon={<Download className="h-5 w-5" />}>
        {!resumes || resumes.items.length === 0 ? (
          <EmptyText>No resumes uploaded yet.</EmptyText>
        ) : (
          <div className="max-h-[320px] overflow-auto overscroll-contain">
            <table className="w-full min-w-[550px] text-left text-sm">
              <thead className="sticky top-0 bg-white text-slate-500 shadow-[0_1px_0_0_#e2e8f0]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Candidate</th>
                  <th className="py-2 pr-3 font-medium">File</th>
                  <th className="py-2 pr-3 font-medium">Uploaded</th>
                  <th className="py-2 pr-4 font-medium text-right">Actions</th>
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
                      <td className="whitespace-nowrap py-3 pr-4 text-right">
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
      <Section title="Recruitment Reports" icon={<Briefcase className="h-4 w-4" />}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[5fr_7fr]">
          {/* Stage mix */}
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
            <div className="relative h-36 w-36 shrink-0">
              <div
                className="h-full w-full rounded-full"
                style={{ background: donutBackground }}
              />
              <div className="absolute inset-[26px] flex flex-col items-center justify-center rounded-full bg-white">
                <span className="text-[28px] font-semibold tracking-tight text-[#111827]">
                  {donutTotal}
                </span>
                <span className="text-[12px] text-[#6B7280]">
                  Candidates
                </span>
              </div>
            </div>

            <ul className="w-full min-w-0 flex-1 space-y-1">
              {stageEntries.map((entry) => {
                const percent =
                  donutTotal > 0
                    ? Math.round((entry.count / donutTotal) * 100)
                    : 0;

                return (
                  <li
                    key={entry.stage}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[12px] transition hover:bg-[#F9FAFB]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: STAGE_COLORS[entry.stage] }}
                      />
                      <span className="whitespace-nowrap font-medium text-[#374151]">
                        {STAGE_LABELS[entry.stage]}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-[#6B7280] tabular-nums">
                        {percent}%
                      </span>
                      <span className="w-5 text-right font-medium text-[#111827] tabular-nums">
                        {entry.count}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Department split */}
          <div className="min-w-0 border-t border-[#E5E7EB] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <p className="text-[14px] font-semibold text-[#111827]">
                Applications by Department
              </p>

              {departmentCounts.length > 0 && (
                <p className="text-[12px] font-medium text-[#6B7280]">
                  {departmentCounts.length} department
                  {departmentCounts.length === 1 ? "" : "s"}
                </p>
              )}
            </div>

            {departmentCounts.length === 0 ? (
              <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-[#D1D5DB]">
                <Briefcase className="mb-2 h-5 w-5 text-[#9CA3AF]" />
                <p className="text-[12px] text-[#6B7280]">
                  No applications yet.
                </p>
              </div>
            ) : (
              <ul className="max-h-[240px] space-y-3 overflow-y-auto overscroll-contain pr-1">
                {departmentCounts.map((item, index) => {
                  const percent = totalDepartmentApplications > 0
                    ? Math.round((item.count / totalDepartmentApplications) * 100)
                    : 0;

                  return (
                    <li key={item.department}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[12px]">
                        <span className="min-w-0 truncate font-medium text-[#374151]">
                          {item.department}
                        </span>

                        <span className="shrink-0 whitespace-nowrap text-[#6B7280] tabular-nums">
                          <span className="font-medium text-[#111827]">
                            {item.count}
                          </span>{" "}
                          · {percent}%
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-[#F3F4F6]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${totalDepartmentApplications > 0
                              ? (item.count / totalDepartmentApplications) * 100
                              : 0
                              }%`,
                            backgroundColor: STAGE_COLORS[PIPELINE_STAGES[index % PIPELINE_STAGES.length]],
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

      {
        pendingDelete && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,24,39,0.5)] p-4"
            onClick={() => {
              if (!deleting) setPendingDelete(null);
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              className="w-full max-w-sm rounded bg-white p-6 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-[18px] font-semibold text-[#111827]">
                Delete {pendingDelete.kind === "job" ? "job position" : "candidate"}?
              </h3>
              <p className="mt-2 text-[13px] text-[#6B7280]">
                "{pendingDelete.name}" will be deleted permanently
                {pendingDelete.kind === "candidate" ? ", including their resume." : "."}
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setPendingDelete(null)}
                  className="rounded border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleConfirmDelete()}
                  className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        viewingResume && (
          <ResumeViewerModal
            candidate={viewingResume}
            onClose={() => setViewingResume(null)}
            onDownload={() => void handleDownload(viewingResume)}
          />
        )
      }

      {
        jobModal && (
          <JobModal
            job={jobModal.job}
            departments={departments}
            onClose={() => setJobModal(null)}
            onSaved={handleSaved}
          />
        )
      }

      {
        candidateModalOpen && (
          <CandidateModal
            jobs={jobs}
            onClose={() => setCandidateModalOpen(false)}
            onSaved={handleSaved}
          />
        )
      }

      {
        offerModalCandidate && (
          <OfferModal
            candidate={offerModalCandidate}
            onClose={() => setOfferModalCandidate(null)}
            onSaved={handleSaved}
          />
        )
      }

      {
        onboardModalCandidate && (
          <OnboardCandidateModal
            candidate={onboardModalCandidate}
            onClose={() => setOnboardModalCandidate(null)}
            onSaved={handleSaved}
          />
        )
      }

      {
        rejectionCandidate && (
          <RejectionModal
            candidate={
              (candidates?.items.find((c) => c.id === rejectionCandidate.id) ?? {
                id: rejectionCandidate.id,
                full_name: rejectionCandidate.name,
                job_title: "Candidate",
              }) as Candidate
            }
            onClose={() => setRejectionCandidate(null)}
            onConfirm={(sendEmail, reason) =>
              void handleConfirmRejection(sendEmail, reason)
            }
          />
        )
      }
    </div >
  );
}

export default AdminRecruitment;
