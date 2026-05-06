export function fmtDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return (
    String(d.getDate()).padStart(2, "0") + "/" +
    String(d.getMonth() + 1).padStart(2, "0") + "/" +
    d.getFullYear()
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
