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

/**
 * 00:00 giờ VN ngày 1 của tháng (month 1-based; month = 13 → tháng 1 năm sau).
 *
 * Mốc tháng của lương và buổi dạy phải theo giờ VN, không theo giờ máy chủ:
 * Vercel chạy UTC, nên `new Date(year, month - 1, 1)` ở đó là 07:00 sáng giờ VN —
 * buổi dạy trước 7h sáng ngày 1 bị đếm sang tháng trước, lệch với phiếu check-in
 * (phiếu xếp buổi theo ngày giờ VN).
 */
export function vnMonthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1) - 7 * 3600_000);
}
