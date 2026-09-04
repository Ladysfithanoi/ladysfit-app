// Quy tắc tiền bạc của 1 lead ở Setup doanh số (Thêm / Sửa Lead).
//
// Dùng CHUNG cho client (components/dashboard/setup/leads-tab.tsx — khoá ô nhập,
// hiện gợi ý, chặn nút Cập nhật) và server (app/api/setup/leads) để hai bên không
// bao giờ lệch luật. Mọi số tiền trong file này tính bằng TRIỆU đồng — đúng đơn vị
// mà ô "Doanh thu (triệu)" / "Còn thiếu (triệu)" đang lưu vào DB.
import { PACKAGES, TRIAL_PACKAGE } from "./packages";

/** Tái ký — L3/L4/L5 được trợ giá 10%. */
export const RENEW_SOURCE = "Renew";

/** Khách vừa tập xong gói trải nghiệm L0 → gói kế tiếp được cấn trừ 2 triệu đã đóng. */
export const POST_L0_SOURCE = "Hậu L0";

/** Số tiền L0 được cấn trừ vào gói ngay sau đó (triệu). */
export const POST_L0_CREDIT = 2;

/**
 * TIỀN L0 LUÔN CẤN TRỪ VÀO GÓI SAU NÓ, KHÔNG BAO GIỜ TRỪ VÀO CHÍNH NÓ.
 *
 * Khách đóng 2 triệu tập thử 4 buổi. Khi khách ký gói thật, 2 triệu đó được
 * cấn trừ — nên "gói ngay sau L0" mới là chỗ nhận khoản trừ.
 *
 * Có hai cách lead được ghi, và luật phải nhận ra cả hai:
 *
 *   1. GHI CHUNG MỘT LEAD — Gói tập đăng ký là "L0+L2". Khoản trừ tự áp, không
 *      cần chọn nguồn gì đặc biệt: giá hợp đồng = 2 (L0) + 15 (L2) − 2 = 15.
 *   2. GHI HAI LEAD — lead L0 đã chốt từ trước với nguồn marketing thật của nó
 *      (Facebook Page, Referral…), lead sau chỉ có gói thật. Lúc này không nhìn
 *      vào danh sách gói mà biết được, nên phải chọn nguồn "Hậu L0".
 *
 * Trường hợp lead CHỈ có mỗi L0 thì không trừ gì cả — chưa có gói nào ở sau để
 * nhận khoản trừ. Trước đây chọn nguồn "Hậu L0" cho lead gói L0 sẽ ra giá hợp
 * đồng 0 triệu, mà ô Doanh thu lại không nhận số 0, thành ra bí không lưu được.
 */
function postL0Credit(packages: string[], source: string | null | undefined): number {
  const hasL0  = packages.includes(TRIAL_PACKAGE);
  const others = packages.filter(p => p !== TRIAL_PACKAGE);

  // Cách 1: L0 và gói thật nằm chung một lead.
  if (hasL0 && others.length > 0) return POST_L0_CREDIT;
  // Cách 2: L0 ở lead trước, lead này là gói ngay sau nó.
  if (!hasL0 && source === POST_L0_SOURCE && others.length > 0) return POST_L0_CREDIT;
  // Chỉ có mỗi L0 → chưa có gói nào để trừ vào.
  return 0;
}

/** Chỉ 3 gói này được trợ giá tái ký. L0/L1/L2/Loyalfit giữ nguyên giá. */
export const RENEW_DISCOUNT_PACKAGES = ["L3", "L4", "L5"];
export const RENEW_DISCOUNT_RATE = 0.1;

/** Sai số cho phép khi đối chiếu tiền (triệu) — ô nhập bước 0.1 nên 0.001 là đủ. */
const EPS = 0.001;

export type LeadFinanceStatus = "TAKECARE" | "FAIL" | "DE" | "PIF" | "PB";

/** Tình trạng đã chốt hợp đồng — bắt buộc có gói tập và có tiền. */
export const REGISTERED_STATUSES: LeadFinanceStatus[] = ["DE", "PIF", "PB"];

// ── Gói tập ───────────────────────────────────────────────────────────────────

/** "L3+L4" | "L3, L4" | "L3/L4" → ["L3","L4"] */
export function parsePackageList(pkg: string | null | undefined): string[] {
  if (!pkg?.trim()) return [];
  return pkg.split(/[,+/]/).map(s => s.trim()).filter(Boolean);
}

export function serializePackageList(pkgs: string[]): string {
  return pkgs.join("+");
}

/** Giá đang bán của 1 gói (đồng). discountedPrice là giá bán, price là giá niêm yết. */
function listPriceVND(pkg: string): number | null {
  const def = PACKAGES[pkg];
  if (!def) return null;
  return def.discountedPrice ?? def.price;
}

export type PriceLine = {
  pkg: string;
  /** Giá đang bán (triệu). */
  base: number;
  /** Giá sau khi áp luật của Phân nguồn (triệu). */
  final: number;
  /** Nhãn ngắn giải thích phần chênh, hiện trên gợi ý. */
  note?: string;
};

export type ExpectedRevenue = {
  lines: PriceLine[];
  /** Tiền cấn trừ chung cho cả hợp đồng (triệu) — hiện chỉ có khoản 2 triệu của L0. */
  credit: number;
  creditNote?: string;
  /** Số tiền đúng của hợp đồng (triệu). */
  total: number;
};

/**
 * Số tiền đúng của hợp đồng theo Gói tập đăng ký + Phân nguồn.
 * Trả về null khi không thể đối chiếu: chưa chọn gói, hoặc có gói lạ không nằm
 * trong bảng giá (dữ liệu cũ / import tay) — lúc đó chỉ áp các luật khoá ô.
 */
export function computeExpectedRevenue(
  packages: string[],
  source: string | null | undefined,
): ExpectedRevenue | null {
  if (packages.length === 0) return null;

  const isRenew = source === RENEW_SOURCE;

  const lines: PriceLine[] = [];
  let totalVND = 0;

  for (const pkg of packages) {
    const listVND = listPriceVND(pkg);
    if (listVND == null) return null; // gói lạ → không đối chiếu được
    // Renew: chỉ L3/L4/L5 được trợ giá 10%. Hậu L0 không tính renew.
    const discounted = isRenew && RENEW_DISCOUNT_PACKAGES.includes(pkg);
    const finalVND = discounted ? Math.round(listVND * (1 - RENEW_DISCOUNT_RATE)) : listVND;
    totalVND += finalVND;
    lines.push({
      pkg,
      base: listVND / 1_000_000,
      final: finalVND / 1_000_000,
      note: discounted ? "trợ giá tái ký 10%" : undefined,
    });
  }

  const credit = postL0Credit(packages, source);
  const total  = Math.max(0, totalVND / 1_000_000 - credit);

  return {
    lines,
    credit,
    creditNote: credit ? `cấn trừ ${POST_L0_CREDIT} triệu đã đóng ở gói L0` : undefined,
    total,
  };
}

// ── Khoá ô nhập theo Tình trạng ───────────────────────────────────────────────

export type FieldLocks = { revenue: boolean; remaining: boolean };

/**
 * Ô nào bị khoá theo Tình trạng:
 *  - Đang chăm / Không đăng ký : khoá cả hai (chưa có tiền).
 *  - Đặt cọc                   : mở cả hai (cọc + phần còn nợ).
 *  - Thanh toán nốt            : chỉ mở Doanh thu (trả nốt phần còn nợ).
 *  - Đã thanh toán             : chỉ mở Doanh thu (không còn nợ gì).
 */
export function fieldLocks(status: LeadFinanceStatus): FieldLocks {
  switch (status) {
    case "DE":  return { revenue: false, remaining: false };
    case "PB":
    case "PIF": return { revenue: false, remaining: true };
    default:    return { revenue: true,  remaining: true };
  }
}

// ── Kiểm tra trước khi cho Cập nhật ───────────────────────────────────────────

export type LeadFinanceInput = {
  status: LeadFinanceStatus;
  source: string | null | undefined;
  packageRegistered: string | null | undefined;
  actualRevenue: number | null | undefined;
  remainingPayment: number | null | undefined;
};

const filled = (n: number | null | undefined): n is number =>
  typeof n === "number" && !isNaN(n) && n !== 0;

function fmt(n: number) {
  return (Math.round(n * 100) / 100).toString();
}

/**
 * Trả về thông báo lỗi tiếng Việt nếu tiền chưa hợp lệ, null nếu OK.
 * Đây là nguồn sự thật duy nhất cho cả nút Cập nhật lẫn API.
 */
export function validateLeadFinance(input: LeadFinanceInput): string | null {
  const { status } = input;
  const packages  = parsePackageList(input.packageRegistered);
  const revenue   = input.actualRevenue;
  const remaining = input.remainingPayment;
  const locks     = fieldLocks(status);

  // 1. Chưa chốt hợp đồng thì không được có tiền.
  if (locks.revenue && filled(revenue)) {
    return "Tình trạng Đang chăm / Không đăng ký không được điền Doanh thu";
  }
  if (locks.remaining && filled(remaining)) {
    if (status === "PIF") return "Đã thanh toán thì không còn khoản nào thiếu — hãy để trống ô Còn thiếu";
    if (status === "PB")  return "Thanh toán nốt thì không còn khoản nào thiếu — hãy để trống ô Còn thiếu";
    return "Tình trạng Đang chăm / Không đăng ký không được điền Còn thiếu";
  }
  if (!REGISTERED_STATUSES.includes(status)) return null;

  // 2. Đã chốt thì phải có gói tập mới đối chiếu được tiền.
  if (packages.length === 0) {
    return "Vui lòng chọn Gói tập đăng ký trước khi điền doanh thu";
  }
  // Khách vừa tập thử L0 thì không thể là khách tái ký — nếu không, một hợp
  // đồng vừa được trợ giá 10% vừa được cấn trừ 2 triệu.
  if (input.source === RENEW_SOURCE && packages.includes(TRIAL_PACKAGE)) {
    return `Nguồn ${RENEW_SOURCE} là khách tái ký, không đi cùng gói ${TRIAL_PACKAGE} — hãy chọn nguồn marketing thật của khách`;
  }
  if (input.source === POST_L0_SOURCE) {
    if (packages.includes(TRIAL_PACKAGE)) {
      return `Lead này đang là gói ${TRIAL_PACKAGE} — ${POST_L0_CREDIT} triệu của ${TRIAL_PACKAGE} cấn trừ vào GÓI SAU nó, không trừ vào chính nó. Hãy chọn nguồn marketing thật của khách; khoản trừ sẽ áp ở lead gói tiếp theo.`;
    }
    if (packages.length > 1) {
      return `Nguồn "${POST_L0_SOURCE}" chỉ áp cho đúng 1 gói ngay sau ${TRIAL_PACKAGE} — gói tiếp theo hãy tạo lead riêng với nguồn ${RENEW_SOURCE}`;
    }
  }

  const expected = computeExpectedRevenue(packages, input.source);

  // 3. Luật tiền theo từng tình trạng.
  if (status === "DE") {
    if (!filled(revenue))   return "Đặt cọc thì bắt buộc phải điền Doanh thu (số tiền đã cọc)";
    if (!filled(remaining)) return "Đặt cọc thì bắt buộc phải điền Còn thiếu (phần còn nợ)";
    if (expected && Math.abs(revenue + remaining - expected.total) > EPS) {
      return `Doanh thu + Còn thiếu phải bằng ${fmt(expected.total)} triệu (${describeExpected(expected)}), hiện đang là ${fmt(revenue + remaining)} triệu`;
    }
    return null;
  }

  if (status === "PB") {
    // Trả nốt phần còn nợ của đợt cọc trước → số tiền nhỏ hơn giá gói, không đối chiếu giá.
    if (!filled(revenue)) return "Thanh toán nốt thì bắt buộc phải điền Doanh thu (số tiền trả nốt)";
    if (revenue < 0)      return "Doanh thu không được là số âm";
    return null;
  }

  // PIF — Đã thanh toán: phải đúng bằng giá hợp đồng.
  if (!filled(revenue)) return "Đã thanh toán thì bắt buộc phải điền Doanh thu";
  if (expected && Math.abs(revenue - expected.total) > EPS) {
    return `Doanh thu phải là ${fmt(expected.total)} triệu (${describeExpected(expected)}), hiện đang là ${fmt(revenue)} triệu`;
  }
  return null;
}

/** "L3 25 + L4 40.5 (trợ giá tái ký 10%)" — dùng cho thông báo lỗi và gợi ý dưới ô nhập. */
export function describeExpected(e: ExpectedRevenue): string {
  const body = e.lines
    .map(l => `${l.pkg} ${fmt(l.final)}${l.note ? ` — ${l.note}` : ""}`)
    .join(" + ");
  return e.credit ? `${body} − ${fmt(e.credit)} (${e.creditNote})` : body;
}
