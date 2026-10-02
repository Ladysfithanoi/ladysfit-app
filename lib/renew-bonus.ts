import { prisma } from "@/lib/prisma";
import { isRenewalSlot, parsePackageList, purchaseOrder } from "@/lib/lead-pricing";
import { PACKAGES } from "@/lib/packages";

// ── Thưởng Renew của FM — tự đếm từ Setup doanh số ──────────────────────────
//
// Mỗi GÓI RENEW thưởng một lần. Gói nào là renew dùng đúng luật "gói mua thêm"
// của giá hợp đồng (isRenewalSlot) — gói được giá tái ký thì cũng chính gói đó
// được thưởng renew, hai bên không thể lệch nhau:
//   • Lead nguồn Renew (khách cũ mua tiếp): mọi gói thật đều là renew.
//   • Khách mới mua nhiều gói một lần: gói đầu không tính, từ gói 2 là renew —
//     2 gói = 1 renew, 3 gói = 2 renew…
//   • Combo L0 + 1 gói tập: L0 không phải gói thật, gói ngay sau L0 là Hậu L0 →
//     không có renew nào. L0 + 2 gói thì gói thứ hai mới là renew.
//
// MỖI HỢP ĐỒNG ĐẾM MỘT LẦN, ở dòng ghi nhận hợp đồng đó:
//   • Đặt cọc (DE) và Đã thanh toán (PIF): luôn là dòng hợp đồng.
//   • Thanh toán nốt (PB): THƯỜNG là đợt thu tiếp của một khoản cọc đã đếm rồi —
//     nhưng dữ liệu thật có cả hợp đồng mới trả đủ một lần mà bị ghi PB (vd combo
//     Renew L3+L4 63tr, không hề có cọc). Bỏ hết PB thì mất renew của những hợp
//     đồng đó. Nên PB chỉ bị bỏ khi TÌM THẤY khoản cọc nó trả nốt (isPayoffRow);
//     không thấy thì tính là hợp đồng.
//   • Khoản cọc để TRỐNG ô gói thì lúc đó đếm được 0 renew — PB trả nốt nó phải
//     đếm thay, không thì hợp đồng rơi mất ở cả hai tháng (vd cọc Renew tháng 8
//     không ghi gói, tháng 9 trả nốt L4 → trước đây không tính renew nào).
//
// Kỳ thưởng theo month/year của lead, cùng kỳ với doanh số phòng mà FM hưởng
// hoa hồng (lib/salary-revenue).

export const RENEW_BONUS_AMOUNT = 150_000;

/** Khoản cọc trả nốt có thể nằm ở kỳ trước — nhìn lùi tối đa bấy nhiêu tháng. */
const PAYOFF_LOOKBACK_MONTHS = 6;

// ── Gói tập ghi tay muôn kiểu → tên gói chuẩn ──────────────────────────────

const KNOWN = Object.keys(PACKAGES);

/**
 * Một mẩu gói ghi tay → tên gói chuẩn ("lt2", "Lộ trình 2", "L3 Renew" → L2/L3).
 * Không nhận ra thì giữ nguyên — vẫn đếm là một gói, chỉ là không biết giai đoạn.
 */
function canonicalPackage(raw: string): string {
  const s = raw.trim();
  const known = KNOWN.find((k) => k.toLowerCase() === s.toLowerCase());
  if (known) return known;
  const ascii = s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
  if (/loyal/.test(ascii)) return "Loyalfit";
  const m = ascii.match(/^(?:lo\s*trinh|lt|l)\s*(\d)\b/);
  if (m && PACKAGES[`L${m[1]}`]) return `L${m[1]}`;
  return s;
}

/**
 * Danh sách gói của lead. Ngoài "+ , /" mà parsePackageList đã hiểu, nhận thêm
 * "&", " và ", " - " giữa hai gói và hai gói chỉ cách nhau dấu cách ("L2 L3").
 */
export function leadPackages(packageRegistered: string | null | undefined): string[] {
  const pieces = parsePackageList(
    (packageRegistered ?? "")
      .replace(/\s*&\s*|\s+và\s+|\s+-\s+/gi, "+")
      // "L2 L3" / "L2 LT3": hai mã gói đứng liền nhau chỉ cách dấu cách.
      .replace(/\b(L\d|LT\d)\s+(?=(?:L|LT)\d\b)/gi, "$1+"),
  );
  return pieces.map(canonicalPackage);
}

/** Số gói renew trong một lead. */
export function renewCountOfLead(
  source: string | null | undefined,
  packageRegistered: string | null | undefined,
): number {
  const ordered = purchaseOrder(leadPackages(packageRegistered));
  const src = source?.trim() || null;
  let n = 0;
  for (let i = 0; i < ordered.length; i++) {
    if (isRenewalSlot(ordered, i, src)) n++;
  }
  return n;
}

// ── Dòng PB nào là đợt thu nốt ─────────────────────────────────────────────

type LeadRow = {
  id:                string;
  customerName:      string;
  phone:             string | null;
  status:            string;
  month:             number;
  year:              number;
  packageRegistered: string | null;
  remainingPayment:  number | null;
  payoffOfId:        string | null;
};

const digits = (s: string | null) => (s ?? "").replace(/\D/g, "").replace(/^84/, "").replace(/^0+/, "");
const nameKey = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Cùng một khách:
 *   • trùng số điện thoại; hoặc
 *   • trùng nguyên họ tên — số điện thoại gõ thiếu/sai một số vẫn nhận ra
 *     (vd 0916718860 / 091678860); hoặc
 *   • một bên không ghi số, và tên này nằm trọn trong tên kia
 *     ("Sasha" / "Sasha Nicol Thompson").
 */
function sameCustomer(a: LeadRow, b: LeadRow): boolean {
  const pa = digits(a.phone), pb = digits(b.phone);
  if (pa && pb && pa === pb) return true;
  const na = nameKey(a.customerName), nb = nameKey(b.customerName);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (pa && pb) return false;
  return na.includes(nb) || nb.includes(na);
}

/** Hai lead có chung ít nhất một gói (lead trống gói thì không loại trừ được). */
function samePackages(a: LeadRow, b: LeadRow): boolean {
  const pa = leadPackages(a.packageRegistered), pb = leadPackages(b.packageRegistered);
  if (pa.length === 0 || pb.length === 0) return true;
  return pa.some((p) => pb.includes(p));
}

/**
 * Dòng PB này có phải đợt thu nốt của một khoản cọc ĐÃ ĐƯỢC ĐẾM không. Khoản cọc
 * là lead của CÙNG KHÁCH, CÙNG GÓI, ở cùng kỳ hoặc trước đó, đang còn nợ (Đặt
 * cọc, hoặc dòng còn ghi "Còn thiếu" > 0 — dữ liệu cũ có cọc ghi nhầm thành
 * PIF/PB), và CÓ GHI GÓI — cọc trống gói chưa được đếm renew nào nên PB phải đếm.
 */
export function isPayoffRow(pb: LeadRow, candidates: LeadRow[]): boolean {
  if (pb.payoffOfId) return true;
  const at = pb.year * 12 + pb.month;
  return candidates.some((c) => {
    if (c.id === pb.id) return false;
    const ct = c.year * 12 + c.month;
    if (ct > at || at - ct > PAYOFF_LOOKBACK_MONTHS) return false;
    const owed = c.status === "DE" || (c.remainingPayment ?? 0) > 0;
    const counted = leadPackages(c.packageRegistered).length > 0;
    return owed && counted && sameCustomer(pb, c) && samePackages(pb, c);
  });
}

/** Tổng số gói renew của cả cơ sở trong tháng. */
export async function getBranchRenewCount(branchId: string, month: number, year: number): Promise<number> {
  const select = {
    id: true, customerName: true, phone: true, status: true, month: true, year: true,
    packageRegistered: true, remainingPayment: true, payoffOfId: true, source: true,
  } as const;
  const leads = await prisma.salesLead.findMany({
    where: { branchId, month, year, status: { in: ["DE", "PIF", "PB"] } },
    select,
  });

  const pbs = leads.filter((l) => l.status === "PB" && !l.payoffOfId);
  let candidates: LeadRow[] = [];
  if (pbs.length > 0) {
    const from = year * 12 + month - PAYOFF_LOOKBACK_MONTHS;
    candidates = (await prisma.salesLead.findMany({
      where: {
        branchId,
        status: { in: ["DE", "PIF", "PB"] },
        OR: [{ year }, { year: Math.floor((from - 1) / 12) }],
      },
      select,
    })).filter((c) => c.year * 12 + c.month >= from);
  }

  return leads.reduce((sum, l) => {
    if (l.status === "PB" && isPayoffRow(l, candidates)) return sum;
    return sum + renewCountOfLead(l.source, l.packageRegistered);
  }, 0);
}
