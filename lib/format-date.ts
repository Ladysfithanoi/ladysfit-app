export function fmtDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  if (typeof date === "string") {
    // Parse the date-only part directly (YYYY-MM-DD) to avoid timezone offset
    const datePart = date.split("T")[0];
    const parts = datePart.split("-");
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const [y, m, d] = parts;
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    }
    return "—";
  }
  if (isNaN(date.getTime())) return "—";
  return (
    String(date.getDate()).padStart(2, "0") + "/" +
    String(date.getMonth() + 1).padStart(2, "0") + "/" +
    date.getFullYear()
  );
}

export function fmtDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return (
    String(d.getDate()).padStart(2, "0") + "/" +
    String(d.getMonth() + 1).padStart(2, "0") + "/" +
    d.getFullYear() + " " +
    String(d.getHours()).padStart(2, "0") + ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
}
