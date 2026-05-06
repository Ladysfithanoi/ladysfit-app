"use client";

type Props = {
  value:       string;          // dd/mm/yyyy
  onChange:    (v: string) => void;
  className?:  string;
};

function applyMask(input: string): string {
  const digits = input.replace(/\D/g, "");
  let val = digits;
  if (val.length >= 3) val = val.slice(0, 2) + "/" + val.slice(2);
  if (val.length >= 6) val = val.slice(0, 5) + "/" + val.slice(5);
  return val.slice(0, 10);
}

export function todayDMY(): string {
  const d = new Date();
  return (
    String(d.getDate()).padStart(2, "0") + "/" +
    String(d.getMonth() + 1).padStart(2, "0") + "/" +
    d.getFullYear()
  );
}

export function dmyToISO(dmy: string): string | null {
  if (dmy.length !== 10) return null;
  const [dd, mm, yyyy] = dmy.split("/");
  if (!dd || !mm || !yyyy || yyyy.length !== 4) return null;
  return `${yyyy}-${mm}-${dd}`;
}

export function isoToDMY(iso: string | null | undefined): string {
  if (!iso) return todayDMY();
  const d = new Date(iso);
  if (isNaN(d.getTime())) return todayDMY();
  return (
    String(d.getDate()).padStart(2, "0") + "/" +
    String(d.getMonth() + 1).padStart(2, "0") + "/" +
    d.getFullYear()
  );
}

export function DateMaskInput({ value, onChange, className }: Props) {
  return (
    <input
      type="text"
      placeholder="dd/mm/yyyy"
      maxLength={10}
      value={value}
      onChange={e => onChange(applyMask(e.target.value))}
      className={className}
    />
  );
}
