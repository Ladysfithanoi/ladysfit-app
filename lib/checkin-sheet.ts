// ── Phiếu check-in: phần sửa tay ────────────────────────────────────────────
//
// Phiếu check-in là bản số của phụ lục hợp đồng ký tay, dựng từ workout_logs.
// Khách tập từ TRƯỚC khi có app thì trong máy chỉ còn những buổi ghi sau ngày
// app ra đời — trên giấy khách đã hết buổi, mà phiếu in ra trống hơn một nửa.
// Lớp phủ này để FM/PT điền tay những buổi cũ và sửa lại các ô ghi sai.
//
// LỚP PHỦ, KHÔNG PHẢI SỬA GỐC. Không ô nào ở đây ghi ngược vào workout_logs hay
// package_enrollments. Buổi ghi tay không có nhật ký tập, không chữ ký, không
// ảnh — không phải buổi dạy hợp lệ, nên không được chạm vào "Số buổi PT" (xem
// lib/pt-session-count) lẫn hạn lộ trình (xem lib/package-status). Muốn sửa số
// buổi TÍNH LƯƠNG thì vẫn đi đúng một đường cũ: PTSessionAdjustment ở hồ sơ
// khách.
//
// CHỮ KÝ và ẢNH CHECK-OUT không sửa được, kể cả khi tính năng đang bật — hai
// thứ đó là bằng chứng buổi tập có thật, cho sửa là mở đúng cánh cửa mà cặp
// chữ ký/ảnh sinh ra để đóng. Vì vậy buổi ghi tay luôn hiện với ô chữ ký và ô
// ảnh để trống, nhìn là phân biệt được với buổi app ghi.
//
// Module thuần, không đụng Prisma: API dựng phiếu và trình sửa trên màn hình
// dùng CHUNG một bộ luật ở đây, nên hai bên không thể hiểu khác nhau về cùng
// một tờ phiếu.

// ── Một tờ 50 ô, gói dài thì nhiều tờ ───────────────────────────────────────
//
// Bản in sẵn của phụ lục có ĐÚNG 50 ô — 2 khối × 25 dòng. Gói dài hơn thì ký
// nhiều tờ, đó là lý do tiêu đề vốn ghi "PHỤ LỤC HỢP ĐỒNG SỐ 01". Phần lớn gói
// đang bán vượt trần này (L2 60 buổi, L5 72, L4 100), nên một tờ là không đủ:
// trước đây buổi thứ 51 trở đi bị cắt lặng lẽ khỏi phiếu.
//
// Số tờ đếm theo TỔNG SỐ BUỔI CỦA GÓI, không theo số buổi đã tập: phiếu in dòng
// "TỔNG SỐ BUỔI TẬP: 100 buổi" thì phải có đủ 100 ô để ký, y như phát đủ 2 tờ
// giấy ngay từ đầu. Tờ cuối còn ô trống là chuyện bình thường của tờ đang ký dở.
//
// Mỗi tờ tự đứng được một mình: đủ tiêu đề, khối thông tin hội viên và ba ô chữ
// ký — vì trên giấy mỗi tờ là một tờ ký riêng.

/** Số ô của MỘT tờ: 2 khối × 25 dòng. */
export const ROWS_PER_SHEET = 50;

/** Trần cứng, chặn số buổi gõ nhầm biến phiếu thành mấy trăm tờ. */
export const MAX_SHEET_PAGES = 10;

/** Số tờ cần cho một gói. Luôn ít nhất một tờ, kể cả gói 0 buổi. */
export function sheetPageCount(totalSessions: number): number {
  const n = Number.isFinite(totalSessions) ? Math.ceil(totalSessions / ROWS_PER_SHEET) : 1;
  return Math.max(1, Math.min(MAX_SHEET_PAGES, n));
}

/** Tổng số ô của cả bộ phiếu. */
export function sheetCapacity(totalSessions: number): number {
  return sheetPageCount(totalSessions) * ROWS_PER_SHEET;
}

/** Trần tuyệt đối của một bộ phiếu — dùng khi chưa biết gói bao nhiêu buổi. */
export const MAX_SHEET_ROWS = MAX_SHEET_PAGES * ROWS_PER_SHEET;

/** Ngưỡng cân nặng người thật — chặn số gõ nhầm, cùng mốc với ô cân check-in. */
const WEIGHT_MIN = 20;
const WEIGHT_MAX = 300;

const MAX_NAME_LEN = 120;

// ── Hình dạng dữ liệu ───────────────────────────────────────────────────────

/** Các ô tiêu đề sửa tay được. Khoá vắng mặt = giữ nguyên số gốc của lộ trình. */
export type SheetHeaderOverride = {
  contractCode?: string;
  clientName?:   string;
  ptName?:       string;
  fmName?:       string;
  totalSessions?: number;
  /** ISO hoặc null để xoá trắng ô. */
  startDate?: string | null;
  endDate?:   string | null;
  price?:     number;
};

/** Sửa tay một buổi CÓ THẬT (app đã ghi). Khoá ngoài = workoutLogId. */
export type SheetRowOverride = {
  /** ISO — ngày cung cấp dịch vụ. */
  date?: string;
  /** ISO — mốc lấy ra cột "Thời gian"; null = để trống ô giờ. */
  checkOutAt?: string | null;
  /** null = bỏ số cân sửa tay, quay về số lấy từ nhật ký cân nặng. */
  weight?: number | null;
};

/** Buổi GHI TAY — buổi tập trước khi có app. Không chữ ký, không ảnh. */
export type SheetExtraRow = {
  /** Khoá do trình sửa sinh, để sửa/xoá đúng dòng qua nhiều lần lưu. */
  id: string;
  /** ISO. Bắt buộc: đây là thứ duy nhất xếp được dòng vào đúng thứ tự. */
  date: string;
  checkOutAt: string | null;
  weight: number | null;
  /** Tên HLV dạy buổi đó, FM tự điền. Buổi cũ thường không còn ai nhớ nên để rỗng được. */
  ptName?: string;
};

export type SheetOverride = {
  header:    SheetHeaderOverride;
  rows:      Record<string, SheetRowOverride>;
  extraRows: SheetExtraRow[];
};

export const EMPTY_OVERRIDE: SheetOverride = { header: {}, rows: {}, extraRows: [] };

// ── Đọc / làm sạch ──────────────────────────────────────────────────────────

function isIso(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && !Number.isNaN(new Date(v).getTime());
}

function cleanName(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().slice(0, MAX_NAME_LEN);
  return s.length > 0 ? s : "";
}

function cleanWeight(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  if (v < WEIGHT_MIN || v > WEIGHT_MAX) return undefined;
  return Math.round(v * 10) / 10;
}

/**
 * Làm sạch dữ liệu gửi lên trước khi lưu.
 *
 * Bỏ QUA ô sai thay vì báo lỗi cả lần lưu: người dùng đang điền một bảng 50
 * dòng, vứt cả bảng đi vì một ô gõ nhầm là cách chắc chắn làm mất công họ vừa
 * nhập. Ô hỏng đơn giản không được ghi, các ô còn lại vẫn vào.
 */
export function sanitizeOverride(input: unknown): SheetOverride {
  const src = (input ?? {}) as Partial<Record<keyof SheetOverride, unknown>>;
  const out: SheetOverride = { header: {}, rows: {}, extraRows: [] };

  // Tiêu đề
  const h = (src.header ?? {}) as Record<string, unknown>;
  for (const key of ["contractCode", "clientName", "ptName", "fmName"] as const) {
    const s = cleanName(h[key]);
    if (s !== undefined) out.header[key] = s;
  }
  if (typeof h.totalSessions === "number" && Number.isFinite(h.totalSessions)) {
    out.header.totalSessions = Math.max(0, Math.min(500, Math.round(h.totalSessions)));
  }
  if (typeof h.price === "number" && Number.isFinite(h.price) && h.price >= 0) {
    out.header.price = Math.round(h.price);
  }
  for (const key of ["startDate", "endDate"] as const) {
    if (h[key] === null) out.header[key] = null;
    else if (isIso(h[key])) out.header[key] = new Date(h[key] as string).toISOString();
  }

  // Buổi có thật
  const rows = (src.rows ?? {}) as Record<string, unknown>;
  for (const [logId, raw] of Object.entries(rows)) {
    if (typeof logId !== "string" || logId.length === 0 || logId.length > 64) continue;
    const r = (raw ?? {}) as Record<string, unknown>;
    const one: SheetRowOverride = {};
    if (isIso(r.date)) one.date = new Date(r.date as string).toISOString();
    if (r.checkOutAt === null) one.checkOutAt = null;
    else if (isIso(r.checkOutAt)) one.checkOutAt = new Date(r.checkOutAt as string).toISOString();
    const w = cleanWeight(r.weight);
    if (w !== undefined) one.weight = w;
    if (Object.keys(one).length > 0) out.rows[logId] = one;
  }

  // Buổi ghi tay — không ngày thì không xếp được vào phiếu, bỏ.
  const extras = Array.isArray(src.extraRows) ? src.extraRows : [];
  const seen = new Set<string>();
  for (const raw of extras) {
    const r = (raw ?? {}) as Record<string, unknown>;
    if (!isIso(r.date)) continue;
    const id = typeof r.id === "string" && r.id.length > 0 && r.id.length <= 64 ? r.id : null;
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    const w = cleanWeight(r.weight);
    out.extraRows.push({
      id,
      date: new Date(r.date as string).toISOString(),
      checkOutAt: isIso(r.checkOutAt) ? new Date(r.checkOutAt as string).toISOString() : null,
      weight: w === undefined ? null : w,
      ptName: cleanName(r.ptName) ?? "",
    });
    if (out.extraRows.length >= MAX_SHEET_ROWS) break;
  }

  return out;
}

/** Đọc lại ba cột JSON đã lưu. Bản ghi hỏng thì coi như chưa sửa gì. */
export function parseOverride(stored: {
  header: string | null;
  rows: string | null;
  extraRows: string | null;
} | null): SheetOverride {
  if (!stored) return EMPTY_OVERRIDE;
  const read = (s: string | null): unknown => {
    if (!s) return undefined;
    try { return JSON.parse(s); } catch { return undefined; }
  };
  return sanitizeOverride({
    header:    read(stored.header),
    rows:      read(stored.rows),
    extraRows: read(stored.extraRows),
  });
}

export function hasAnyEdit(o: SheetOverride): boolean {
  return Object.keys(o.header).length > 0
      || Object.keys(o.rows).length > 0
      || o.extraRows.length > 0;
}

// ── Ngày giờ đúng như phiếu in ra ───────────────────────────────────────────
//
// Cả cột "Ngày" lẫn cột "Giờ vào" đều đọc theo GIỜ VIỆT NAM. Các hàm dưới đây là
// cách DUY NHẤT hai bên đọc và ghi hai cột đó, nên ô người dùng gõ vào trình sửa
// in ra đúng bằng ô họ vừa gõ — chứ không lệch một ngày hay bảy tiếng vì mỗi nơi
// tự quy đổi một kiểu.
//
// Ngày phải quy ra giờ VN chứ không cắt thẳng chuỗi ISO (vốn là giờ UTC): buổi
// tập 6h sáng — 158 buổi trên hệ thống — có mốc UTC rơi vào HÔM TRƯỚC, cắt chuỗi
// là phiếu in lùi một ngày, và mọi phép xếp theo ngày cũng lệch theo.

const VN_OFFSET_MS = 7 * 3600_000;

/** Ngày (YYYY-MM-DD) theo giờ VN, đúng như cột "Ngày" của phiếu. */
export function sheetDay(iso: string): string {
  return new Date(new Date(iso).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** "08:35" theo giờ VN. Chuỗi rỗng khi không có mốc giờ. */
export function sheetTime(iso: string | null): string {
  if (!iso) return "";
  const vn = new Date(new Date(iso).getTime() + VN_OFFSET_MS);
  return `${String(vn.getUTCHours()).padStart(2, "0")}:${String(vn.getUTCMinutes()).padStart(2, "0")}`;
}

/** Ô ngày của trình sửa (YYYY-MM-DD) → mốc ISO cho cột "Ngày": 00:00 giờ VN. */
export function isoFromSheetDay(day: string): string | null {
  return isoFromSheetTime(day, "00:00");
}

/** Ô ngày + ô giờ VN của trình sửa → mốc ISO cho cột "Thời gian". */
export function isoFromSheetTime(day: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const t = Date.UTC(y, m - 1, d, hh, mm) - VN_OFFSET_MS;
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * Mốc này chỉ ghi NGÀY, không ghi giờ?
 *
 * Ngày của một buổi app ghi chính là lúc khách ký check-in, nên nó luôn mang giờ
 * phút giây thật. Còn ô ngày của trình sửa (isoFromSheetDay) dựng ra đúng nửa
 * đêm giờ VN — một mốc "chỉ có ngày". Phân biệt bằng chính con số đó: một lần
 * check-in thật rơi trúng 00:00:00.000 tới từng mili giây là chuyện không xảy ra.
 *
 * Vế thứ hai nhận ra những dòng ghi tay LƯU TỪ TRƯỚC, hồi ô ngày còn dựng ra nửa
 * đêm UTC. Bỏ vế đó đi thì các dòng cũ ấy bỗng in thêm giờ vào "07:00" — một con
 * số không ai từng nhập.
 *
 * Dùng để biết có in được GIỜ BẮT ĐẦU lên phiếu hay không: buổi ghi tay mà FM
 * chưa điền giờ vào thì in giờ là bịa ra một con số không ai cung cấp.
 */
export function isBareDay(iso: string): boolean {
  return iso === isoFromSheetTime(sheetDay(iso), "00:00")
      || iso.endsWith("T00:00:00.000Z");
}

/**
 * Hai ô "ngày" + "giờ vào" của trình sửa → đúng mốc mà dòng đó sẽ được lưu.
 *
 * Cũng chính là KHOÁ XẾP THỨ TỰ của dòng: trình sửa xếp bảng theo nó, phiếu in
 * xếp theo "date" của từng dòng (mergeSheetRows) — cùng một con số, nên thứ tự
 * nhìn thấy trên màn hình đúng bằng thứ tự in ra giấy.
 *
 * null = ô ngày còn trống hoặc gõ dở, chưa xếp được vào phiếu.
 */
export function sheetRowDate(day: string, timeIn: string): string | null {
  return (timeIn ? isoFromSheetTime(day, timeIn) : null) ?? isoFromSheetDay(day);
}

/** Giờ bắt đầu buổi tập để in lên phiếu. Rỗng khi mốc đó chỉ có ngày. */
export function sheetStartTime(iso: string): string {
  return isBareDay(iso) ? "" : sheetTime(iso);
}

// ── Ghép lớp phủ lên phiếu ──────────────────────────────────────────────────

export type SheetRow = {
  /** workoutLogId với buổi app ghi, id do trình sửa sinh với buổi ghi tay. */
  id: string;
  date: string;
  checkOutAt: string | null;
  signatureUrl: string | null;
  photoUrl: string | null;
  weight: number | null;
  /** true = cân đúng ngày tập (hoặc số FM/PT điền tay); false = số mang theo. */
  weightMeasured: boolean;
  /** true = buổi ghi tay. Ô chữ ký và ô ảnh in ra để trống, nhìn là phân biệt được. */
  manual: boolean;
  /** Họ tên đầy đủ của HLV đã dạy buổi này. Rỗng = không biết. */
  ptName: string;
};

/** Buổi ghi tay dựng thành dòng phiếu: ô chữ ký và ô ảnh luôn để trống. */
export function manualSheetRow(e: SheetExtraRow): SheetRow {
  return {
    id: e.id,
    date: e.date,
    checkOutAt: e.checkOutAt,
    ptName: e.ptName ?? "",
    signatureUrl: null,
    photoUrl: null,
    weight: e.weight,
    weightMeasured: e.weight != null,
    manual: true,
  };
}

/**
 * Xếp buổi app ghi lẫn buổi ghi tay vào đúng bộ phiếu.
 *
 * Xếp theo NGÀY chứ không nối đuôi: buổi cũ điền tay phải nằm TRƯỚC buổi app
 * ghi, đúng như khách đã tập.
 *
 * `capacity` là tổng số ô của cả bộ (sheetCapacity). Dư ra thì phần dư không in
 * — nhưng nay trần đi theo số buổi của gói, nên gói 100 buổi có đủ 100 ô thay vì
 * bị cắt ở ô thứ 50 như trước.
 */
export function mergeSheetRows(rows: SheetRow[], capacity: number): SheetRow[] {
  return [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, Math.max(ROWS_PER_SHEET, capacity));
}

/** Áp phần sửa tay lên một buổi app ghi. Chữ ký và ảnh giữ nguyên, luôn luôn. */
export function applyRowOverride(row: SheetRow, o: SheetRowOverride | undefined): SheetRow {
  if (!o) return row;
  return {
    ...row,
    date: o.date ?? row.date,
    checkOutAt: o.checkOutAt !== undefined ? o.checkOutAt : row.checkOutAt,
    weight: o.weight !== undefined && o.weight !== null ? o.weight : row.weight,
    // Số FM/PT tự điền là một khẳng định, in đậm như số cân đo đúng ngày.
    weightMeasured: o.weight != null ? true : row.weightMeasured,
  };
}
