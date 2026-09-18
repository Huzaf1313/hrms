import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Megaphone,
  Plus,
  Search,
  Filter,
  Calendar,
  User,
  ArrowRight,
  ArrowLeft,
  Pin,
  Clock,
  FileText,
  Shield,
  PartyPopper,
  Wrench,
  Eye,
  Paperclip,
  Download,
  UploadCloud,
  Send,
  Pencil,
  Trash2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  X,
} from "lucide-react";
import { api, ApiError } from "../../services/api";

// ---- Types ------------------------------------------------------------------

type Category =
  | "Company News"
  | "HR & Policy"
  | "Events"
  | "IT & System";

type Status = "NEW" | "IMPORTANT" | "UPCOMING" | "INFO";

type Priority = "Normal" | "Important" | "Urgent";

type Audience = "All Employees" | "Department-wise" | "Custom";

interface Announcement {
  id: string;
  category: Category;
  status: Status;
  priority: Priority;
  title: string;
  description: string;
  date: string;
  author: string;
  publishDate: string;
  expiryDate: string | null;
  audience: Audience;
  pinned: boolean;
  attachment?: {
    filename: string;
    url: string;
    content_type?: string;
    size?: number;
  } | null;
}

interface PinnedItem {
  id: string;
  category: Category;
  title: string;
  date: string;
}

interface RecentItem {
  id: string;
  category: Category;
  title: string;
  date: string;
}

const pinnedAnnouncements: PinnedItem[] = [
  {
    id: "p1",
    category: "HR & Policy",
    title: "Updated Leave Policy",
    date: "May 01, 2026",
  },
  {
    id: "p2",
    category: "Company News",
    title: "Holiday Calendar 2026",
    date: "Apr 25, 2026",
  },
];

const recentAnnouncements: RecentItem[] = [
  {
    id: "r1",
    category: "IT & System",
    title: "System Maintenance",
    date: "Sep 16, 2026",
  },
  {
    id: "r2",
    category: "Company News",
    title: "Welcome to Our New HRMS Platform!",
    date: "May 05, 2026",
  },
  {
    id: "r3",
    category: "Events",
    title: "Annual Team Building Event",
    date: "Apr 28, 2026",
  },
];

const tabs: ("All" | Category)[] = [
  "All",
  "Company News",
  "HR & Policy",
  "Events",
  "IT & System",
];

// ---- Style helpers -----------------------------------------------------------

const categoryStyles: Record<
  Category,
  { badge: string; icon: ReactNode; iconBg: string }
> = {
  "Company News": {
    badge: "bg-blue-50 text-blue-600",
    icon: <FileText className="h-5 w-5 text-blue-600" />,
    iconBg: "bg-blue-100",
  },

  "HR & Policy": {
    badge: "bg-purple-50 text-purple-600",
    icon: <Shield className="h-5 w-5 text-purple-600" />,
    iconBg: "bg-purple-100",
  },

  Events: {
    badge: "bg-green-50 text-green-600",
    icon: <PartyPopper className="h-5 w-5 text-green-600" />,
    iconBg: "bg-green-100",
  },

  "IT & System": {
    badge: "bg-orange-50 text-orange-600",
    icon: <Wrench className="h-5 w-5 text-orange-600" />,
    iconBg: "bg-orange-100",
  },
};

const statusStyles: Record<Status, string> = {
  NEW: "bg-green-100 text-green-700",
  IMPORTANT: "bg-red-100 text-red-700",
  UPCOMING: "bg-blue-100 text-blue-700",
  INFO: "bg-orange-100 text-orange-700",
};

const dotStyles: Record<Category, string> = {
  "Company News": "bg-blue-500",
  "HR & Policy": "bg-purple-500",
  Events: "bg-green-500",
  "IT & System": "bg-orange-500",
};

// ---- Page --------------------------------------------------------------------

export default function AdminAnnouncements() {
  // List state
  const [activeTab, setActiveTab] =
    useState<(typeof tabs)[number]>("All");

  const [search, setSearch] = useState("");

  const [announcementList, setAnnouncementList] = useState<Announcement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<Announcement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [priority, setPriority] = useState<Priority>("Important");

  const [publishDate, setPublishDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [expiryDate, setExpiryDate] = useState("");

  const [audience, setAudience] =
    useState<Audience>("All Employees");

  const [description, setDescription] = useState("");

  const [attachment, setAttachment] = useState<File | null>(null);

  const [isPinned, setIsPinned] = useState(true);

  const mapAnnouncement = (item: {
    id: string;
    category: Category;
    priority: Priority;
    title: string;
    description: string;
    publish_date: string;
    expiry_date: string | null;
    audience: Audience;
    pinned: boolean;
    author_name: string;
    attachment?: Announcement["attachment"];
  }): Announcement => ({
    id: item.id,
    category: item.category,
    priority: item.priority,
    status:
      item.priority === "Normal"
        ? "NEW"
        : item.priority === "Urgent" || item.priority === "Important"
          ? "IMPORTANT"
          : "INFO",
    title: item.title,
    description: item.description,
    date: new Date(`${item.publish_date}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }),
    publishDate: item.publish_date,
    expiryDate: item.expiry_date,
    audience: item.audience,
    pinned: item.pinned,
    author: item.author_name || "HR Team",
    attachment: item.attachment,
  });

  useEffect(() => {
    let isMounted = true;

    api
      .get<Array<Parameters<typeof mapAnnouncement>[0]>>("/announcements", {
        limit: 100,
      })
      .then((items) => {
        if (isMounted) {
          setAnnouncementList(items.map(mapAnnouncement));
        }
      })
      .catch((requestError: unknown) => {
        if (isMounted) {
          setError(
            requestError instanceof ApiError
              ? requestError.message
              : "Could not load announcements.",
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // ---- Filter announcements -----------------------------------------------

  const filtered = useMemo(() => {
    return announcementList.filter((a) => {
      const matchesTab =
        activeTab === "All" || a.category === activeTab;

      const searchText = search.toLowerCase();

      const matchesSearch =
        a.title.toLowerCase().includes(searchText) ||
        a.description.toLowerCase().includes(searchText);

      return matchesTab && matchesSearch;
    });
  }, [activeTab, search, announcementList]);

  // ---- Open create form ----------------------------------------------------

  const handleCreateAnnouncement = () => {
    setEditingAnnouncement(null);
    setShowCreateForm(true);
  };

  const handleEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setTitle(announcement.title);
    setCategory(announcement.category);
    setPriority(announcement.priority);
    setPublishDate(announcement.publishDate);
    setExpiryDate(announcement.expiryDate || "");
    setAudience(announcement.audience);
    setDescription(announcement.description);
    setAttachment(null);
    setIsPinned(announcement.pinned);
    setSelectedAnnouncement(null);
    setShowCreateForm(true);
  };

  const handleDeleteAnnouncement = async (announcement: Announcement) => {
    if (!window.confirm(`Delete "${announcement.title}"?`)) return;

    try {
      setError("");
      await api.delete(`/announcements/${announcement.id}`);
      setAnnouncementList((previous) =>
        previous.filter((item) => item.id !== announcement.id),
      );
      setSelectedAnnouncement(null);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not delete the announcement.",
      );
    }
  };

  // ---- Reset form ----------------------------------------------------------

  const resetForm = () => {
    setTitle("");
    setCategory("");
    setPriority("Important");
    setPublishDate(new Date().toISOString().split("T")[0]);
    setExpiryDate("");
    setAudience("All Employees");
    setDescription("");
    setAttachment(null);
    setIsPinned(true);
  };

  // ---- Cancel form ---------------------------------------------------------

  const handleCancel = () => {
    resetForm();
    setEditingAnnouncement(null);
    setShowCreateForm(false);
  };

  // ---- Publish announcement -----------------------------------------------

  const handlePublish = async () => {
    if (!title.trim()) {
      alert("Please enter an announcement title.");
      return;
    }

    if (!category) {
      alert("Please select a category.");
      return;
    }

    if (!description.trim()) {
      alert("Please enter the announcement description.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("category", category);
    formData.append("priority", priority);
    formData.append("publish_date", publishDate);
    if (expiryDate) formData.append("expiry_date", expiryDate);
    formData.append("audience", audience);
    formData.append("description", description.trim());
    formData.append("pinned", String(isPinned));
    if (editingAnnouncement) {
      formData.append("clear_expiry", String(!expiryDate));
    }
    if (attachment) formData.append("attachment", attachment);

    try {
      setError("");
      const saved = editingAnnouncement
        ? await api.putForm<Parameters<typeof mapAnnouncement>[0]>(
            `/announcements/${editingAnnouncement.id}`,
            formData,
          )
        : await api.postForm<Parameters<typeof mapAnnouncement>[0]>(
            "/announcements",
            formData,
          );
      const savedAnnouncement = mapAnnouncement(saved);
      setAnnouncementList((previous) =>
        editingAnnouncement
          ? previous.map((item) =>
              item.id === savedAnnouncement.id ? savedAnnouncement : item,
            )
          : [savedAnnouncement, ...previous],
      );
      alert(
        editingAnnouncement
          ? "Announcement updated successfully!"
          : "Announcement published successfully!",
      );
      resetForm();
      setEditingAnnouncement(null);
      setShowCreateForm(false);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not publish the announcement.",
      );
    }
  };

  // ==========================================================================
  // CREATE ANNOUNCEMENT FORM
  // ==========================================================================

  if (showCreateForm) {
    const previewCategory: Category =
      category || "Company News";

    const previewTitle =
      title.trim() || "Sample Announcement Title";

    const previewDescription =
      description.trim() ||
      "This is a preview of how your announcement will appear to employees.";

    const previewDate = publishDate
      ? new Date(publishDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "May 8, 2026";

    return (
      <div className="min-h-screen bg-slate-50 px-6 py-6">
        {/* Header ----------------------------------------------------------- */}

        <div className="mb-6 flex items-start gap-3">
          <button
            type="button"
            onClick={() => setShowCreateForm(false)}
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-50"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
               {editingAnnouncement ? "Edit Announcement" : "Create Announcement"}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Share important updates, policies and news with your employees.
            </p>
          </div>
        </div>

        {/* Main grid -------------------------------------------------------- */}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_510px]">
          {/* LEFT FORM ------------------------------------------------------ */}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {/* Title -------------------------------------------------------- */}

            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Title <span className="text-red-500">*</span>
              </label>

              <input
                type="text"
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter announcement title"
                className="w-full rounded-lg border border-blue-100 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
              />

              <div className="mt-1 text-right text-xs text-slate-400">
                {title.length}/100
              </div>
            </div>

            {/* Category + Priority ----------------------------------------- */}

            <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-[1fr_1fr]">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Category <span className="text-red-500">*</span>
                </label>

                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as Category | "")
                  }
                  className="w-full rounded-lg border border-blue-100 bg-white px-3 py-3 text-sm text-slate-600 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="">Select category</option>
                  <option value="Company News">Company News</option>
                  <option value="HR & Policy">HR & Policy</option>
                  <option value="Events">Events</option>
                  <option value="IT & System">IT & System</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Priority
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {(["Normal", "Important", "Urgent"] as Priority[]).map(
                    (item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPriority(item)}
                        className={`rounded-lg px-2 py-3 text-sm font-medium transition ${
                          priority === item
                            ? item === "Normal"
                              ? "bg-blue-100 text-blue-600 ring-1 ring-blue-200"
                              : item === "Important"
                                ? "bg-orange-100 text-orange-600 ring-1 ring-orange-200"
                                : "bg-red-100 text-red-600 ring-1 ring-red-200"
                            : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Dates -------------------------------------------------------- */}

            <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Publish Date <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                  <input
                    type="date"
                    value={publishDate}
                    onChange={(e) =>
                      setPublishDate(e.target.value)
                    }
                    className="w-full rounded-lg border border-blue-100 bg-white py-3 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Expiry Date{" "}
                  <span className="font-normal text-slate-500">
                    (Optional)
                  </span>
                </label>

                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                  <input
                    type="date"
                    value={expiryDate}
                    min={publishDate}
                    onChange={(e) =>
                      setExpiryDate(e.target.value)
                    }
                    className="w-full rounded-lg border border-blue-100 bg-white py-3 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>

            {/* Audience ----------------------------------------------------- */}

            <div className="mb-5">
              <label className="mb-3 block text-sm font-semibold text-slate-800">
                Audience
              </label>

              <div className="flex flex-wrap gap-x-7 gap-y-3">
                {(
                  [
                    "All Employees",
                    "Department-wise",
                    "Custom",
                  ] as Audience[]
                ).map((item) => (
                  <label
                    key={item}
                    className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="radio"
                      name="audience"
                      value={item}
                      checked={audience === item}
                      onChange={() => setAudience(item)}
                      className="h-4 w-4 accent-blue-600"
                    />

                    {item}
                  </label>
                ))}
              </div>
            </div>

            {/* Description -------------------------------------------------- */}

            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Description / Content{" "}
                <span className="text-red-500">*</span>
              </label>

              <div className="overflow-hidden rounded-lg border border-blue-100 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10">
                {/* Toolbar */}

                <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-2">
                  <button
                    type="button"
                    title="Bold"
                    className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    <Bold className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    title="Italic"
                    className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    <Italic className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    title="Underline"
                    className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    <Underline className="h-4 w-4" />
                  </button>

                  <div className="mx-1 h-5 w-px bg-slate-200" />

                  <button
                    type="button"
                    title="Bullet list"
                    className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    <List className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    title="Numbered list"
                    className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    <ListOrdered className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    title="Link"
                    className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    <Link className="h-4 w-4" />
                  </button>

                  <div className="ml-2">
                    <select className="rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-600 outline-none">
                      <option>Normal</option>
                      <option>Heading 1</option>
                      <option>Heading 2</option>
                    </select>
                  </div>
                </div>

                <textarea
                  value={description}
                  maxLength={5000}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                  placeholder="Write your announcement details here..."
                  className="min-h-[145px] w-full resize-none border-0 px-3 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="mt-1 text-right text-xs text-slate-400">
                {description.length}/5000
              </div>
            </div>

            {/* Attachment --------------------------------------------------- */}

            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Attachment{" "}
                <span className="font-normal text-slate-500">
                  (Optional)
                </span>
              </label>

              <label className="flex min-h-[86px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-blue-200 bg-slate-50/50 text-center transition hover:bg-blue-50/30">
                <UploadCloud className="mb-1 h-6 w-6 text-blue-500" />

                {attachment ? (
                  <>
                    <p className="text-sm font-medium text-blue-600">
                      {attachment.name}
                    </p>

                    <p className="text-xs text-slate-400">
                      Click to replace file
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-blue-600">
                      Drag and drop files here, or{" "}
                      <span className="font-semibold">
                        click to browse
                      </span>
                    </p>

                    <p className="mt-1 text-[11px] text-slate-500">
                      Supports: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG
                      (Max 10MB)
                    </p>
                  </>
                )}

                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) =>
                    setAttachment(
                      e.target.files?.[0] || null
                    )
                  }
                />
              </label>
            </div>

            {/* Bottom controls --------------------------------------------- */}

            <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) =>
                    setIsPinned(e.target.checked)
                  }
                  className="h-4 w-4 rounded accent-blue-600"
                />

                <Pin className="h-4 w-4 text-blue-500" />

                Pin this announcement{" "}
                <span className="text-xs text-slate-400">
                  (keep it on top)
                </span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg border border-blue-100 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handlePublish}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                   {editingAnnouncement ? (
                     <Pencil className="h-4 w-4" />
                   ) : (
                     <Send className="h-4 w-4" />
                   )}
                   {editingAnnouncement ? "Save Changes" : "Publish Announcement"}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN --------------------------------------------------- */}

          <div className="flex flex-col gap-5">
            {/* Preview ------------------------------------------------------ */}

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
                <Eye className="h-5 w-5 text-blue-600" />
                Preview
              </h2>

              <div className="rounded-xl bg-slate-50 p-4">
                {/* Preview header */}

                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                    <Megaphone className="h-7 w-7 text-blue-600" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${categoryStyles[previewCategory].badge}`}
                      >
                        {previewCategory}
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          priority === "Urgent"
                            ? "bg-red-100 text-red-600"
                            : priority === "Normal"
                              ? "bg-blue-100 text-blue-600"
                              : "bg-red-100 text-red-600"
                        }`}
                      >
                        {priority.toUpperCase()}
                      </span>
                    </div>

                    <h3 className="mt-3 text-base font-bold text-slate-900">
                      {previewTitle}
                    </h3>

                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                      {previewDescription}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {previewDate}
                      </span>

                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        By HR Team
                      </span>
                    </div>
                  </div>
                </div>

                {/* Preview attachment */}

                {attachment && (
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-slate-500" />

                        <div>
                          <p className="text-xs font-semibold text-slate-700">
                            Attachment
                          </p>

                          <p className="mt-1 text-sm text-blue-600">
                            {attachment.name}
                          </p>
                        </div>
                      </div>

                      <Download className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tips --------------------------------------------------------- */}

            <div className="rounded-xl border border-slate-200 bg-blue-50/60 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                <span className="text-2xl">💡</span>
                Tips
              </h2>

              <ul className="space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
                <li>
                  Keep the title short and clear.
                </li>

                <li>
                  Choose the right category and priority.
                </li>

                <li>
                  Use the audience option if the announcement is
                  for specific departments.
                </li>

                <li>
                  You can attach files like PDFs, documents or
                  images.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // ANNOUNCEMENT LIST
  // ==========================================================================

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-6">
      {/* Header ------------------------------------------------------------- */}

      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600">
            <Megaphone className="h-5 w-5 text-white" />
          </span>

          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Announcements
            </h1>

            <p className="mt-0.5 text-sm text-slate-500">
              Share important updates, policies and news with your team.
            </p>
          </div>
        </div>

        {/* CREATE BUTTON */}

        <button
          type="button"
          onClick={handleCreateAnnouncement}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create Announcement
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* Main column ------------------------------------------------------ */}

        <div className="min-w-0">
          {/* Tabs */}

          <div className="mb-4 flex items-center gap-6 border-b border-slate-200">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`-mb-px border-b-2 pb-3 text-sm font-medium transition ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search */}

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search announcements..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Announcement cards */}

          <div className="flex flex-col gap-4">
            {isLoading && (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
                Loading announcements...
              </div>
            )}

            {filtered.map((a) => {
              const style = categoryStyles[a.category];

              return (
                <div
                  key={a.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${style.iconBg}`}
                    >
                      {style.icon}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.badge}`}
                        >
                          {a.category}
                        </span>

                        {a.status && (
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyles[a.status]}`}
                          >
                            {a.status}
                          </span>
                        )}
                      </div>

                      <h3 className="mb-1 text-[15px] font-semibold text-slate-900">
                        {a.title}
                      </h3>

                      <p className="mb-3 text-sm leading-relaxed text-slate-500">
                        {a.description}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {a.date}
                          </span>

                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            By {a.author}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleEditAnnouncement(a)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                            title="Edit announcement"
                            aria-label="Edit announcement"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteAnnouncement(a)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            title="Delete announcement"
                            aria-label="Delete announcement"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedAnnouncement(a)}
                            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                          >
                            View Details
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {!isLoading && filtered.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
                No announcements match your search.
              </div>
            )}
          </div>

          {/* Pagination */}

          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Showing 1–{filtered.length} of{" "}
              {announcementList.length} announcements
            </p>

            <div className="flex items-center gap-1">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100"
              >
                ‹
              </button>

              {[1, 2, 3].map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium ${
                    page === 1
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100"
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {/* Right sidebar --------------------------------------------------- */}

        <div className="flex flex-col gap-5">
          {/* Quick Filters */}

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Filter className="h-4 w-4 text-slate-400" />
              Quick Filters
            </h3>

            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Category
            </label>

            <select className="mb-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              <option>All Categories</option>
              <option>Company News</option>
              <option>HR & Policy</option>
              <option>Events</option>
              <option>IT & System</option>
            </select>

            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Date Range
            </label>

            <select className="mb-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              <option>Last 30 Days</option>
              <option>Last 7 Days</option>
              <option>Last 90 Days</option>
              <option>All Time</option>
            </select>

            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Filter className="h-4 w-4" />
              Apply
            </button>
          </div>

          {/* Pinned */}

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Pin className="h-4 w-4 text-slate-400" />
                Pinned Announcements
              </h3>

              <button
                type="button"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                View All
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {pinnedAnnouncements.map((p) => {
                const style = categoryStyles[p.category];

                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-2.5"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.iconBg}`}
                    >
                      {style.icon}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {p.title}
                      </p>

                      <p className="text-xs text-slate-400">
                        {p.date}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent */}

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Clock className="h-4 w-4 text-slate-400" />
                Recent Announcements
              </h3>

              <button
                type="button"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                View All
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {recentAnnouncements.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start gap-2.5"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotStyles[r.category]}`}
                  />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {r.title}
                    </p>

                    <p className="text-xs text-slate-400">
                      {r.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-details-title"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${categoryStyles[selectedAnnouncement.category].badge}`}
                >
                  {selectedAnnouncement.category}
                </span>
                <h2 id="announcement-details-title" className="mt-3 text-xl font-bold text-slate-900">
                  {selectedAnnouncement.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close announcement details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Published {selectedAnnouncement.date}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                By {selectedAnnouncement.author}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                {selectedAnnouncement.priority}
              </span>
            </div>

            <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {selectedAnnouncement.description}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">Audience</p>
                <p className="font-medium text-slate-700">{selectedAnnouncement.audience}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Expiry date</p>
                <p className="font-medium text-slate-700">
                  {selectedAnnouncement.expiryDate || "No expiry date"}
                </p>
              </div>
            </div>

            {selectedAnnouncement.attachment && (
              <a
                href={`http://localhost:8000${selectedAnnouncement.attachment.url}`}
                target="_blank"
                rel="noreferrer"
                className="mt-5 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
              >
                <Paperclip className="h-4 w-4" />
                {selectedAnnouncement.attachment.filename}
                <Download className="ml-auto h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
