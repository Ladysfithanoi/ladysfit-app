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

/**
 * isChargeablePackage viết bằng SQL — cho các truy vấn thô (bảng lương, file
 * Excel) cần lọc ngay trong câu lệnh thay vì kéo cả bảng về lọc lại ở JS.
 *
 * PHẢI nằm cạnh isChargeablePackage và khớp từng vế với nó: đây là MỘT luật
 * "lộ trình còn chạy", viết hai thứ tiếng, không phải hai luật.
 *
 * Vì sao phải tính sống thay vì đọc cờ trạng thái: bảng lương trước đây lọc thô
 * `status = 'ACTIVE'`, tức là tin vào cờ do lưới quét đêm (closeFinishedPackages)
 * đặt. Lưới quét lỡ một đêm — hoặc không chạy — là gói đã hết hạn/hết buổi vẫn
 * kẹt ở ACTIVE và tiếp tục hiện trong phiếu lương như khách đang tập. Thực tế
 * production có gói quá hạn 273 ngày mà cờ vẫn ACTIVE. Tính tại thời điểm đọc
 * thì phiếu lương đúng ngay cả khi lưới quét chưa kịp đóng gói.
 *
 * endDate NULL = không đặt hạn → vẫn còn hiệu lực, đúng như bản JS.
 */
export function chargeablePackageSql(alias = "pe"): string {
  return `(
    ${alias}.status = 'ACTIVE'
    AND (${alias}."endDate" IS NULL OR ${alias}."endDate" >= NOW())
    AND ${alias}."sessionsUsed" < ${alias}.sessions
  )`;
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

// ── Một buổi đang chạy thì không mở được buổi thứ hai ───────────────────────
//
// Hai luật, cùng một lý do nên viết chung một chỗ:
//   • MỘT KHÁCH chỉ có một buổi chạy dở. Buổi cũ chưa check-out mà mở buổi mới
//     thì lộ trình bị trừ hai buổi trong khi khách chỉ tập một, và buổi bỏ dở
//     kia cứ chạy tới mốc 2 tiếng rồi tự huỷ — PT mất buổi dạy mà không hiểu vì
//     sao (xem lib/workout-session).
//   • MỘT NGƯỜI DẠY chỉ mở được một nhật ký. Không ai dạy hai khách cùng lúc
//     được, nên hai buổi cùng chạy dưới một tài khoản nghĩa là có buổi được ký
//     khống — đúng thứ mà cặp chữ ký check-in/check-out sinh ra để chặn.
//
// Câu thông báo viết một lần ở đây rồi dùng chung cho cả API chặn thật lẫn giao
// diện khoá nút, để hai bên không bao giờ nói hai kiểu khác nhau.

/**
 * Mốc 2 tiếng: quá đây mà chưa check-out thì buổi coi như bỏ dở, không còn xin
 * được chữ ký check-out hợp lệ nữa.
 *
 * Sống ở đây — module thuần, không đụng Prisma — để cả ba phía dùng CHUNG một
 * con số: lưới quét tự huỷ (lib/workout-session), luật chặn check-in, và đồng
 * hồ đếm ngược trong nhật ký tập. Trước đây mỗi chỗ giữ một bản.
 */
export const MAX_SESSION_MINUTES = 120;

/** Trạng thái của một buổi chưa đóng: đang tập, hoặc chờ khách xác nhận (luồng cũ). */
export const RUNNING_LOG_STATUSES = ["IN_PROGRESS", "AWAITING_CONFIRMATION"] as const;

/**
 * Buổi ĐANG chạy thật: chưa đóng VÀ chưa quá mốc 2 tiếng.
 *
 * Vế thứ hai là bắt buộc, không phải cho đẹp. Thiếu nó thì một bản ghi cũ —
 * chẳng hạn AWAITING_CONFIRMATION còn sót từ luồng "khách xác nhận trên app"
 * đã bỏ — vĩnh viễn bị coi là đang chạy, khoá người dạy ở MỌI khách và không có
 * cách nào tự hết. Lưới quét dùng đúng mốc này nên hai bên không thể lệch nhau.
 */
export function isRunningLog(
  log: { status: string; checkInAt?: Date | string | null },
  now: Date = new Date()
): boolean {
  if (!(RUNNING_LOG_STATUSES as readonly string[]).includes(log.status)) return false;
  const at = toDate(log.checkInAt);
  if (at == null) return false; // buổi chưa có giờ check-in thì không thể đang chạy
  return now.getTime() - at.getTime() < MAX_SESSION_MINUTES * 60_000;
}

/** Giờ Việt Nam của một mốc thời gian, dạng [giờ, ngày] để ghép câu. */
function partsVN(v: Date | string): { hhmm: string; ymd: string; dmy: string } {
  const vn = new Date(new Date(v).getTime() + 7 * 3600_000);
  const p2 = (n: number) => String(n).padStart(2, "0");
  return {
    hhmm: `${p2(vn.getUTCHours())}:${p2(vn.getUTCMinutes())}`,
    ymd: `${vn.getUTCFullYear()}-${p2(vn.getUTCMonth() + 1)}-${p2(vn.getUTCDate())}`,
    dmy: `${p2(vn.getUTCDate())}/${p2(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()}`,
  };
}

/**
 * "08:35" nếu là hôm nay, "09:48 ngày 05/06/2026" nếu không.
 *
 * Bỏ ngày đi thì một buổi sót từ tháng trước hiện ra thành "từ 09:48" — đọc lúc
 * 9h30 sáng nó giống một giờ ở TƯƠNG LAI, và PT không tài nào đoán được chuyện
 * gì đang xảy ra. Có ngày là nhìn phát biết ngay bản ghi cũ.
 */
function whenVN(v: Date | string, now: Date = new Date()): string {
  const at = partsVN(v);
  return at.ymd === partsVN(now).ymd ? at.hhmm : `${at.hhmm} ngày ${at.dmy}`;
}

export function runningSessionBlock(opts: {
  sessionName?: string | null;
  checkInAt?: Date | string | null;
  ptName?: string | null;
  /** Có tên khách = buổi dở nằm ở KHÁCH KHÁC, do chính người đang thao tác mở.
   *  Khi đó câu thông báo nói với người dạy, chứ không nói về khách đang mở hồ sơ. */
  clientName?: string | null;
}): CheckInBlock {
  const what = opts.sessionName ? `“${opts.sessionName}”` : "một buổi tập";
  const when = opts.checkInAt ? ` từ ${whenVN(opts.checkInAt)}` : "";
  if (opts.clientName) {
    return {
      reason: "SESSION_RUNNING",
      message:
        `Bạn đang có buổi tập chạy dở với khách ${opts.clientName}: ${what}${when}. ` +
        "Mỗi người chỉ mở được một nhật ký tập luyện một lúc — kết thúc buổi đó trước, " +
        "hoặc xoá nó nếu lỡ check-in nhầm.",
    };
  }
  const who = opts.ptName ? ` (PT ${opts.ptName})` : "";
  return {
    reason: "SESSION_RUNNING",
    message:
      `Khách đang có buổi tập chạy dở: ${what}${when}${who}. ` +
      "Kết thúc buổi đó trước khi bắt đầu buổi mới — hoặc xoá nó nếu lỡ check-in nhầm.",
  };
}
