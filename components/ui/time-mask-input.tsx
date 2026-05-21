"use client";

import { useState, useEffect } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

/**
 * Custom 24h time input — fully keyboard-controlled, locale-independent.
 * Accepts exactly 4 digits (HHMM), auto-inserts ":" to display "HH:mm".
 * Validates: hours 00–23, minutes 00–59.
 */
export function TimeMaskInput({
  value,
  onChange,
  disabled,
  placeholder = "HH:mm",
  className,
}: Props) {
  // Internal state: 4-digit string e.g. "0930" for "09:30"
  const [digits, setDigits] = useState(() => value ? value.replace(":", "") : "");

  useEffect(() => {
    setDigits(value ? value.replace(":", "") : "");
  }, [value]);

  function toDisplay(d: string): string {
    if (d.length <= 2) return d;
    return d.slice(0, 2) + ":" + d.slice(2);
  }

  function emit(d: string) {
    setDigits(d);
    onChange(d.length === 4 ? toDisplay(d) : "");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const key = e.key;

    // Allow focus-management and clipboard shortcuts
    if (["Tab", "Enter", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) return;
    if (e.ctrlKey || e.metaKey) return;

    e.preventDefault();

    if (key === "Backspace") { emit(digits.slice(0, -1)); return; }
    if (key === "Delete")    { emit(""); return; }

    if (!/^\d$/.test(key) || digits.length >= 4) return;

    const next = digits + key;

    // Reject out-of-range values as each digit is typed
    if (next.length === 1 && parseInt(next) > 2)    return; // hour tens: 0–2
    if (next.length === 2 && parseInt(next) > 23)   return; // hour: 00–23
    if (next.length === 3 && parseInt(next[2]) > 5) return; // minute tens: 0–5
    // 4th digit (minute units) 0–9 is always valid

    emit(next);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const raw = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (raw.length !== 4) return;
    if (parseInt(raw.slice(0, 2)) > 23) return;
    if (parseInt(raw[2]) > 5) return;
    emit(raw);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={toDisplay(digits)}
      onChange={() => {}}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={5}
      className={className}
      aria-label="Giờ 24h (VD: 09:30)"
    />
  );
}
