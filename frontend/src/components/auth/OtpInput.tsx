import React, { useRef, useEffect } from "react";

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  value,
  onChange,
  disabled = false,
  autoFocus = false,
}) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Split the string into 6 slots
  const chars = value.split("").slice(0, 6);
  const slots = Array.from({ length: 6 }, (_, index) => chars[index] || "");

  useEffect(() => {
    if (autoFocus && inputsRef.current[0] && !disabled) {
      inputsRef.current[0].focus();
    }
  }, [autoFocus, disabled]);

  const handleInputChange = (
    index: number,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const rawValue = event.target.value.replace(/\D/g, "");
    if (!rawValue) {
      // Clear this index
      const nextSlots = [...slots];
      nextSlots[index] = "";
      onChange(nextSlots.join("").trimEnd());
      return;
    }

    // If multiple digits were typed (e.g. autofill or fast typing)
    if (rawValue.length > 1) {
      const pastedDigits = rawValue.slice(0, 6 - index);
      const nextSlots = [...slots];
      for (let i = 0; i < pastedDigits.length; i++) {
        nextSlots[index + i] = pastedDigits[i];
      }
      const combined = nextSlots.join("");
      onChange(combined);
      const nextFocus = Math.min(index + pastedDigits.length, 5);
      inputsRef.current[nextFocus]?.focus();
      return;
    }

    // Single digit
    const digit = rawValue[rawValue.length - 1];
    const nextSlots = [...slots];
    nextSlots[index] = digit;
    const combined = nextSlots.join("");
    onChange(combined);

    // Auto-advance to next slot
    if (index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Backspace") {
      if (!slots[index] && index > 0) {
        event.preventDefault();
        const nextSlots = [...slots];
        nextSlots[index - 1] = "";
        onChange(nextSlots.join("").trimEnd());
        inputsRef.current[index - 1]?.focus();
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (index < 5) {
        inputsRef.current[index + 1]?.focus();
      }
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (pasted) {
      onChange(pasted);
      const targetIndex = Math.min(pasted.length, 5);
      inputsRef.current[targetIndex]?.focus();
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-2 sm:gap-3"
      role="group"
      aria-label="6-digit verification code"
    >
      {slots.map((char, index) => (
        <input
          key={index}
          ref={(element) => {
            inputsRef.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={1}
          value={char}
          onChange={(event) => handleInputChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of 6`}
          className={`font-mono technical-label h-12 w-11 rounded-xl border text-center text-xl font-bold transition-all sm:h-14 sm:w-12 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 ${
            char
              ? "border-brand-600 bg-brand-50/40 text-brand-900 shadow-sm"
              : "border-line bg-surface text-ink-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20"
          }`}
        />
      ))}
    </div>
  );
};
