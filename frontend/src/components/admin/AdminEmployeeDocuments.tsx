import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";

import { api, downloadFile } from "../../services/api";

interface EmployeeDocument {
  id: string;
  document_name: string;
  document_type: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
  source?: string | null;
  uploaded_by?: string | null;
}

interface DocumentsResponse {
  documents: EmployeeDocument[];
  summary: { total_documents: number; categories: Record<string, number> };
}

export default function AdminEmployeeDocuments({
  employeeId,
}: {
  employeeId: string;
}) {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("Employment");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<DocumentsResponse>("/employee-documents", {
        employee_id: employeeId,
      });
      setDocuments(data.documents);
    } catch {
      setMessage("Unable to load employee documents.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    // The request updates component state after the external API responds.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocuments();
  }, [loadDocuments]);

  async function uploadDocument() {
    if (!file || !name.trim()) {
      setMessage("Enter a document name and select a file.");
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      const form = new FormData();
      form.append("employee_id", employeeId);
      form.append("document_name", name.trim());
      form.append("document_type", type);
      form.append("file", file);
      await api.postForm("/employee-documents", form);
      setName("");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await loadDocuments();
    } catch {
      setMessage("Unable to upload this document.");
    } finally {
      setUploading(false);
    }
  }

  async function downloadDocument(document: EmployeeDocument) {
    const blob = await downloadFile(`/employee-documents/${document.id}/download`);
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = document.file_name || document.document_name;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function deleteDocument(document: EmployeeDocument) {
    setDeletingId(document.id);
    setMessage("");

    try {
      await api.delete<null>(`/employee-documents/${document.id}`);
      await loadDocuments();
    } catch {
      setMessage("Unable to delete this document.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
        <FileText size={20} className="text-gray-700" />
        Employee Documents
      </h3>

      <div className="grid gap-3 md:grid-cols-[1fr_160px_1fr_auto]">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Document name"
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#2563eb]"
        />
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2563eb]"
        >
          <option>Employment</option>
          <option>Identity</option>
          <option>Education</option>
          <option>Certificates</option>
          <option>Tax & Payroll</option>
          <option>Other</option>
        </select>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/jpeg,image/png,image/webp"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="min-w-0 rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={uploadDocument}
          disabled={uploading}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload
        </button>
      </div>

      {message && <p className="mt-3 text-xs text-red-600">{message}</p>}

      {loading ? (
        <p className="mt-5 text-sm text-gray-400">Loading documents...</p>
      ) : documents.length === 0 ? (
        <p className="mt-5 text-sm text-gray-400">No documents uploaded.</p>
      ) : (
        <div className="mt-5 space-y-5">
          {([
            ["employee", "Documents Uploaded by Employee"],
            ["hr_admin", "Documents Uploaded by HR"],
          ] as const).map(([source, heading]) => {
            const sourceDocuments = documents.filter((document) =>
              source === "employee"
                ? document.source === "employee" || document.source === "employee_upload"
                : document.source === source,
            );

            return (
              <section key={source}>
                <h4 className="mb-2 text-sm font-semibold text-gray-700">{heading}</h4>
                {sourceDocuments.length === 0 ? (
                  <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-400">
                    No documents in this section.
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {sourceDocuments.map((document) => (
                      <div key={document.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800">{document.document_name}</p>
                          <p className="text-xs text-gray-400">
                            {document.document_type} · {document.file_name} · {document.uploaded_by || "Unknown uploader"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void downloadDocument(document)}
                          disabled={deletingId === document.id}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#2563eb] hover:bg-blue-50 disabled:opacity-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </button>

                        <button
                          type="button"
                          onClick={() => void deleteDocument(document)}
                          disabled={deletingId === document.id}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === document.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
