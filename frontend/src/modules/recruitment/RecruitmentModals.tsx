import { useState, type ReactNode } from "react";
import { Mail, UserCheck, X } from "lucide-react";

import { recruitmentService } from "./recruitmentService";
import type { Candidate, JobPosition } from "./types";

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

// ---------------------------------------------------------------- Offer modal

interface OfferModalProps {
  candidate: Candidate;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function OfferModal({ candidate, onClose, onSaved }: OfferModalProps) {
  const existing = candidate.offer_details;
  const [offeredSalary, setOfferedSalary] = useState(
    existing ? String(existing.offered_salary) : ""
  );
  const [joiningDate, setJoiningDate] = useState(
    existing?.joining_date ?? new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
  );
  const [designation, setDesignation] = useState(
    existing?.designation ?? candidate.job_title
  );
  const [workLocation, setWorkLocation] = useState(
    existing?.work_location ?? "Office"
  );
  const [expiryDate, setExpiryDate] = useState(
    existing?.expiry_date ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    const salary = Number(offeredSalary);
    if (!salary || Number.isNaN(salary) || salary <= 0) {
      return setError("Please enter a valid offered salary (Annual CTC).");
    }
    if (!joiningDate) {
      return setError("Please specify a proposed joining date.");
    }

    setSaving(true);
    setError("");

    try {
      await recruitmentService.issueOffer(candidate.id, {
        offered_salary: salary,
        joining_date: joiningDate,
        designation: designation.trim() || candidate.job_title,
        work_location: workLocation.trim() || "Office",
        expiry_date: expiryDate || undefined,
        notes: notes.trim() || undefined,
        send_email: sendEmail,
      });

      onSaved(
        sendEmail
          ? `Offer issued to ${candidate.full_name} and email notification dispatched.`
          : `Offer issued to ${candidate.full_name} successfully.`
      );
    } catch (err) {
      setError(errorText(err));
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Issue Job Offer — ${candidate.full_name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-900">
          <p className="font-semibold text-blue-800">{candidate.full_name}</p>
          <p className="text-blue-600">
            {candidate.job_title} · {candidate.department} · {candidate.email}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Annual CTC (₹)" required>
            <input
              className={inputClass}
              type="number"
              min={1}
              step="1000"
              placeholder="e.g. 650000"
              value={offeredSalary}
              onChange={(e) => setOfferedSalary(e.target.value)}
            />
          </Field>
          <Field label="Proposed Joining Date" required>
            <input
              className={inputClass}
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Designation">
            <input
              className={inputClass}
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
            />
          </Field>
          <Field label="Work Location">
            <input
              className={inputClass}
              value={workLocation}
              onChange={(e) => setWorkLocation(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Offer Expiry Date (optional)">
          <input
            className={inputClass}
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </Field>

        <Field label="Special Notes / Instructions (optional)">
          <textarea
            className={inputClass}
            rows={2}
            placeholder="e.g. Please bring original degree certificates and ID proof on Day 1."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <label className="flex items-center gap-2 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-blue-600" />
            Send formal offer letter notification email to candidate
          </span>
        </label>

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
            {saving ? "Issuing Offer..." : "Issue & Send Offer"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// -------------------------------------------------------- Onboard candidate modal

interface OnboardCandidateModalProps {
  candidate: Candidate;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function OnboardCandidateModal({
  candidate,
  onClose,
  onSaved,
}: OnboardCandidateModalProps) {
  const offer = candidate.offer_details;
  const [joiningDate, setJoiningDate] = useState(
    offer?.joining_date ?? new Date().toISOString().slice(0, 10)
  );
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [workLocation, setWorkLocation] = useState(
    offer?.work_location ?? "Office"
  );
  const [salary, setSalary] = useState(
    offer ? String(offer.offered_salary) : ""
  );
  const [tempPassword, setTempPassword] = useState("");
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleOnboard() {
    setSaving(true);
    setError("");

    try {
      const updated = await recruitmentService.onboardCandidate(candidate.id, {
        joining_date: joiningDate,
        employment_type: employmentType,
        work_location: workLocation,
        salary: salary ? Number(salary) : undefined,
        temporary_password: tempPassword.trim() || undefined,
        send_welcome_email: sendWelcomeEmail,
      });

      onSaved(
        `Candidate ${candidate.full_name} onboarded as Employee ${updated.employee_code ?? ""} successfully!`
      );
    } catch (err) {
      setError(errorText(err));
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Onboard as Employee — ${candidate.full_name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-emerald-900">
          <p className="font-semibold text-emerald-800 flex items-center gap-1.5">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            {candidate.full_name}
          </p>
          <p className="text-emerald-700 mt-0.5">
            Designation: <strong>{candidate.job_title}</strong> · Department: <strong>{candidate.department}</strong>
          </p>
          <p className="text-emerald-600">{candidate.email} {candidate.phone ? `· ${candidate.phone}` : ""}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Official Joining Date" required>
            <input
              className={inputClass}
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
            />
          </Field>
          <Field label="Employment Type">
            <select
              className={inputClass}
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
            >
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Intern">Intern</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Work Location">
            <input
              className={inputClass}
              value={workLocation}
              onChange={(e) => setWorkLocation(e.target.value)}
            />
          </Field>
          <Field label="Annual Salary / CTC (₹)">
            <input
              className={inputClass}
              type="number"
              min={0}
              placeholder="e.g. 600000"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Custom Password (leave blank to auto-generate)">
          <input
            className={inputClass}
            type="text"
            placeholder="Auto-generated secure password"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
          />
        </Field>

        <label className="flex items-center gap-2 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={sendWelcomeEmail}
            onChange={(e) => setSendWelcomeEmail(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-blue-600" />
            Send Welcome Email with login portal instructions
          </span>
        </label>

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
            onClick={() => void handleOnboard()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Onboarding..." : "Confirm & Create Employee"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ----------------------------------------------------------- Rejection modal

interface RejectionModalProps {
  candidate: Candidate;
  onClose: () => void;
  onConfirm: (sendEmail: boolean, reason: string) => void;
}

export function RejectionModal({
  candidate,
  onClose,
  onConfirm,
}: RejectionModalProps) {
  const [sendEmail, setSendEmail] = useState(true);
  const [reason, setReason] = useState("");

  return (
    <ModalShell title={`Move to Rejected — ${candidate.full_name}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Are you sure you want to mark <strong>{candidate.full_name}</strong> as <strong>Rejected</strong> for the position of <strong>{candidate.job_title}</strong>?
        </p>

        <Field label="Rejection Feedback (Optional - shared with candidate if email is sent)">
          <textarea
            className={inputClass}
            rows={3}
            placeholder="e.g. We are moving forward with candidates who have deeper expertise in the required stack."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        <label className="flex items-center gap-2 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
            className="rounded border-slate-300 text-red-600 focus:ring-red-500"
          />
          <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-red-600" />
            Send polite rejection email to candidate
          </span>
        </label>

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
            onClick={() => onConfirm(sendEmail, reason.trim())}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Confirm Rejection
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
