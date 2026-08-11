import { prisma } from "@/lib/prisma";

// ── Transform thuộc về ai ────────────────────────────────────────────────────
// Một khách chỉ đạt transform ĐÚNG MỘT LẦN (mốc giảm đủ 7 kg đầu tiên), nên
// transform đó chỉ được ghi công cho MỘT người: người đang kèm khách tại thời
// điểm đạt mốc, và phải đã kèm ít nhất 6 tuần trước đó.
//
// Trước đây transform đếm theo clients."assignedPTId" — người ĐANG giữ khách.
// Khách của một nhân sự nghỉ việc được chuyển sang người khác thì transform cũ
// của khách chạy theo sang người nhận, dù họ chưa dạy khách ngày nào. Nay mốc
// transform được đối chiếu với nhật ký phụ trách (client_pt_assignments):
//
//   • Mốc rơi vào chặng của ai → người đó được ghi công, kể cả khi khách nay đã
//     chuyển sang người khác (công của người làm ra kết quả).
//   • Chặng đó phải dài ít nhất 6 tuần tính đến ngày đạt mốc, không thì không
//     ai được tính — chặn đúng trường hợp nhận khách xong ăn theo kết quả sẵn có.
//   • Mốc có TRƯỚC chặng đầu tiên (dữ liệu cũ nhập lúc chuyển sang phần mềm):
//     khách chưa từng đổi tay thì người đang phụ trách vẫn được tính; khách đã
//     từng đổi tay thì không rõ ai làm nên không tính cho ai.

/** Giảm đủ ngần này kg thì khách được coi là đạt transform. */
export const TRANSFORM_LOSS_KG = 7;

/** Số ngày tối thiểu phải kèm khách trước ngày khách đạt mốc — 6 tuần. */
export const TRANSFORM_MIN_TENURE_DAYS = 42;

/**
 * Khách mở hồ sơ trước mốc này là khách nhập vào lúc chuyển sang phần mềm
 * (tháng 5/2026) — họ đã tập với người phụ trách từ lâu trước đó, "ngày mở hồ
 * sơ" chỉ là ngày nhập liệu nên không đo được thâm niên kèm khách. Với những
 * khách này, luật 6 tuần chỉ áp cho chặng mở bằng một lần CHUYỂN GIAO, còn
 * người phụ trách ban đầu vẫn được ghi công. Khách mở hồ sơ từ 6/2026 trở đi
 * áp đủ luật, nên ngoại lệ này tự hết theo thời gian.
 */
const LEGACY_IMPORT_BEFORE = new Date("2026-06-01T00:00:00+07:00");

const DAY_MS = 86_400_000;

export type TransformCredit = {
  clientId: string;
  /** Cơ sở của khách — để gom transform về đúng cơ sở khi thống kê. */
  branchId: string;
  /**
   * Người được ghi công; null = không ai. Transform không có chủ VẪN là
   * transform của Ladysfit: mọi con số TỔNG (hệ thống, cơ sở, đội) phải đếm cả
   * những dòng này, chỉ phần chia theo đầu người mới bỏ qua chúng.
   */
  ptId: string | null;
  /** Ngày đạt mốc — quyết định transform rơi vào kỳ nào của bảng xếp hạng. */
  date: Date;
};

type Segment = { ptId: string; startedAt: Date };

type ClientRow = {
  id: string;
  assignedPTId: string;
  createdAt: Date;
};

/**
 * Chuỗi chặng phụ trách thực dùng để tra cứu. Nhật ký trống (khách tạo trước
 * khi có bảng này mà cũng không dựng lại được) thì coi như khách ở với người
 * hiện tại từ ngày mở hồ sơ.
 *
 * Nếu chặng cuối không phải người đang giữ khách — đổi người bằng đường chưa
 * được ghi nhật ký — mở thêm một chặng cho họ tính từ BÂY GIỜ: họ chưa đủ 6
 * tuần nên không ăn theo kết quả cũ, còn mốc cũ vẫn thuộc về người chặng trước.
 */
function buildHistory(client: ClientRow, logged: Segment[]): Segment[] {
  const history =
    logged.length > 0 ? logged : [{ ptId: client.assignedPTId, startedAt: client.createdAt }];
  const last = history[history.length - 1];
  return last.ptId === client.assignedPTId
    ? history
    : [...history, { ptId: client.assignedPTId, startedAt: new Date() }];
}

function creditedPt(client: ClientRow, history: Segment[], date: Date): string | null {
  // Nhật ký phủ từ lúc mở hồ sơ (chặng đầu bắt đầu từ ngày tạo khách) và chỉ có
  // một chặng ⇒ khách chưa từng đổi tay. Khách đã đổi tay trước khi có bảng
  // nhật ký thì chặng đầu tiên là một lần chuyển giao, không phủ hết đời khách.
  const neverChangedHands = history.length === 1 && history[0].startedAt <= client.createdAt;

  let current: Segment | null = null;
  for (const seg of history) {
    if (seg.startedAt <= date) current = seg;
    else break; // history đã sắp xếp tăng dần theo startedAt
  }

  // Đạt mốc trước cả chặng đầu tiên — chỉ tính khi khách chưa từng đổi tay.
  if (!current) return neverChangedHands ? client.assignedPTId : null;

  // Khách cũ nhập lúc chuyển sang phần mềm: chặng đầu không đo được thâm niên.
  const isFirstSegment = current === history[0] && current.startedAt <= client.createdAt;
  if (isFirstSegment && client.createdAt < LEGACY_IMPORT_BEFORE) return current.ptId;

  const tenureDays = (date.getTime() - current.startedAt.getTime()) / DAY_MS;
  return tenureDays >= TRANSFORM_MIN_TENURE_DAYS ? current.ptId : null;
}

/**
 * Transform của mọi khách đã đạt mốc, kèm người được ghi công và ngày đạt mốc.
 *
 * Ngày đạt mốc lấy từ lần cân đầu tiên giảm đủ 7 kg. Khách được đánh dấu đạt
 * transform nhưng không còn log cân nào đạt mốc (log bị sửa/xoá sau đó) thì lùi
 * về updatedAt như trang Tổng quan vẫn làm.
 */
export async function computeTransformCredits(): Promise<TransformCredit[]> {
  const clients = await prisma.client.findMany({
    where: { hasTransformed: true },
    select: {
      id: true,
      branchId: true,
      assignedPTId: true,
      initialWeight: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (clients.length === 0) return [];

  const clientIds = clients.map((c) => c.id);
  const [logs, assignments] = await Promise.all([
    prisma.weightLog.findMany({
      where: { clientId: { in: clientIds } },
      select: { clientId: true, date: true, weight: true },
      orderBy: { date: "asc" },
    }),
    prisma.clientPTAssignment.findMany({
      where: { clientId: { in: clientIds } },
      select: { clientId: true, ptId: true, startedAt: true },
      orderBy: { startedAt: "asc" },
    }),
  ]);

  const initialWeightById = new Map(clients.map((c) => [c.id, c.initialWeight]));
  const milestoneByClient = new Map<string, Date>();
  for (const log of logs) {
    if (milestoneByClient.has(log.clientId)) continue;
    const initial = initialWeightById.get(log.clientId);
    if (initial != null && initial - log.weight >= TRANSFORM_LOSS_KG) {
      milestoneByClient.set(log.clientId, log.date);
    }
  }

  const segmentsByClient = new Map<string, Segment[]>();
  for (const a of assignments) {
    const list = segmentsByClient.get(a.clientId);
    if (list) list.push({ ptId: a.ptId, startedAt: a.startedAt });
    else segmentsByClient.set(a.clientId, [{ ptId: a.ptId, startedAt: a.startedAt }]);
  }

  return clients.map((c) => {
    const date = milestoneByClient.get(c.id) ?? c.updatedAt;
    const history = buildHistory(c, segmentsByClient.get(c.id) ?? []);
    return { clientId: c.id, branchId: c.branchId, date, ptId: creditedPt(c, history, date) };
  });
}

/**
 * Số khách transform được ghi công cho từng người. Không truyền khoảng thời
 * gian thì đếm cả đời (dùng cho điều kiện thăng cấp, tab hiệu suất); truyền thì
 * chỉ đếm transform đạt mốc trong [start, end) (dùng cho bảng xếp hạng theo kỳ).
 */
export async function countTransformsByPt(
  range?: { start: Date; end: Date }
): Promise<Map<string, number>> {
  const credits = await computeTransformCredits();
  const counts = new Map<string, number>();
  for (const credit of credits) {
    if (!credit.ptId) continue;
    if (range && (credit.date < range.start || credit.date >= range.end)) continue;
    counts.set(credit.ptId, (counts.get(credit.ptId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Ghi nhật ký khi khách đổi người phụ trách. Gọi ở mọi lối đổi người: tạo
 * khách, sửa hồ sơ, chuyển giao dài hạn. Trùng người phụ trách hiện tại thì bỏ
 * qua để nhật ký không sinh chặng rỗng.
 */
export async function logPTAssignment(
  clientId: string,
  ptId: string,
  reason: "CREATED" | "EDITED" | "TRANSFERRED"
): Promise<void> {
  const last = await prisma.clientPTAssignment.findFirst({
    where: { clientId },
    select: { ptId: true },
    orderBy: { startedAt: "desc" },
  });
  if (last?.ptId === ptId) return;

  await prisma.clientPTAssignment.create({
    data: { clientId, ptId, startedAt: new Date(), reason },
  });
}
