"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

// Strip non-digits, keep max 4, auto-insert ":" → "HH:mm"
function applyMask(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidTime(val: string): boolean {
  const m = val.match(/^(\d{2}):(\d{2})$/);
  if (!m) return false;
  return parseInt(m[1]) <= 23 && parseInt(m[2]) <= 59;
}

/**
 * Locale-independent 24h time input.
 * Uses onChange + regex mask — user types freely, colon is auto-inserted.
 * Shows red border when the typed value is out of 24h range.
 */
export function TimeMaskInput({
  value,
  onChange,
  disabled,
  placeholder = "HH:mm",
  className,
}: Props) {
  const [display, setDisplay] = useState(value || "");
  const [hasError, setHasError] = useState(false);

  // Sync from parent when value changes externally
  useEffect(() => {
    setDisplay(value || "");
    setHasError(false);
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = applyMask(e.target.value);
    setDisplay(masked);

    if (masked.length === 5) {
      // Complete HH:mm — validate and emit
      const valid = isValidTime(masked);
      setHasError(!valid);
      if (valid) onChange(masked);
    } else {
      setHasError(false);
      if (masked.length === 0) onChange("");
    }
  }

  function handleBlur() {
    if (!display) {
      setHasError(false);
      return;
    }
    const valid = display.length === 5 && isValidTime(display);
    if (!valid) {
      // Incomplete input on blur → clear silently
      setDisplay("");
      setHasError(false);
      onChange("");
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={5}
      className={cn(
        className,
        hasError && "!border-red-400 focus:!ring-red-300"
      )}
      aria-label="Giờ 24h (VD: 09:30)"
    />
  );
}
