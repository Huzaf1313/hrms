import { useState, type ReactNode } from "react";
import { X } from "lucide-react";

import { recruitmentService } from "./recruitmentService";
import type { JobPosition } from "./types";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}

        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------- Job modal

interface JobModalProps {
  job: JobPosition | null;
  departments: string[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function JobModal({ job, departments, onClose, onSaved }: JobModalProps) {
  const [title, setTitle] = useState(job?.title ?? "");
  const [department, setDepartment] = useState(job?.department ?? "");
  const [location, setLocation] = useState(job?.location ?? "");
  const [openings, setOpenings] = useState(String(job?.openings ?? 1));
  const [description, setDescription] = useState(job?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    const openingsNumber = Number(openings);

    if (title.trim().length < 2) return setError("Enter a job title.");
    if (department.trim().length < 2) return setError("Enter a department.");
    if (location.trim().length < 2) return setError("Enter a location.");
    if (!Number.isInteger(openingsNumber) || openingsNumber < 1) {
      return setError("Openings must be a whole number, 1 or more.");
    }

    setSaving(true);
    setError("");

    const payload = {
      title: title.trim(),
      department: department.trim(),
      location: location.trim(),
      description: description.trim() || undefined,
      openings: openingsNumber,
    };

    try {
      if (job) {
        await recruitmentService.updateJob(job.id, payload);
        onSaved("Job position updated");
      } else {
        await recruitmentService.createJob(payload);
        onSaved("Job position created");
      }
    } catch (err) {
      setError(errorText(err));
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={job ? "Edit Job Position" : "Add Job Position"}
      onClose={onClose}
    >
      <div className="space-y-4">
        <Field label="Job title" required>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Backend Developer"
          />
        </Field>

        <Field label="Department">
          <input
            className={inputClass}
            list="recruitment-departments"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. Engineering"
          />
          <datalist id="recruitment-departments">
            {departments.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Location">
            <input
              className={inputClass}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Pune"
            />
          </Field>
          <Field label="Openings">
            <input
              className={inputClass}
              type="number"
              min={1}
              value={openings}
              onChange={(e) => setOpenings(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Description (optional)">
          <textarea
            className={inputClass}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ---------------------------------------------------------- Candidate modal

interface CandidateModalProps {
  jobs: JobPosition[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function CandidateModal({ jobs, onClose, onSaved }: CandidateModalProps) {
  const activeJobs = jobs.filter((job) => job.status === "active");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [jobId, setJobId] = useState(activeJobs[0]?.id ?? "");
  const [resume, setResume] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    const experienceNumber = experience.trim() === "" ? undefined : Number(experience);

    if (!jobId) return setError("Select an active job position.");
    if (fullName.trim().length < 2) return setError("Enter the candidate's name.");
    if (!EMAIL_PATTERN.test(email.trim())) return setError("Enter a valid email.");
    if (phone.trim().length > 20) return setError("Phone number is too long.");
    if (
      experienceNumber !== undefined &&
      (Number.isNaN(experienceNumber) || experienceNumber < 0 || experienceNumber > 60)
    ) {
      return setError("Experience must be a number between 0 and 60.");
    }

    const skillList = skills
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);

    if (skillList.length > 20) return setError("Add at most 20 skills.");

    setSaving(true);
    setError("");

    let created;

    try {
      created = await recruitmentService.createCandidate({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        skills: skillList,
        experience_years: experienceNumber,
        job_id: jobId,
      });
    } catch (err) {
      setError(errorText(err));
      setSaving(false);
      return;
    }

    if (resume) {
      try {
        await recruitmentService.uploadResume(created.id, resume);
      } catch (err) {
        onSaved(`Candidate added, but the resume was not uploaded: ${errorText(err)}`);
        return;
      }
    }

    onSaved("Candidate added");
  }

  return (
    <ModalShell title="Add Candidate" onClose={onClose}>
      {activeJobs.length === 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            There are no active job positions. Add a job position first, then
            add candidates to it.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Applying for">
            <select
              className={inputClass}
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
            >
              {activeJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} - {job.department}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Full name">
            <input
              className={inputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Phone (optional)">
              <input
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Skills (separate with commas)">
            <input
              className={inputClass}
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="React, Node.js, MongoDB"
            />
          </Field>

          <Field label="Experience in years (optional)">
            <input
              className={inputClass}
              type="number"
              min={0}
              step="0.5"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
            />
          </Field>

          <Field label="Resume (optional - PDF, DOC or DOCX, up to 5 MB)">
            <input
              className="block w-full text-sm text-slate-600"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setResume(e.target.files?.[0] ?? null)}
            />
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Add Candidate"}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
