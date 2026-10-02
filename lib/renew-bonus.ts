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
// CHỈ TÍNH KHI HỢP ĐỒNG ĐÃ TRẢ ĐỦ TIỀN, ở dòng trả khoản tiền cuối cùng:
//   • Đã thanh toán (PIF) không còn thiếu: trả đủ một lần → tính ngay kỳ đó.
//   • Đặt cọc (DE): CHƯA tính — cọc còn có thể huỷ. Dòng PIF/PB còn ghi "Còn
//     thiếu" > 0 cũng chưa tính (dữ liệu cũ có cọc ghi nhầm thành PIF/PB).
//   • Thanh toán nốt (PB) đã ghi doanh thu và hết nợ: hợp đồng hoàn tất → tính ở
//     kỳ thu nốt. Dòng PB tạo từ nút "Tạo thanh toán nốt" chưa điền doanh thu là
//     tiền chưa về, chưa tính. PB trống ô gói (ghi tay) thì lấy gói + nguồn của
//     khoản cọc nó trả nốt (findDeposit).
// Mỗi hợp đồng vì vậy chỉ đếm đúng một lần, ở dòng trả hết tiền.
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

// ── Khoản cọc mà một dòng PB trả nốt ──────────────────────────────────────

type LeadRow = {
  id:                string;
  customerName:      string;
  phone:             string | null;
  status:            string;
  month:             number;
  year:              number;
  source:            string | null;
  packageRegistered: string | null;
  remainingPayment:  number | null;
  actualRevenue:     number | null;
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

/**
 * Khoản cọc mà dòng PB này trả nốt: dòng gốc của nút "Tạo thanh toán nốt"
 * (payoffOfId), không có thì lead CÙNG KHÁCH, có ghi gói, ở cùng kỳ hoặc trước đó
 * và đang còn nợ (Đặt cọc, hoặc "Còn thiếu" > 0) — gần nhất trước.
 */
export function findDeposit(pb: LeadRow, candidates: LeadRow[]): LeadRow | null {
  if (pb.payoffOfId) return candidates.find((c) => c.id === pb.payoffOfId) ?? null;
  const at = pb.year * 12 + pb.month;
  const found = candidates.filter((c) => {
    if (c.id === pb.id) return false;
    const ct = c.year * 12 + c.month;
    if (ct > at || at - ct > PAYOFF_LOOKBACK_MONTHS) return false;
    const owed = c.status === "DE" || (c.remainingPayment ?? 0) > 0;
    return owed && leadPackages(c.packageRegistered).length > 0 && sameCustomer(pb, c);
  });
  found.sort((x, y) => (y.year * 12 + y.month) - (x.year * 12 + x.month));
  return found[0] ?? null;
}

/** Dòng này là khoản tiền CUỐI của một hợp đồng đã trả đủ. */
export function isFullyPaidRow(l: LeadRow): boolean {
  if ((l.remainingPayment ?? 0) > 0) return false;
  if (l.status === "PIF") return true;
  // PB tạo sẵn từ nút thu nốt mà chưa điền doanh thu = tiền chưa về.
  return l.status === "PB" && (l.actualRevenue ?? 0) > 0;
}

/** Tổng số gói renew của cả cơ sở trong tháng — chỉ hợp đồng đã trả đủ tiền. */
export async function getBranchRenewCount(branchId: string, month: number, year: number): Promise<number> {
  const select = {
    id: true, customerName: true, phone: true, status: true, month: true, year: true,
    packageRegistered: true, remainingPayment: true, actualRevenue: true, payoffOfId: true, source: true,
  } as const;
  const leads = (await prisma.salesLead.findMany({
    where: { branchId, month, year, status: { in: ["PIF", "PB"] } },
    select,
  })).filter(isFullyPaidRow);

  // PB ghi tay trống ô gói: cần khoản cọc (có thể ở kỳ trước) để biết gói nào.
  const needDeposit = leads.filter((l) => l.status === "PB" && leadPackages(l.packageRegistered).length === 0);
  let candidates: LeadRow[] = [];
  if (needDeposit.length > 0) {
    const from = year * 12 + month - PAYOFF_LOOKBACK_MONTHS;
    const linked = needDeposit.map((l) => l.payoffOfId).filter((id): id is string => !!id);
    candidates = (await prisma.salesLead.findMany({
      where: {
        branchId,
        OR: [
          { status: { in: ["DE", "PIF", "PB"] }, year: { in: [year, Math.floor((from - 1) / 12)] } },
          ...(linked.length ? [{ id: { in: linked } }] : []),
        ],
      },
      select,
    })).filter((c) => linked.includes(c.id) || c.year * 12 + c.month >= from);
  }

  return leads.reduce((sum, l) => {
    const dep = needDeposit.includes(l) ? findDeposit(l, candidates) : null;
    return sum + renewCountOfLead(
      l.source?.trim() ? l.source : dep?.source,
      dep ? dep.packageRegistered : l.packageRegistered,
    );
  }, 0);
}
