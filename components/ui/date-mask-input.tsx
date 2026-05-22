"use client";

import { useState, useRef, useLayoutEffect } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts;
  if (!y || !m || !d) return "";
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

/** Strip non-digits, cap at 8 digits, then re-insert slashes. */
function applyMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Parse dd/mm/yyyy → ISO yyyy-mm-dd.
 * Returns null for any invalid or out-of-range date.
 * Year must be 4 digits, 1900–2100; month 1–12; day must exist in that month.
 */
function displayToISO(display: string): string | null {
  if (display.length !== 10) return null;
  const parts = display.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (d.length !== 2 || m.length !== 2 || y.length !== 4) return null;

  const day = parseInt(d, 10);
  const month = parseInt(m, 10);
  const year = parseInt(y, 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Strict calendar validation (e.g. 31/02 is rejected)
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null;

  return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * Given the masked string and the number of digits that were before the
 * cursor in the raw (pre-mask) value, compute where the cursor should
 * land in the masked string — jumping over any auto-inserted slash.
 */
function computeCursorPos(masked: string, digitsBeforeCursor: number): number {
  if (digitsBeforeCursor === 0) return 0;
  let digitsSeen = 0;
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] !== "/") {
      digitsSeen++;
      if (digitsSeen === digitsBeforeCursor) {
        const next = i + 1;
        // Skip over an auto-inserted slash so cursor lands after it
        return masked[next] === "/" ? next + 1 : next;
      }
    }
  }
  return masked.length;
}

// ─── component ──────────────────────────────────────────────────────────────

type Props = {
  // Controlled mode
  value?: string;
  onChange?: (iso: string) => void;
  // Uncontrolled (form-native) mode
  defaultValue?: string;
  name?: string;
  required?: boolean;
  // Common
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

export function DateMaskInput({
  value,
  onChange,
  defaultValue,
  name,
  required = false,
  disabled = false,
  className,
  placeholder = "dd/mm/yyyy",
}: Props) {
  const initISO = value ?? defaultValue ?? "";

  // Single source of truth: the raw display string the user sees
  const [dateInput, setDateInput] = useState(() => isoToDisplay(initISO));
  // ISO value sent to the server via hidden input / onChange callback
  const [isoValue, setIsoValue] = useState(initISO);
  // Inline error shown on blur
  const [error, setError] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  // Desired cursor position set during onChange, consumed by useLayoutEffect
  const nextCursor = useRef<number | null>(null);

  // ── Sync from parent (controlled mode) ────────────────────────────────────
  // Using a ref-comparison avoids an effect-cycle while staying safe.
  const prevValueRef = useRef<string | undefined>(value);
  if (value !== undefined && value !== prevValueRef.current) {
    prevValueRef.current = value;
    setDateInput(isoToDisplay(value));
    setIsoValue(value);
    setError("");
  }

  // ── Cursor restoration ────────────────────────────────────────────────────
  // useLayoutEffect fires synchronously after DOM mutations, before paint,
  // so the cursor is placed before the user sees any flicker.
  useLayoutEffect(() => {
    if (
      nextCursor.current !== null &&
      inputRef.current &&
      document.activeElement === inputRef.current
    ) {
      const pos = nextCursor.current;
      inputRef.current.setSelectionRange(pos, pos);
      nextCursor.current = null;
    }
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // selectionStart reflects cursor position AFTER the browser applied the keystroke
    const cursorBefore = e.target.selectionStart ?? raw.length;

    // How many digit characters were to the left of the cursor in the raw string?
    const digitsBeforeCursor = raw.slice(0, cursorBefore).replace(/\D/g, "").length;

    const masked = applyMask(raw);

    // Schedule cursor restoration (runs in useLayoutEffect after re-render)
    nextCursor.current = computeCursorPos(masked, digitsBeforeCursor);

    setDateInput(masked);
    setError("");

    const iso = displayToISO(masked);
    setIsoValue(iso ?? "");
    if (iso) onChange?.(iso);
  }

  function handleBlur() {
    if (!dateInput) {
      setError("");
      setIsoValue("");
      return;
    }
    if (dateInput.length < 10) {
      setError("Ngày chưa đầy đủ — vui lòng nhập đúng định dạng dd/mm/yyyy");
      setIsoValue("");
      return;
    }
    const iso = displayToISO(dateInput);
    if (!iso) {
      setError("Ngày không hợp lệ (tháng phải từ 01–12, ngày phải đúng với tháng)");
      setIsoValue("");
    } else {
      setError("");
      setIsoValue(iso);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={dateInput}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={10}
        required={required}
        className={className}
        autoComplete="off"
      />
      {error && (
        <p className="text-xs text-red-500 mt-1 font-medium">{error}</p>
      )}
      {/* Hidden input carries the ISO date value for native form submission */}
      {name && <input type="hidden" name={name} value={isoValue} />}
    </>
  );
}
