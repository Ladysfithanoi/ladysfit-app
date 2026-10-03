import { prisma } from "@/lib/prisma";
import { sheetDay, isoFromSheetTime } from "@/lib/checkin-sheet";
import { TRANSFORM_LOSS_KG } from "@/lib/transform-credit";

/**
 * GHI CÂN NẶNG — MỘT ĐƯỜNG DUY NHẤT.
 *
 * Cân nặng được nhập từ nhiều chỗ: màn hình "Cập nhật cân nặng" của nhân sự, app
 * của khách, và ô "+ Cân nặng" lúc khách ký check-in buổi tập. Cả ba đều đi qua
 * đây. Mỗi lần ghi cân kéo theo hai việc phụ mà quên một cái là số liệu sai lặng
 * lẽ: đồng bộ `currentWeight` của khách, và đánh dấu `hasTransformed` khi khách
 * đã giảm đủ 7kg.
 */

/** Ngưỡng cân nặng của người thật. Ngoài khoảng này chắc chắn là gõ nhầm. */
export const WEIGHT_MIN = 20;
export const WEIGHT_MAX = 300;

/** Số cân nhập vào là số hợp lệ, hay không có gì? null = bỏ trống hoặc gõ bậy. */
export function parseWeightInput(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < WEIGHT_MIN || n > WEIGHT_MAX) return null;
  return Math.round(n * 10) / 10;
}

/**
 * Phần ngày của một mốc thời gian, THEO GIỜ VIỆT NAM — cùng một hàm mà phiếu
 * check-in dùng cho cột "Ngày" (lib/checkin-sheet).
 *
 * Cắt thẳng chuỗi ISO là cắt theo giờ UTC, mà giờ VN sớm hơn 7 tiếng: buổi tập
 * 6h30 sáng có mốc UTC rơi vào HÔM TRƯỚC. Hệ quả không nhìn thấy ngay mà rất
 * tệ — số cân PT nhập lúc check-in sáng sớm bị coi là "cân lại của hôm qua",
 * đè lên số cân hôm qua, còn hôm nay thì không có dòng nào. Nhìn từ màn hình
 * "Cập nhật cân nặng" thì đúng là số vừa nhập biến mất.
 */
function dayKey(d: Date): string {
  return sheetDay(d.toISOString());
}

/** Một ngày VN kéo từ 00:00 tới 23:59:59.999 giờ VN — quy về mốc UTC để hỏi CSDL. */
function vnDayRange(day: string): { gte: Date; lte: Date } {
  const startIso = isoFromSheetTime(day, "00:00");
  // dayKey luôn sinh ra YYYY-MM-DD hợp lệ nên nhánh này không xảy ra; giữ lại
  // để không phải ép kiểu, và nếu có xảy ra thì rơi về đúng ngày UTC như cũ.
  const start = startIso ? new Date(startIso) : new Date(`${day}T00:00:00.000Z`);
  return { gte: start, lte: new Date(start.getTime() + 24 * 3600_000 - 1) };
}

/**
 * `currentWeight` của khách LUÔN là lần cân mới nhất — tính lại từ nhật ký cân
 * chứ không nhận số do người gọi truyền vào, nên sửa hay xoá một bản ghi cũ cũng
 * ra đúng kết quả. `hasTransformed` cũng tính lại theo cùng nhật ký đó — xem
 * syncTransformFlag.
 */
export async function syncClientWeight(clientId: string): Promise<void> {
  const latest = await prisma.weightLog.findFirst({ where: { clientId }, orderBy: { date: "desc" } });
  if (!latest) return;
  await prisma.client.update({ where: { id: clientId }, data: { currentWeight: latest.weight } });
  await syncTransformFlag(clientId);
}

/**
 * `hasTransformed` = còn ÍT NHẤT MỘT lần cân giảm đủ 7kg so với cân ban đầu —
 * cùng định nghĩa mốc transform ở lib/transform-credit.
 *
 * Tính lại cả hai chiều, mỗi khi nhật ký cân hoặc cân ban đầu đổi. Khách tăng
 * cân lại vẫn giữ thành tích (lần cân đạt mốc vẫn còn trong nhật ký); còn số cân
 * gõ nhầm — 55,5 thay vì 89 — bị xoá hay sửa thì cờ tắt theo. Trước đây cờ "chỉ
 * bật, không tắt" nên một lần gõ nhầm đã xoá vẫn đếm transform mãi mãi.
 *
 * Khách chưa có lần cân nào thì giữ nguyên cờ: không có dữ liệu để kết luận.
 */
export async function syncTransformFlag(clientId: string): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { initialWeight: true, hasTransformed: true },
  });
  if (!client) return;
  const [anyLog, hit] = await Promise.all([
    prisma.weightLog.findFirst({ where: { clientId }, select: { id: true } }),
    prisma.weightLog.findFirst({
      // Bỏ qua số cân ngoài ngưỡng người thật (vd 0 kg gõ nhầm) — không phải mốc.
      where: { clientId, weight: { gte: WEIGHT_MIN, lte: client.initialWeight - TRANSFORM_LOSS_KG } },
      select: { id: true },
    }),
  ]);
  if (!anyLog) return;
  const transformed = hit != null;
  if (transformed !== client.hasTransformed) {
    await prisma.client.update({ where: { id: clientId }, data: { hasTransformed: transformed } });
  }
}

/**
 * Ghi một lần cân rồi đồng bộ hồ sơ khách.
 *
 * Cân lại trong CÙNG MỘT NGÀY thì đè lên bản ghi của ngày đó chứ không đẻ thêm
 * dòng: nhật ký cân là "mỗi ngày một số", hai dòng cùng ngày nghĩa là có một
 * dòng sai — mà biểu đồ cân nặng lẫn cột cân nặng của phiếu check-in đều đọc
 * theo ngày.
 */
export async function recordWeightLog(args: {
  clientId: string;
  date: Date;
  weight: number;
  note?: string | null;
}) {
  const { clientId, date, weight } = args;
  const note = args.note ?? null;
  const day = dayKey(date);

  const sameDayLog = await prisma.weightLog.findFirst({
    where: { clientId, date: vnDayRange(day) },
    orderBy: { date: "desc" },
  });

  const log = sameDayLog
    ? await prisma.weightLog.update({
        where: { id: sameDayLog.id },
        // Ghi đè không có ghi chú thì giữ ghi chú cũ, đừng xoá chữ của người khác.
        data: { weight, note: note ?? sameDayLog.note },
      })
    : await prisma.weightLog.create({ data: { clientId, date, weight, note } });

  await syncClientWeight(clientId);
  return log;
}
