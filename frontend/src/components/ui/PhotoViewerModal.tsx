import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export interface PhotoViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  name: string;
  designation?: string | null;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

export function PhotoViewerModal({
  isOpen,
  onClose,
  imageUrl,
  name,
  designation,
}: PhotoViewerModalProps) {
  const [entered, setEntered] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      setEntered(true);
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );

        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      setEntered(false);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Profile photo"
      onClick={onClose}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 sm:p-6 transition-opacity duration-200 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(4px)",
      }}
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="Close photo viewer"
        className="absolute right-4 top-4 sm:right-6 sm:top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        onClick={(event) => event.stopPropagation()}
        className={`flex flex-col items-center transition-transform duration-200 ease-out ${
          entered ? "scale-100" : "scale-[0.92]"
        }`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="max-h-[85vh] max-w-[90vw] rounded-[8px] object-contain shadow-2xl"
          />
        ) : (
          <div className="flex h-44 w-44 sm:h-56 sm:w-56 items-center justify-center rounded-full bg-[#2563EB] text-5xl sm:text-6xl font-semibold text-white shadow-2xl ring-4 ring-white/15">
            {initialsFor(name)}
          </div>
        )}

        <div className="mt-4 text-center">
          <p className="text-sm sm:text-base font-semibold text-white">{name}</p>
          {designation && (
            <p className="mt-0.5 text-xs sm:text-sm text-white/75">{designation}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default PhotoViewerModal;
