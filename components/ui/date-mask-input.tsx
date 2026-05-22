"use client";

import { useState, useRef, useEffect } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts;
  if (!y || !m || !d) return "";
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

/**
 * Format from cleaned digits only.
 * Slashes are inserted purely based on digit count — NOT on raw input position.
 * This means Backspace always shortens the digit string naturally,
 * and the slash disappears automatically when the digit count drops below the
 * threshold, eliminating all "jump-back" glitches on both desktop and mobile.
 */
function formatFromDigits(cleaned: string): string {
  const digits = cleaned.slice(0, 8);           // cap at 8 digits (ddmmyyyy)
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Parse dd/mm/yyyy → ISO yyyy-mm-dd with strict validation:
 *   - year 4 digits, 1900–2100
 *   - month 01–12
 *   - day must actually exist in that month (rejects 31/02, etc.)
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

  // Calendar validation: catches invalid combos like 31/02, 29/02 on non-leap
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null;

  return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
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

  const [dateInput, setDateInput] = useState(() => isoToDisplay(initISO));
  const [isoValue, setIsoValue] = useState(initISO);
  const [error, setError] = useState("");

  // Guard: never overwrite the field with external data while the user is typing
  const isFocused = useRef(false);

  // Sync from parent (controlled mode) — only when the field is not active
  useEffect(() => {
    if (value !== undefined && !isFocused.current) {
      setDateInput(isoToDisplay(value));
      setIsoValue(value);
      setError("");
    }
  }, [value]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // 1. Strip everything that isn't a digit — this is the core of the algorithm.
    //    Whether the user typed a digit, deleted a digit, or deleted a slash,
    //    we always reformat from the clean digit string, so there is nothing
    //    to "jump back" to. No cursor-position arithmetic required.
    const cleaned = e.target.value.replace(/\D/g, "");
    const formatted = formatFromDigits(cleaned);

    setDateInput(formatted);
    setError("");

    // Fire onChange only when we have a fully valid date
    const iso = displayToISO(formatted);
    setIsoValue(iso ?? "");
    if (iso) onChange?.(iso);
  }

  function handleFocus() {
    isFocused.current = true;
  }

  function handleBlur() {
    isFocused.current = false;

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
        type="text"
        inputMode="numeric"
        value={dateInput}
        onChange={handleChange}
        onFocus={handleFocus}
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
      {/* Hidden input carries the ISO value for native form submission */}
      {name && <input type="hidden" name={name} value={isoValue} />}
    </>
  );
}
