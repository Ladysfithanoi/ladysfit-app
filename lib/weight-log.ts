import { prisma } from "@/lib/prisma";

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

/** Phần ngày của một mốc thời gian — cùng cách phiếu check-in và biểu đồ đọc ngày. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * `currentWeight` của khách LUÔN là lần cân mới nhất — tính lại từ nhật ký cân
 * chứ không nhận số do người gọi truyền vào, nên sửa hay xoá một bản ghi cũ cũng
 * ra đúng kết quả.
 *
 * `hasTransformed` chỉ bật, không bao giờ tắt: đó là cột mốc khách đã đạt được,
 * xoá một lần cân không lấy lại được thành tích đó.
 */
export async function syncClientWeight(clientId: string): Promise<void> {
  const [latest, client] = await Promise.all([
    prisma.weightLog.findFirst({ where: { clientId }, orderBy: { date: "desc" } }),
    prisma.client.findUnique({
      where: { id: clientId },
      select: { initialWeight: true, hasTransformed: true },
    }),
  ]);
  if (!latest || !client) return;

  const nowTransformed = client.initialWeight - latest.weight >= 7;
  await prisma.client.update({
    where: { id: clientId },
    data: {
      currentWeight: latest.weight,
      ...(nowTransformed && !client.hasTransformed ? { hasTransformed: true } : {}),
    },
  });
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
    where: {
      clientId,
      date: { gte: new Date(`${day}T00:00:00.000Z`), lte: new Date(`${day}T23:59:59.999Z`) },
    },
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
