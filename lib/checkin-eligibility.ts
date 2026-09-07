// ── Chặn check-in khi lộ trình đã kết thúc ──────────────────────────────────
//
// Buổi tập chỉ được bắt đầu khi khách còn một lộ trình TRỪ ĐƯỢC BUỔI: đang
// ACTIVE, chưa quá hạn và chưa dùng hết số buổi (đúng điều kiện mà
// countPackageSession dùng để trừ buổi). Hết buổi hoặc hết hạn thì PT không
// được cho khách ký check-in nữa — nếu không, buổi tập vẫn chạy nhưng không trừ
// vào lộ trình nào, khách tập "miễn phí" mà PT vẫn được tính buổi dạy.
//
// Logic thuần (không đụng Prisma) để dùng chung: API chặn thật ở server, giao
// diện hồ sơ khách dùng đúng hàm này để khoá nút và hiện lý do.

export type PackageForCheckIn = {
  status: string;
  sessions: number;
  sessionsUsed: number;
  endDate: Date | string | null;
  /** Có thì dùng để chọn lộ trình MỚI NHẤT khi viết lý do từ chối. */
  createdAt?: Date | string | null;
};

export type CheckInBlockReason =
  | "NO_PACKAGE"      // chưa có lộ trình nào, hoặc mọi lộ trình đã đóng
  | "OUT_OF_SESSIONS" // đã tập hết buổi
  | "EXPIRED"         // đã quá hạn
  | "BOTH"            // vừa hết hạn vừa hết buổi
  | "PAUSED"          // lộ trình đang bảo lưu
  | "SESSION_RUNNING"; // đang có buổi tập khác chạy dở

export type CheckInBlock = { reason: CheckInBlockReason; message: string };

function toDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  return v instanceof Date ? v : new Date(v);
}

/** Gói còn trừ được buổi: ACTIVE + còn hạn (endDate null = không đặt hạn) + còn buổi. */
export function isChargeablePackage(p: PackageForCheckIn, now: Date = new Date()): boolean {
  if (p.status !== "ACTIVE") return false;
  const end = toDate(p.endDate);
  if (end != null && end < now) return false;
  return p.sessionsUsed < p.sessions;
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const TAIL = " Vui lòng gia hạn hoặc mua lộ trình mới trước khi bắt đầu buổi tập.";

/**
 * `null` = được phép check-in. Ngược lại trả về lý do + câu thông báo hiển thị
 * thẳng cho PT. Lý do lấy theo lộ trình MỚI NHẤT của khách — đó là gói đang nói
 * tới khi khách hết buổi/hết hạn, các gói cũ đã xong từ lâu không cần nhắc.
 */
export function findCheckInBlock(
  packages: PackageForCheckIn[],
  now: Date = new Date()
): CheckInBlock | null {
  if (packages.some((p) => isChargeablePackage(p, now))) return null;
  if (packages.length === 0) {
    return { reason: "NO_PACKAGE", message: "Không thể check-in: khách chưa có lộ trình nào." + TAIL };
  }

  // Gói mới nhất; không có createdAt thì giữ nguyên thứ tự đầu vào.
  const latest = packages.reduce((best, p) => {
    const a = toDate(p.createdAt)?.getTime();
    const b = toDate(best.createdAt)?.getTime();
    if (a == null || b == null) return best;
    return a > b ? p : best;
  }, packages[0]);

  if (latest.status === "PAUSED") {
    return {
      reason: "PAUSED",
      message:
        "Không thể check-in: lộ trình của khách đang bảo lưu. Hãy mở lại lộ trình trước khi bắt đầu buổi tập.",
    };
  }

  const end = toDate(latest.endDate);
  const outOfSessions = latest.sessionsUsed >= latest.sessions;
  const expired = latest.status === "EXPIRED" || (end != null && end < now);
  const endText = end ? ` ngày ${fmtDate(end)}` : "";

  if (outOfSessions && expired) {
    return {
      reason: "BOTH",
      message:
        `Không thể check-in: lộ trình của khách đã hết buổi (${latest.sessionsUsed}/${latest.sessions}) và hết hạn${endText}.` +
        TAIL,
    };
  }
  if (outOfSessions) {
    return {
      reason: "OUT_OF_SESSIONS",
      message:
        `Không thể check-in: khách đã tập hết ${latest.sessionsUsed}/${latest.sessions} buổi của lộ trình.` +
        TAIL,
    };
  }
  if (expired) {
    return {
      reason: "EXPIRED",
      message: `Không thể check-in: lộ trình của khách đã hết hạn${endText}.` + TAIL,
    };
  }

  // Gói không ACTIVE vì lý do khác (FM đánh dấu kết thúc sớm chẳng hạn).
  return {
    reason: "NO_PACKAGE",
    message: "Không thể check-in: khách không còn lộ trình nào đang chạy." + TAIL,
  };
}

// ── Một khách chỉ có MỘT buổi đang chạy ─────────────────────────────────────
//
// Buổi cũ chưa check-out mà mở buổi mới thì lộ trình bị trừ hai buổi trong khi
// khách chỉ tập một, và buổi bỏ dở kia cứ chạy tới mốc 2 tiếng rồi tự huỷ — PT
// mất buổi dạy mà không hiểu vì sao (xem lib/workout-session).
//
// Câu thông báo viết một lần ở đây rồi dùng chung cho cả API chặn thật lẫn giao
// diện khoá nút, để hai bên không bao giờ nói hai kiểu khác nhau.

/** Buổi chưa đóng: đang tập, hoặc đang chờ khách xác nhận ở luồng cũ. */
export function isRunningLog(log: { status: string }): boolean {
  return log.status === "IN_PROGRESS" || log.status === "AWAITING_CONFIRMATION";
}

/** "08:35" theo giờ Việt Nam. */
function hhmmVN(v: Date | string): string {
  const vn = new Date(new Date(v).getTime() + 7 * 3600_000);
  return `${String(vn.getUTCHours()).padStart(2, "0")}:${String(vn.getUTCMinutes()).padStart(2, "0")}`;
}

export function runningSessionBlock(opts: {
  sessionName?: string | null;
  checkInAt?: Date | string | null;
  ptName?: string | null;
}): CheckInBlock {
  const what = opts.sessionName ? `“${opts.sessionName}”` : "một buổi tập";
  const when = opts.checkInAt ? ` từ ${hhmmVN(opts.checkInAt)}` : "";
  const who  = opts.ptName ? ` (PT ${opts.ptName})` : "";
  return {
    reason: "SESSION_RUNNING",
    message:
      `Khách đang có buổi tập chạy dở: ${what}${when}${who}. ` +
      "Kết thúc buổi đó trước khi bắt đầu buổi mới — hoặc xoá nó nếu lỡ check-in nhầm.",
  };
}
