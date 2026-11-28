import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

import { recruitmentService } from "./recruitmentService";
import type { Candidate } from "./types";

interface ResumeViewerModalProps {
  candidate: Candidate;
  onClose: () => void;
  onDownload: () => void;
}

// Opens a candidate's resume in a window on top of the page. Only PDFs can be
// shown inside the browser; DOC/DOCX files have to be downloaded.
export default function ResumeViewerModal({
  candidate,
  onClose,
  onDownload,
}: ResumeViewerModalProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const isPdf = (candidate.resume_file_name ?? "").toLowerCase().endsWith(".pdf");

  useEffect(() => {
    if (!isPdf) return;

    let active = true;
    let objectUrl: string | null = null;

    recruitmentService
      .downloadResume(candidate.id)
      .then((blob) => {
        if (!active) return;

        objectUrl = URL.createObjectURL(
          new Blob([blob], { type: "application/pdf" }),
        );
        setUrl(objectUrl);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not load the resume.");
        }
      });

    return () => {
      active = false;

      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [candidate.id, isPdf]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKey);

    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2px] bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Resume of ${candidate.full_name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-800">
              {candidate.full_name}
            </p>
            <p className="truncate text-xs text-slate-500">
              {candidate.resume_file_name}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onDownload}
              className="flex items-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-slate-100">
          {!isPdf ? (
            <p className="p-10 text-center text-sm text-slate-500">
              Preview is only available for PDF files. Use the Download button to
              open this resume.
            </p>
          ) : error ? (
            <p className="p-10 text-center text-sm text-red-600">{error}</p>
          ) : !url ? (
            <p className="p-10 text-center text-sm text-slate-500">
              Loading resume...
            </p>
          ) : (
            <iframe
              src={url}
              title={`Resume of ${candidate.full_name}`}
              className="h-full w-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
