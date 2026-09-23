import { prisma } from "@/lib/prisma";
import { getBranchRevenue, getUserRevenue } from "@/lib/salary-revenue";
import { getTaughtSessions, getSessionAdjustments } from "@/lib/pt-session-count";
import { showPayOf, type ShowBuckets } from "@/lib/session-pay";
import { liveShowsForUser } from "@/lib/session-pay-server";
import { standardWorkDays } from "@/lib/work-days";
import { sumLeaveDeductionByUser } from "@/lib/leave-days";
import { computeTotalSalary } from "@/lib/salary-total";
import { transformBonusForUser, TRANSFORM_BONUS_AMOUNT, type TransformBonus } from "@/lib/transform-bonus";

/**
 * MỘT ĐƯỜNG TÍNH LẠI BẢNG LƯƠNG THEO THỜI GIAN THỰC.
 *
 * Bảng lương là ảnh chụp lúc FM bấm tạo, nhưng bốn thứ bên dưới còn chạy tiếp
 * sau đó: doanh số (lead chốt thêm), tiền buổi dạy (PT check-out), thưởng
 * KOC/KOL và ngày nghỉ. Trước đây chỉ màn Quỹ lương của FM mới tính lại đủ cả
 * bốn; bảng lương PT tự xem (/api/salary/my) chỉ đồng bộ ngày nghỉ và tiền buổi
 * dạy, nên PT chốt xong hợp đồng vẫn thấy hoa hồng cũ cho tới khi FM mở trang.
 *
 * Gom vào đây để hai màn hình dùng chung đúng một công thức — thêm một chỗ tính
 * lương nữa là bắt đầu lệch số.
 */

// ── Bậc hoa hồng cố định toàn hệ thống ─────────────────────────────────────

const PT_TIERS = [
  { min: 86_000_000,  rate: 0.04  },
  { min: 60_000_000,  rate: 0.035 },
  { min: 38_000_000,  rate: 0.025 },
  { min: 0,           rate: 0.01  },
];

const FM_TIERS = [
  { min: 200_000_001, rate: 0.02  },
  { min: 140_000_001, rate: 0.015 },
  { min: 100_000_000, rate: 0.01  },
  { min: 0,           rate: 0     },
];

export function ptRate(revenue: number) { return PT_TIERS.find(t => revenue >= t.min)!.rate; }
export function fmRate(revenue: number) { return FM_TIERS.find(t => revenue >= t.min)!.rate; }

// ── Hoa hồng KOC / KOL ─────────────────────────────────────────────────────

function calculateKOCCommission(startWeight: number, endWeight: number | null, sessions: number): number {
  if (endWeight == null) return 0;
  const weightLost = startWeight - endWeight;
  const maxSessions = Math.min(sessions, 60);
  if (startWeight < 70) return 0;
  if (weightLost >= 8 && weightLost <= 9.9) return maxSessions * 35_000;
  if (weightLost >= 5 && weightLost <= 7.9) return maxSessions * 25_000;
  if (weightLost >= 3 && weightLost <= 4.9) return maxSessions * 20_000;
  return 0;
}

export async function fetchKOCKOLCommission(
  ptId:  string,
  month: number,
  year:  number,
): Promise<{ kocCommission: number; kolCommission: number; kocContracts: number; kolSessions: number }> {
  // KOC: thưởng một lần cho hợp đồng KẾT THÚC TRONG THÁNG NÀY.
  //
  // Cách cũ lọc theo pe.status = 'ACTIVE' và không giới hạn tháng nên trả lặp
  // lại mỗi tháng chừng nào gói còn ACTIVE. Gói KOC là 60 buổi/60 ngày nên khi
  // lộ trình tự đóng (hết buổi/hết hạn) điều kiện đó vĩnh viễn không khớp và
  // thưởng KOC sẽ không bao giờ được trả. Nay bám theo ngày kết thúc hợp đồng —
  // độc lập với trạng thái gói, và chỉ vào lương đúng một tháng.
  const kocRows = await prisma.$queryRawUnsafe<{
    startWeight: number;
    endWeight: number | null;
    endWeightConfirmed: boolean;
    totalSessions: number;
    contractType: string;
  }[]>(
    `
    SELECT k."startWeight", k."endWeight", k."endWeightConfirmed", k."totalSessions",
           pe."contractType"
    FROM koc_contracts k
    JOIN package_enrollments pe ON pe.id = k."enrollmentId"
    WHERE k."ptId" = $1 AND k.status = 'COMPLETED'
      AND k."endDate" >= $2 AND k."endDate" < $3
    `,
    ptId, new Date(year, month - 1, 1), new Date(year, month, 1)
  );

  let kocCommission = 0;
  let kocContracts = 0;
  for (const row of kocRows) {
    if (row.contractType === "KOC" && row.endWeightConfirmed) {
      kocCommission += calculateKOCCommission(
        Number(row.startWeight),
        row.endWeight != null ? Number(row.endWeight) : null,
        Number(row.totalSessions),
      );
      kocContracts++;
    }
  }

  // KOL: 60.000đ cho mỗi buổi KOL DẠY TRONG THÁNG NÀY.
  //
  // Cách cũ cộng dồn pe."sessionsUsed" của mọi gói KOL ACTIVE (tổng số buổi từ
  // đầu hợp đồng) và trả lặp lại nguyên số đó mỗi tháng — một khách KOL 60 buổi
  // trả 3,6tr/tháng vô thời hạn, kể cả tháng PT không dạy buổi KOL nào. Nay đếm
  // đúng buổi đã check-out có chữ ký trong tháng, cùng nguồn với tiền buổi dạy,
  // nên buổi KOL dạy hộ cũng ghi công đúng người dạy.
  const taught = await getTaughtSessions([ptId], new Date(year, month - 1, 1), new Date(year, month, 1));
  const kolAdjust = (await getSessionAdjustments([ptId], month, year))
    .filter(a => a.contractType === "KOL")
    .reduce((sum, a) => sum + a.delta, 0);
  const kolSessions   = Math.max(0, taught.filter(r => r.contractType === "KOL").length + kolAdjust);
  const kolCommission = kolSessions * 60_000;

  return { kocCommission, kolCommission, kocContracts, kolSessions };
}

// ── Tính lại một dòng lương ────────────────────────────────────────────────

/** Các cột của SalaryRecord mà việc tính lại cần đọc. */
export type SalaryRecordSnapshot = {
  id:               string;
  userId:           string;
  branchId:         string;
  baseSalary:       number;
  fixedAllowances:  number;
  seniorityBonus:   number;
  totalRevenue:     number;
  commissionRate:   number;
  commissionAmount: number;
  branchCommission: boolean;
  showPay:          number;
  goalBonus:        number;
  googleBonus:      number;
  renewBonus:       number;
  kocCommission:    number;
  kolCommission:    number;
  standardWorkDays: number;
  actualWorkDays:   number;
  leaveDays:        number;
  totalSalary:      number;
  advancePaid:      number;
};

export type SalaryPatch = {
  totalRevenue:     number;
  commissionRate:   number;
  commissionAmount: number;
  kocCommission:    number;
  kolCommission:    number;
  goalBonus:        number;
  /** Chỉ PT — số hợp đồng đạt mốc thưởng transform trong tháng. */
  clientsAchievedGoal?: number;
  showPay:          number;
  standardWorkDays: number;
  actualWorkDays:   number;
  leaveDays:        number;
  totalSalary:      number;
  remainingPayment: number;
  /** Số buổi dạy theo từng nhóm — chỉ có khi PT được tính lại tiền buổi dạy. */
  shows:            ShowBuckets | null;
};

/**
 * Tính lại một dòng lương theo dữ liệu mới nhất.
 *
 * `revenue` / `leaveCount` cho phép bên gọi nạp sẵn số đã truy vấn theo lô
 * (màn Quỹ lương tính cả cơ sở một lượt); bỏ trống thì hàm tự đọc.
 */
export async function recalcSalary(args: {
  record:      SalaryRecordSnapshot;
  role:        string;
  month:       number;
  year:        number;
  revenue?:    number;
  leaveCount?: number;
  /** Thưởng transform cả tháng đã tính sẵn (màn Quỹ lương tính một lần cho mọi dòng). */
  transformBonuses?: TransformBonus[];
}): Promise<{ patch: SalaryPatch; changed: boolean }> {
  const { record: r, role, month, year } = args;

  // DOANH SỐ: FM ăn theo doanh số cả phòng, PT/Admin theo doanh số cá nhân —
  // cùng định nghĩa với "Tổng doanh thu" bên Setup (lib/salary-revenue).
  const totalRevenue = args.revenue ?? (
    role === "FM"
      ? await getBranchRevenue(r.branchId, month, year)
      : await getUserRevenue(r.userId, r.branchId, month, year)
  );

  // FM bị bỏ tích "hưởng hoa hồng doanh số phòng" thì tính lại vẫn phải giữ 0 —
  // nếu không, mỗi lần mở bảng lương là hoa hồng tự mọc lại khi doanh số phòng đổi.
  const rate = role === "FM"
    ? (r.branchCommission === false ? 0 : fmRate(totalRevenue))
    : ptRate(totalRevenue);
  const commissionRate   = rate * 100;
  const commissionAmount = totalRevenue * rate;

  const { kocCommission, kolCommission } = role !== "FM"
    ? await fetchKOCKOLCommission(r.userId, month, year)
    : { kocCommission: 0, kolCommission: 0 };

  // TIỀN BUỔI DẠY CỦA PT TÍNH LẠI THEO THỜI GIAN THỰC.
  //
  // PT dạy xong một buổi (check-in + check-out đầy đủ) là buổi đó đã đủ điều
  // kiện tính tiền, nên bảng lương phải thấy ngay chứ không đợi FM tạo lại.
  //
  // FM GIỮ NGUYÊN NHƯ CŨ: tiền buổi dạy của FM có trần 60 buổi/tháng và do
  // người tạo bảng lương chốt, tính lại ở đây sẽ phá trần đó. Admin dạy thêm
  // cũng giữ nguyên con số đã chốt.
  // THƯỞNG TRANSFORM (100k/hợp đồng đạt cam kết giảm cân) — tự tính từ nhật
  // ký cân, không nhập tay. Chỉ PT: Admin/FM không có khoản này trong tổng lương.
  let goalBonus = r.goalBonus;
  let clientsAchievedGoal = 0;
  if (role === "PT") {
    if (args.transformBonuses) {
      clientsAchievedGoal = args.transformBonuses.filter(b => b.ptId === r.userId).length;
      goalBonus = clientsAchievedGoal * TRANSFORM_BONUS_AMOUNT;
    } else {
      ({ goalBonus, clientsAchievedGoal } = await transformBonusForUser(r.userId, month, year));
    }
  }

  const shows: ShowBuckets | null = role === "PT"
    ? await liveShowsForUser(r.userId, month, year)
    : null;
  const showPay = shows ? showPayOf(shows) : r.showPay;

  // Bản ghi tạo trước khi có ngày công: điền ngày công chuẩn của tháng và coi
  // như đi làm đủ, để FM sửa được ngay mà tổng lương không đổi.
  const hasWorkDays  = r.standardWorkDays > 0;
  const standardDays = hasWorkDays ? r.standardWorkDays : standardWorkDays(month, year);

  // Lịch nghỉ đổi bao nhiêu ngày thì trừ (hoặc trả lại) đúng bấy nhiêu ngày công,
  // nên phần FM sửa tay trước đó vẫn được giữ nguyên.
  const leaveCount = args.leaveCount ??
    ((await sumLeaveDeductionByUser([r.userId], month, year))[r.userId] ?? 0);
  const baseDays   = hasWorkDays ? r.actualWorkDays : standardDays;
  const actualDays = leaveCount === r.leaveDays
    ? baseDays
    : Math.max(0, Math.min(baseDays - (leaveCount - r.leaveDays), standardDays));

  const totalSalary = computeTotalSalary({
    role,
    baseSalary:      r.baseSalary,
    fixedAllowances: r.fixedAllowances,
    seniorityBonus:  r.seniorityBonus,
    commissionAmount,
    showPay,
    goalBonus,
    googleBonus:     r.googleBonus,
    renewBonus:      r.renewBonus,
    kocCommission,
    kolCommission,
    standardWorkDays: standardDays,
    actualWorkDays:   actualDays,
  });

  const changed =
    !hasWorkDays ||
    leaveCount !== r.leaveDays ||
    Math.abs(r.totalRevenue     - totalRevenue)     > 0.01 ||
    Math.abs(r.commissionRate   - commissionRate)   > 0.001 ||
    Math.abs(r.commissionAmount - commissionAmount) > 0.01 ||
    Math.abs(r.totalSalary      - totalSalary)      > 0.01 ||
    Math.abs(r.showPay          - showPay)          > 0.01 ||
    Math.abs(r.kocCommission    - kocCommission)    > 0.01 ||
    Math.abs(r.kolCommission    - kolCommission)    > 0.01 ||
    Math.abs(r.goalBonus        - goalBonus)        > 0.01;

  return {
    changed,
    patch: {
      totalRevenue,
      commissionRate,
      commissionAmount,
      kocCommission,
      kolCommission,
      ...(role === "PT" ? { goalBonus, clientsAchievedGoal } : { goalBonus: r.goalBonus }),
      showPay,
      standardWorkDays: standardDays,
      actualWorkDays:   actualDays,
      leaveDays:        leaveCount,
      totalSalary,
      remainingPayment: totalSalary - r.advancePaid,
      shows,
    },
  };
}

/** Dựng payload `data` cho prisma.salaryRecord.update từ kết quả tính lại. */
export function salaryUpdateData(patch: SalaryPatch) {
  const { shows, ...rest } = patch;
  return { ...rest, ...(shows ?? {}) };
}
