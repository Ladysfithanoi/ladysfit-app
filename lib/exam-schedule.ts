// ── Lịch thi thăng cấp ───────────────────────────────────────────────────────
// Admin bật/tắt kỳ thi và đặt ngày thi. Tắt => không ai vào thi được.
// Bật => chỉ mở đúng ngày đã đặt, trong khung giờ; trước và sau đều khoá.
// Ngày/giờ lưu theo giờ VN (UTC+7) dạng chuỗi nên không phụ thuộc múi giờ server.

export type ExamSchedule = {
  scheduleEnabled: boolean;
  examDate: string | null; // "YYYY-MM-DD" theo giờ VN
  examStartTime: string; // "HH:mm"
  examEndTime: string; // "HH:mm"
};

export type ExamWindowState =
  | "DISABLED" // lịch thi đang tắt
  | "NOT_SCHEDULED" // đã bật nhưng chưa đặt ngày
  | "BEFORE" // chưa tới ngày/giờ thi
  | "OPEN" // đang trong giờ thi
  | "AFTER"; // đã qua giờ thi

export type ExamWindow = {
  state: ExamWindowState;
  open: boolean;
  /** Mốc bắt đầu / kết thúc (UTC instant), null khi chưa đặt lịch. */
  startAt: Date | null;
  endAt: Date | null;
  /** Thông báo hiển thị cho PT khi không vào thi được. */
  message: string;
};

/** Cho phép nộp bài trễ tối đa 15 phút để PT đang làm dở không bị mất bài. */
export const SUBMIT_GRACE_MS = 15 * 60 * 1000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidExamDate(v: unknown): v is string {
  return typeof v === "string" && DATE_RE.test(v) && !isNaN(Date.parse(`${v}T00:00:00.000+07:00`));
}

export function isValidExamTime(v: unknown): v is string {
  return typeof v === "string" && TIME_RE.test(v);
}

/** Mốc thời gian tuyệt đối ứng với "ngày + giờ" theo giờ VN. */
export function vnInstant(date: string, time: string, endOfMinute = false): Date {
  const secs = endOfMinute ? "59.999" : "00.000";
  return new Date(`${date}T${time}:${secs}+07:00`);
}

/** "YYYY-MM-DD" của hôm nay theo giờ VN — dùng làm giá trị mặc định trên form. */
export function todayVN(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** dd/mm/yyyy từ chuỗi "YYYY-MM-DD" (không qua Date để khỏi lệch múi giờ). */
export function fmtExamDate(date: string | null | undefined): string {
  if (!date || !DATE_RE.test(date)) return "—";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export function getExamWindow(schedule: ExamSchedule, now: Date = new Date()): ExamWindow {
  const startTime = isValidExamTime(schedule.examStartTime) ? schedule.examStartTime : "00:00";
  const endTime = isValidExamTime(schedule.examEndTime) ? schedule.examEndTime : "23:59";

  if (!schedule.scheduleEnabled) {
    return {
      state: "DISABLED",
      open: false,
      startAt: null,
      endAt: null,
      message: "Kỳ thi đang đóng. Vui lòng chờ quản lý mở lịch thi.",
    };
  }

  if (!isValidExamDate(schedule.examDate)) {
    return {
      state: "NOT_SCHEDULED",
      open: false,
      startAt: null,
      endAt: null,
      message: "Chưa có lịch thi. Vui lòng chờ quản lý đặt ngày thi.",
    };
  }

  const startAt = vnInstant(schedule.examDate, startTime);
  const endAt = vnInstant(schedule.examDate, endTime, true);
  const dateLabel = fmtExamDate(schedule.examDate);

  if (now.getTime() < startAt.getTime()) {
    return {
      state: "BEFORE",
      open: false,
      startAt,
      endAt,
      message: `Chưa tới giờ thi. Kỳ thi mở ngày ${dateLabel} lúc ${startTime}.`,
    };
  }

  if (now.getTime() > endAt.getTime()) {
    return {
      state: "AFTER",
      open: false,
      startAt,
      endAt,
      message: `Kỳ thi ngày ${dateLabel} đã kết thúc lúc ${endTime}. Bạn không thể vào thi nữa.`,
    };
  }

  return {
    state: "OPEN",
    open: true,
    startAt,
    endAt,
    message: `Kỳ thi đang mở, kết thúc lúc ${endTime} ngày ${dateLabel}.`,
  };
}
