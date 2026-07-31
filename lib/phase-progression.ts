import { prisma } from "@/lib/prisma";
import {
  WORKOUT_TYPE_OPTIONS,
  PHASE_DEFAULT_REPS,
  getSessionTypeOptions,
  getSlotsForSessionType,
} from "@/lib/workout-structure";

// ── Phase progression rules ──────────────────────────────────────────────────
//
// Khách tập tuần tự qua các giai đoạn 1 → 2 → 3. Tại một thời điểm chỉ có MỘT
// chương trình ở trạng thái ACTIVE (giai đoạn hiện tại). Giai đoạn đã qua được
// ARCHIVED (chỉ xem); giai đoạn sau bị LOCKED cho tới khi đủ điều kiện.
//
// Điều kiện chuyển sang giai đoạn kế: hoàn thành tối thiểu 8 TUẦN có buổi tập
// được ghi nhận (COMPLETED) ở giai đoạn hiện tại. Áp dụng cho mọi lần chuyển
// (GĐ1→2 cũng như GĐ2→3). Trường hợp khách "bắt đầu" ở GĐ2/GĐ3 thì hệ thống tự
// chèn một CT GĐ1 (mẫu) để tập 8 tuần trước, rồi mới mở khoá CT giai đoạn đích.
//
// Nội dung CT giai đoạn kế (nếu chưa tồn tại) được tự tạo từ template — GĐ2/GĐ3
// dùng "loại tập" mặc định đầu tiên, bài tập để trống cho PT điền sau.
//
// FM/Admin có thể mở khoá SỚM một giai đoạn (bỏ qua rào số tuần) bằng cách bật
// cờ manualPhaseOverride của CT đó — xem canBypassPhaseGate bên dưới.

export const PHASE_MIN_COMPLETED_WEEKS = 8;
export const MAX_PHASE_ORDER = 3;
// Số buổi tập (buổi khác nhau, có Nhật ký COMPLETED) tối thiểu để một tuần được
// tính là "đã hoàn thành". Không vượt quá số buổi/tuần thực tế của chương trình.
export const MIN_WEEK_SESSIONS = 3;

// ── Quyền bỏ qua (bypass) rào số tuần ────────────────────────────────────────
//
// Mặc định khách phải hoàn thành đủ số tuần của giai đoạn hiện tại mới mở được
// giai đoạn kế. Quản lý được phép bỏ qua rào này khi thấy cần (khách tiến nhanh
// hơn dự kiến, khách cũ đã tập ngoài đời…):
//   • Admin  → mọi khách.
//   • FM     → khách thuộc cơ sở mình quản lý, tức khách của chính FM lẫn khách
//              của các PT dưới quyền.
//   • PT     → không có quyền; tiến trình vẫn chạy tự động như cũ.
// Không ai bấm gì thì logic tự động giữ nguyên — bypass hoàn toàn là tùy chọn.
export async function canBypassPhaseGate(
  user: { role?: string | null; managedBranchIds?: string[] | null },
  clientId: string
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.role !== "FM") return false;
  const managed = user.managedBranchIds ?? [];
  if (managed.length === 0) return false;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { branchId: true },
  });
  return client != null && managed.includes(client.branchId);
}

/** Lấy thứ tự giai đoạn từ tên ("Giai đoạn 2: Skinny Fat" → 2). 0 nếu không khớp. */
export function phaseOrderOf(phaseName: string | null | undefined): number {
  if (!phaseName) return 0;
  const m = phaseName.match(/Giai\s*đo[aạ]n\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

type ProgRow = {
  id: string;
  phase: string;
  phaseId: string | null;
  status: string;
  sessionsPerWeek: number;
  manualPhaseOverride: boolean;
  createdById: string;
  createdAt: Date;
};

/**
 * Tự động cập nhật tiến trình giai đoạn cho khách: xác định giai đoạn hiện tại,
 * tạo CT giai đoạn kế từ mẫu khi cần, và đặt lại trạng thái ACTIVE/ARCHIVED/LOCKED.
 * Idempotent — gọi nhiều lần không gây hại. Bọc lỗi để không làm vỡ trang gọi nó.
 */
export async function ensureClientPhaseProgression(clientId: string): Promise<void> {
  try {
    await runProgression(clientId);
  } catch (err) {
    console.error("[phase-progression] failed for client", clientId, err);
  }
}

async function runProgression(clientId: string): Promise<void> {
  const programs: ProgRow[] = await prisma.workoutProgram.findMany({
    where: { clientId },
    select: {
      id: true,
      phase: true,
      phaseId: true,
      status: true,
      sessionsPerWeek: true,
      manualPhaseOverride: true,
      createdById: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  if (programs.length === 0) return;

  // Đếm số tuần đã hoàn thành cho mỗi chương trình. Một tuần CHỈ được tính khi có
  // đủ tối thiểu số buổi tập (buổi khác nhau) đã ghi Nhật ký (COMPLETED) — mặc định
  // 3 buổi/tuần, nhưng không vượt quá số buổi/tuần của CT (để CT 2 buổi/tuần vẫn
  // tiến được). Tuần chỉ có 1–2 buổi lẻ sẽ KHÔNG được cộng.
  const completedLogs = await prisma.workoutLog.findMany({
    where: { clientId, status: "COMPLETED" },
    select: { programId: true, weekId: true, sessionId: true },
  });
  // programId → weekId → tập hợp sessionId khác nhau đã hoàn thành
  const sessionsByProgramWeek = new Map<string, Map<string, Set<string>>>();
  for (const l of completedLogs) {
    if (!l.weekId || !l.sessionId) continue;
    let weeks = sessionsByProgramWeek.get(l.programId);
    if (!weeks) sessionsByProgramWeek.set(l.programId, (weeks = new Map()));
    let sess = weeks.get(l.weekId);
    if (!sess) weeks.set(l.weekId, (sess = new Set()));
    sess.add(l.sessionId);
  }
  const spwByProgram = new Map(programs.map((p) => [p.id, p.sessionsPerWeek]));
  const completedWeeks = (pid: string) => {
    const weeks = sessionsByProgramWeek.get(pid);
    if (!weeks) return 0;
    const spw = spwByProgram.get(pid) ?? MIN_WEEK_SESSIONS;
    const need = Math.min(MIN_WEEK_SESSIONS, spw > 0 ? spw : MIN_WEEK_SESSIONS);
    let count = 0;
    for (const sess of Array.from(weeks.values())) if (sess.size >= need) count++;
    return count;
  };

  // Số tuần GĐ1 phải hoàn thành trước khi mở khoá GĐ2 — mặc định 8 tuần cho khách
  // mới. NHƯNG với khách CŨ của phòng (mới nhập lên app) đã tập xong một phần GĐ1
  // ngoài đời, xét lịch sử gói tập ĐÃ KẾT THÚC (hết hạn/hoàn thành):
  //   • Đã có gói L2 đã kết thúc → coi như đã xong GĐ1, khỏi tập lại (0 tuần).
  //   • Đã có gói L1 đã kết thúc → chỉ cần tập thêm 4 tuần GĐ1.
  //   • Còn lại (kể cả khách đang tập gói L1/L2 hiện hành) → giữ nguyên 8 tuần.
  const packages = await prisma.packageEnrollment.findMany({
    where: { clientId },
    select: { packageName: true, status: true, endDate: true },
  });
  const isPackageFinished = (p: (typeof packages)[number]) =>
    p.status === "EXPIRED" ||
    p.status === "COMPLETED" ||
    (p.endDate != null && p.endDate.getTime() < Date.now());
  const hasFinishedL2 = packages.some(
    (p) => p.packageName === "L2" && isPackageFinished(p)
  );
  const hasFinishedL1 = packages.some(
    (p) => p.packageName === "L1" && isPackageFinished(p)
  );
  const phase1RequiredWeeks = hasFinishedL2 ? 0 : hasFinishedL1 ? 4 : PHASE_MIN_COMPLETED_WEEKS;
  const requiredWeeksFor = (order: number) =>
    order === 1 ? phase1RequiredWeeks : PHASE_MIN_COMPLETED_WEEKS;

  // Chọn một chương trình đại diện cho mỗi thứ tự giai đoạn (ưu tiên ACTIVE > LOCKED
  // > còn lại; cùng hạng thì lấy mới nhất).
  const rank = (s: string) => (s === "ACTIVE" ? 3 : s === "LOCKED" ? 2 : 1);
  const byOrder = new Map<number, ProgRow>();
  for (const p of programs) {
    const ord = phaseOrderOf(p.phase);
    if (ord < 1) continue;
    const cur = byOrder.get(ord);
    if (
      !cur ||
      rank(p.status) > rank(cur.status) ||
      (rank(p.status) === rank(cur.status) && p.createdAt > cur.createdAt)
    ) {
      byOrder.set(ord, p);
    }
  }
  if (byOrder.size === 0) return; // chỉ có CT "lạ" (không nhận diện được giai đoạn)

  const creatorId = programs[0].createdById;
  const baseSessionsPerWeek = (byOrder.get(1) ?? programs[0]).sessionsPerWeek;

  // Xác định giai đoạn hiện tại: tiến lên khi giai đoạn hiện tại đã đủ số tuần yêu
  // cầu. Khi yêu cầu = 0 tuần (khách đã có L2 → coi như xong GĐ1) thì tiến lên
  // ngay, kể cả khi chưa tồn tại CT của giai đoạn đó (khỏi tạo GĐ1 thừa).
  let currentOrder = 1;
  while (currentOrder < MAX_PHASE_ORDER) {
    const prog = byOrder.get(currentOrder);
    const required = requiredWeeksFor(currentOrder);
    const enough = prog ? completedWeeks(prog.id) >= required : required === 0;
    if (enough) {
      currentOrder++;
    } else {
      break;
    }
  }

  // An toàn cho dữ liệu cũ: chỉ tự chèn giai đoạn THẤP hơn (vd ép tập GĐ1 trước
  // cho khách "bắt đầu" ở GĐ2/3) khi khách CHƯA hoàn thành buổi nào. Khách đã có
  // lịch sử tập thì giữ nguyên giai đoạn thấp nhất hiện có, không kéo họ lùi lại.
  const lowestExistingOrder = Math.min(...Array.from(byOrder.keys()));
  if (currentOrder < lowestExistingOrder && completedLogs.length > 0) {
    currentOrder = lowestExistingOrder;
  }

  // Tôn trọng đổi giai đoạn THỦ CÔNG của PT: lấy giai đoạn PT đã chọn làm "sàn"
  // — engine không kéo khách xuống dưới mức đó (vẫn cho tự tiến lên khi đủ 8 tuần).
  const manualOrders = programs
    .filter((p) => p.manualPhaseOverride)
    .map((p) => phaseOrderOf(p.phase))
    .filter((o) => o >= 1);
  const manualFloor = manualOrders.length > 0 ? Math.max(...manualOrders) : 0;
  if (manualFloor > currentOrder) currentOrder = manualFloor;

  // Đảm bảo có chương trình cho giai đoạn hiện tại; nếu chưa có thì tạo từ mẫu.
  if (!byOrder.get(currentOrder)) {
    const created = await createPhaseProgram(
      clientId,
      creatorId,
      currentOrder,
      baseSessionsPerWeek
    );
    if (created) byOrder.set(currentOrder, created);
  }

  // Đặt lại trạng thái: < hiện tại → ARCHIVED, = hiện tại → ACTIVE (chỉ CT đại
  // diện), > hiện tại → LOCKED. CT trùng giai đoạn nhưng không phải đại diện →
  // ARCHIVED để chỉ còn đúng 1 CT ACTIVE.
  const updates: Promise<unknown>[] = [];
  for (const p of programs) {
    const ord = phaseOrderOf(p.phase);
    if (ord < 1) continue;
    let desired: "ACTIVE" | "ARCHIVED" | "LOCKED";
    if (ord < currentOrder) desired = "ARCHIVED";
    else if (ord > currentOrder) desired = "LOCKED";
    else desired = byOrder.get(ord)?.id === p.id ? "ACTIVE" : "ARCHIVED";

    if (p.status !== desired) {
      updates.push(
        prisma.workoutProgram.update({
          where: { id: p.id },
          data: { status: desired },
        })
      );
    }
  }
  await Promise.all(updates);
}

/** Tạo chương trình tập cho một giai đoạn từ template (bài tập để trống). */
async function createPhaseProgram(
  clientId: string,
  createdById: string,
  order: number,
  sessionsPerWeek: number
): Promise<ProgRow | null> {
  const baseName = `Giai đoạn ${order}`;

  // GĐ2/GĐ3 cần "loại tập" — lấy mặc định đầu tiên. GĐ1 không có loại tập.
  let workoutType: string | null = null;
  if (order >= 2) {
    workoutType = WORKOUT_TYPE_OPTIONS[baseName]?.[0]?.dbValue ?? null;
  }

  const sessionTypes = getSessionTypeOptions(baseName, workoutType ?? baseName).map(
    (o) => o.value
  );
  const fallbackTypes = sessionTypes.length > 0 ? sessionTypes : ["Tạ 1"];
  const defaultReps = PHASE_DEFAULT_REPS[baseName] ?? "15-20";
  const spw = sessionsPerWeek > 0 ? sessionsPerWeek : 3;

  // Tìm phaseId tương ứng trong DB (nếu có) để giữ liên kết WorkoutPhase.
  const dbPhases = await prisma.workoutPhase.findMany({
    select: { id: true, name: true, templateKey: true },
  });
  let phaseId: string | null = null;
  if (workoutType) phaseId = dbPhases.find((p) => p.templateKey === workoutType)?.id ?? null;
  if (!phaseId) phaseId = dbPhases.find((p) => p.name === baseName)?.id ?? null;
  if (!phaseId) phaseId = dbPhases.find((p) => phaseOrderOf(p.name) === order)?.id ?? null;

  const program = await prisma.workoutProgram.create({
    data: {
      clientId,
      createdById,
      phase: baseName,
      phaseId,
      workoutType,
      sessionsPerWeek: spw,
      currentWeek: 1,
      status: "ACTIVE",
      notes: `Tự động tạo khi chuyển sang ${baseName}. PT vui lòng chọn bài tập.`,
    },
  });

  const week = await prisma.workoutWeek.create({
    data: { programId: program.id, weekNumber: 1 },
  });

  for (let i = 0; i < spw; i++) {
    const sessionType = fallbackTypes[i % fallbackTypes.length];
    const slots = getSlotsForSessionType(sessionType, workoutType ?? undefined);
    await prisma.workoutSession.create({
      data: {
        programId: program.id,
        weekId: week.id,
        sessionName: `Buổi ${i + 1} — ${sessionType}`,
        order: i,
        movements: {
          create: slots.map((slot, mi) => ({
            movementCode: slot.code,
            movementName: slot.name,
            selectedExercise: "",
            sets: slot.defaultSets,
            reps: slot.defaultReps,
            order: mi,
          })),
        },
      },
    });
  }

  return {
    id: program.id,
    phase: program.phase,
    phaseId: program.phaseId,
    status: program.status,
    sessionsPerWeek: program.sessionsPerWeek,
    manualPhaseOverride: program.manualPhaseOverride,
    createdById: program.createdById,
    createdAt: program.createdAt,
  };
}
