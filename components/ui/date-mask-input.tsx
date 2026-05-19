"use client";

import { useState, useEffect } from "react";

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts;
  if (!y || !m || !d) return "";
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function applyMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function displayToISO(display: string): string | null {
  const parts = display.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (y.length !== 4 || m.length < 1 || d.length < 1) return null;
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return isNaN(new Date(iso).getTime()) ? null : iso;
}

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
  const [isoState, setISOState] = useState(initISO);
  const [display, setDisplay] = useState(() => isoToDisplay(initISO));
  const [editing, setEditing] = useState(false);

  // Sync from parent in controlled mode
  useEffect(() => {
    if (value !== undefined && !editing) {
      setISOState(value);
      setDisplay(isoToDisplay(value));
    }
  }, [value, editing]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = applyMask(e.target.value);
    setDisplay(masked);
    const iso = displayToISO(masked);
    if (iso) {
      setISOState(iso);
      onChange?.(iso);
    }
  }

  function handleBlur() {
    setEditing(false);
    // Reset display to last valid state on blur
    setDisplay(isoToDisplay(isoState));
  }

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onFocus={() => setEditing(true)}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={10}
        required={required}
        className={className}
      />
      {/* Hidden input for uncontrolled form submission — holds ISO value */}
      {name && <input type="hidden" name={name} value={isoState} />}
    </>
  );
}
