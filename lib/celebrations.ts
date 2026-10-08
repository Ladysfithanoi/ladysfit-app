import { vnWallClock } from "@/lib/format-date";

/**
 * NGÀY ĐẶC BIỆT CỦA NHÂN SỰ — MỘT CHỖ quyết định hôm nay ai được chúc gì.
 *
 *   • Sinh nhật: theo Ngày sinh trong hồ sơ nhân sự (sinh 29/2 thì năm thường
 *     chúc vào 28/2).
 *   • Ngày của phụ nữ: chỉ nhân sự có Giới tính = Nữ. Thêm ngày mới thì thêm vào
 *     WOMEN_DAYS, không viết điều kiện ở chỗ khác.
 *
 * Ngày tính theo giờ VN (máy chủ chạy UTC — xem vn-month-boundary).
 */

export type Gender = "MALE" | "FEMALE";

export const GENDER_LABEL: Record<Gender, string> = { FEMALE: "Nữ", MALE: "Nam" };

/** Giá trị form gửi lên → giá trị lưu DB. Không hợp lệ / bỏ trống = chưa khai. */
export function parseGender(v: unknown): Gender | null {
  return v === "MALE" || v === "FEMALE" ? v : null;
}

/** Các ngày chúc mừng riêng cho nhân sự nữ — tháng tính từ 1. */
export const WOMEN_DAYS: { day: number; month: number; title: string; message: string }[] = [
  {
    day: 8, month: 3,
    title: "Chúc mừng ngày Quốc tế Phụ nữ 8/3",
    message:
      "Cảm ơn bạn vì đã mang năng lượng, sự tận tâm và nụ cười đến Ladysfit mỗi ngày. " +
      "Chúc bạn luôn xinh đẹp, khoẻ mạnh, hạnh phúc và được yêu thương thật nhiều!",
  },
  {
    day: 20, month: 10,
    title: "Chúc mừng ngày Phụ nữ Việt Nam 20/10",
    message:
      "Chúc bạn một ngày 20/10 thật rạng rỡ — luôn tự tin, khoẻ đẹp và thành công " +
      "trên hành trình truyền cảm hứng cho các chị em. Ladysfit tự hào vì có bạn!",
  },
];

export type Celebration = {
  kind:    "birthday" | "women";
  /** Khoá duy nhất cho dịp này trong năm — để popup chỉ hiện một lần mỗi ngày. */
  key:     string;
  title:   string;
  message: string;
};

function isLeap(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Các dịp cần chúc của một nhân sự vào ngày `now` (giờ VN). */
export function celebrationsFor(
  user: { name: string | null; gender: Gender | null; dateOfBirth: Date | null },
  now: Date = new Date(),
): Celebration[] {
  const today = vnWallClock(now);
  const day   = today.getUTCDate();
  const month = today.getUTCMonth() + 1;
  const year  = today.getUTCFullYear();
  const firstName = (user.name ?? "").trim().split(/\s+/).pop() || "bạn";
  const out: Celebration[] = [];

  if (user.dateOfBirth) {
    // Ngày sinh lưu 00:00 UTC (form) hoặc 00:00 giờ VN (dữ liệu cũ) — đọc theo
    // giờ VN thì cả hai đều ra đúng ngày.
    const dob = vnWallClock(user.dateOfBirth);
    let bDay = dob.getUTCDate();
    const bMonth = dob.getUTCMonth() + 1;
    if (bMonth === 2 && bDay === 29 && !isLeap(year)) bDay = 28;
    if (bDay === day && bMonth === month) {
      out.push({
        kind: "birthday",
        key: `birthday-${year}`,
        title: `Chúc mừng sinh nhật ${firstName}!`,
        message:
          "Cả đại gia đình Ladysfit chúc bạn tuổi mới thật nhiều sức khoẻ, niềm vui và thành công. " +
          "Cảm ơn bạn đã luôn đồng hành và truyền lửa cho khách hàng mỗi ngày!",
      });
    }
  }

  if (user.gender === "FEMALE") {
    for (const d of WOMEN_DAYS) {
      if (d.day === day && d.month === month) {
        out.push({ kind: "women", key: `women-${d.month}-${d.day}-${year}`, title: d.title, message: d.message });
      }
    }
  }

  return out;
}
