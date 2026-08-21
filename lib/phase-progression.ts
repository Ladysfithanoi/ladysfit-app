import { prisma } from "@/lib/prisma";
import { RESIDENT_PACKAGE } from "@/lib/packages";
import { WORKOUT_TYPE_OPTIONS, getSessionTypeOptions } from "@/lib/workout-structure";
import { loadPhaseMovements, slotsForSession } from "@/lib/movement-templates";

// ── Chuyển giai đoạn tập — THỦ CÔNG ─────────────────────────────────────────
//
// Khách tập tuần tự qua các giai đoạn 1 → 2 → 3. Tại một thời điểm chỉ có MỘT
// chương trình ACTIVE (giai đoạn đang áp dụng); các giai đoạn còn lại ARCHIVED.
//
// Việc chuyển giai đoạn KHÔNG còn chạy tự động. Trước đây một "engine" tự tính
// lại giai đoạn ở mỗi lần mở trang và tự đổi trạng thái chương trình — cách đó
// hay đá nhau với thao tác tay của PT/quản lý. Giờ mọi thay đổi đều do người
// dùng bấm, qua `switchClientPhase` bên dưới; hệ thống chỉ còn kiểm tra xem
// người bấm có được phép hay không (`evaluatePhaseSwitch`).
//
// Luật kiểm tra giữ nguyên như cũ:
//   • Tuần tự   — người thường chỉ chuyển lên giai đoạn liền kề, không nhảy cóc.
//   • Lùi lại   — chỉ Admin.
//   • Số tuần   — phải hoàn thành tối thiểu 8 tuần có buổi tập ở giai đoạn hiện
//                 tại (khách cũ đã có lộ trình L1/L2 kết thúc thì nhẹ hơn, xem
//                 `requiredWeeksForPhase1`). FM/Admin được vượt rào này.
//   • Cấp độ PT — PT chỉ chuyển được sang giai đoạn mà cấp độ của mình được cấp
//                 quyền truy cập (PTLevelPhaseAccess), khi hệ thống cấp độ bật.

export const PHASE_MIN_COMPLETED_WEEKS = 8;
export const MAX_PHASE_ORDER = 3;
// Số buổi tập (buổi khác nhau, có Nhật ký COMPLETED) tối thiểu để một tuần được
// tính là "đã hoàn thành". Không vượt quá số buổi/tuần thực tế của chương trình.
export const MIN_WEEK_SESSIONS = 3;

// ── Quyền vượt rào số tuần ───────────────────────────────────────────────────
//
// Mặc định khách phải hoàn thành đủ số tuần của giai đoạn hiện tại mới chuyển
// lên được. Quản lý được phép bỏ qua rào này khi thấy cần (khách tiến nhanh hơn
// dự kiến, khách cũ đã tập ngoài đời…):
//   • Admin  → mọi khách.
//   • FM     → khách thuộc cơ sở mình quản lý, tức khách của chính FM lẫn khách
//              của các PT dưới quyền.
//   • PT     → không; PT phải chờ khách tập đủ tuần.
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

type Actor = {
  id: string;
  role?: string | null;
  managedBranchIds?: string[] | null;
};

/**
 * Số tuần GĐ1 phải hoàn thành trước khi chuyển sang GĐ2 — mặc định 8 tuần cho
 * khách mới. NHƯNG với khách CŨ của phòng (mới nhập lên app) đã tập xong một
 * phần GĐ1 ngoài đời, xét lịch sử lộ trình ĐÃ KẾT THÚC (hết hạn/hoàn thành):
 *   • Đã có gói L2 đã kết thúc → coi như đã xong GĐ1, khỏi tập lại (0 tuần).
 *   • Đã có gói L1 đã kết thúc → chỉ cần tập thêm 4 tuần GĐ1.
 *   • Còn lại (kể cả khách đang tập gói L1/L2 hiện hành) → giữ nguyên 8 tuần.
 */
async function requiredWeeksForPhase1(clientId: string): Promise<number> {
  const packages = await prisma.packageEnrollment.findMany({
    where: { clientId },
    select: { packageName: true, status: true, endDate: true },
  });
  const isFinished = (p: (typeof packages)[number]) =>
    p.status === "EXPIRED" ||
    p.status === "COMPLETED" ||
    (p.endDate != null && p.endDate.getTime() < Date.now());
  if (packages.some((p) => p.packageName === "L2" && isFinished(p))) return 0;
  // Gói "Cư dân" có cấu trúc y hệt L1 nên tính như đã xong một gói L1.
  const hasFinishedL1 = packages.some(
    (p) => (p.packageName === "L1" || p.packageName === RESIDENT_PACKAGE) && isFinished(p)
  );
  return hasFinishedL1 ? 4 : PHASE_MIN_COMPLETED_WEEKS;
}

/**
 * Đếm số tuần đã hoàn thành của một chương trình. Một tuần CHỈ được tính khi có
 * đủ tối thiểu số buổi tập (buổi khác nhau) đã ghi Nhật ký COMPLETED — mặc định
 * 3 buổi/tuần, nhưng không vượt quá số buổi/tuần của CT (để CT 2 buổi/tuần vẫn
 * tiến được). Tuần chỉ có 1–2 buổi lẻ sẽ KHÔNG được cộng.
 */
async function completedWeeksOfProgram(
  clientId: string,
  programId: string,
  sessionsPerWeek: number
): Promise<number> {
  const logs = await prisma.workoutLog.findMany({
    where: { clientId, programId, status: "COMPLETED" },
    select: { weekId: true, sessionId: true },
  });
  const byWeek = new Map<string, Set<string>>();
  for (const l of logs) {
    if (!l.weekId || !l.sessionId) continue;
    let sess = byWeek.get(l.weekId);
    if (!sess) byWeek.set(l.weekId, (sess = new Set()));
    sess.add(l.sessionId);
  }
  const need = Math.min(
    MIN_WEEK_SESSIONS,
    sessionsPerWeek > 0 ? sessionsPerWeek : MIN_WEEK_SESSIONS
  );
  let count = 0;
  for (const sess of Array.from(byWeek.values())) if (sess.size >= need) count++;
  return count;
}

/** Chương trình đại diện của mỗi giai đoạn (ưu tiên ACTIVE, cùng hạng lấy mới nhất). */
async function programsByOrder(clientId: string): Promise<Map<number, ProgRow>> {
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
  const rank = (s: string) => (s === "ACTIVE" ? 2 : 1);
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
  return byOrder;
}

/**
 * Các thứ tự giai đoạn mà cấp độ của PT được phép truy cập. Trả về null khi
 * không cần giới hạn (không phải PT, hệ thống cấp độ đang tắt, hoặc cấp độ chưa
 * cấu hình quyền giai đoạn nào) — giống hệt cách /api/admin/phases đang lọc.
 */
async function allowedPhaseOrdersForActor(actor: Actor): Promise<Set<number> | null> {
  if (actor.role !== "PT") return null;
  const [sysConfig, user] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { id: "main" } }),
    prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        ptLevel: {
          select: { phaseAccess: { select: { phaseId: true, hasAccess: true } } },
        },
      },
    }),
  ]);
  const access = user?.ptLevel?.phaseAccess ?? [];
  if (!sysConfig?.enableLevelSystem || access.length === 0) return null;

  const allowedIds = access.filter((a) => a.hasAccess).map((a) => a.phaseId);
  if (allowedIds.length === 0) return new Set();
  const phases = await prisma.workoutPhase.findMany({
    where: { id: { in: allowedIds } },
    select: { name: true, order: true },
  });
  const orders = new Set<number>();
  for (const p of phases) {
    // Ưu tiên số trong tên ("Giai đoạn 2"), rơi về cột order nếu tên không chuẩn.
    const ord = phaseOrderOf(p.name) || p.order;
    if (ord >= 1) orders.add(ord);
  }
  return orders;
}

export type PhaseSwitchOption = {
  order: number;
  label: string;
  /** Giai đoạn đang áp dụng. */
  isCurrent: boolean;
  allowed: boolean;
  /** Lý do không chuyển được — hiện thẳng cho người dùng. */
  reason?: string;
  /** Chuyển được nhưng đang vượt rào số tuần (chỉ FM/Admin có trường hợp này). */
  bypassesWeekGate: boolean;
};

export type PhaseSwitchInfo = {
  /** Giai đoạn đang áp dụng; 0 nếu khách chưa có CT nào đang áp dụng. */
  currentOrder: number;
  /** Tên giai đoạn đang áp dụng, để hiện đúng nhãn PT đã đặt. */
  currentPhase: string | null;
  /** Số tuần đã hoàn thành ở giai đoạn đang áp dụng. */
  completedWeeks: number;
  /** Số tuần cần có ở giai đoạn đang áp dụng để chuyển lên. */
  requiredWeeks: number;
  canBypass: boolean;
  options: PhaseSwitchOption[];
};

/**
 * Tính xem người này được chuyển khách sang những giai đoạn nào, kèm lý do cho
 * giai đoạn bị chặn. Dùng chung cho cả giao diện (hiện danh sách) lẫn API (kiểm
 * tra lại trước khi thực hiện) để hai bên không lệch luật nhau.
 */
export async function evaluatePhaseSwitch(
  clientId: string,
  actor: Actor
): Promise<PhaseSwitchInfo> {
  const [byOrder, canBypass, phase1Weeks, allowedOrders] = await Promise.all([
    programsByOrder(clientId),
    canBypassPhaseGate(actor, clientId),
    requiredWeeksForPhase1(clientId),
    allowedPhaseOrdersForActor(actor),
  ]);

  const isAdmin = actor.role === "ADMIN";
  const current = Array.from(byOrder.values()).find((p) => p.status === "ACTIVE") ?? null;
  const currentOrder = current ? phaseOrderOf(current.phase) : 0;
  const requiredWeeks = currentOrder === 1 ? phase1Weeks : PHASE_MIN_COMPLETED_WEEKS;
  const completedWeeks = current
    ? await completedWeeksOfProgram(clientId, current.id, current.sessionsPerWeek)
    : 0;

  const options: PhaseSwitchOption[] = [];
  for (let order = 1; order <= MAX_PHASE_ORDER; order++) {
    const label = `Giai đoạn ${order}`;
    if (order === currentOrder) {
      options.push({ order, label, isCurrent: true, allowed: false, bypassesWeekGate: false });
      continue;
    }

    let reason: string | undefined;
    let bypassesWeekGate = false;

    if (order < currentOrder && !isAdmin) {
      reason = "Chỉ Admin mới được chuyển khách về giai đoạn trước đó.";
    } else if (allowedOrders && !allowedOrders.has(order)) {
      reason = `Cấp độ PT của bạn chưa được cấp quyền ${label}. Nhờ Quản lý (FM) hoặc Admin chuyển giúp.`;
    } else if (order > currentOrder && !canBypass && currentOrder > 0) {
      // Người thường đi tuần tự từng bậc và phải đủ số tuần của bậc hiện tại.
      if (order !== currentOrder + 1) {
        reason = `Phải chuyển lần lượt qua Giai đoạn ${currentOrder + 1} trước.`;
      } else if (completedWeeks < requiredWeeks) {
        reason = `Khách mới hoàn thành ${completedWeeks}/${requiredWeeks} tuần ở ${current?.phase ?? "giai đoạn hiện tại"}. Nhờ Quản lý (FM) hoặc Admin mở sớm nếu cần.`;
      }
    } else if (order > currentOrder && canBypass) {
      bypassesWeekGate = currentOrder > 0 && completedWeeks < requiredWeeks;
    }

    options.push({
      order,
      label,
      isCurrent: false,
      allowed: reason === undefined,
      reason,
      bypassesWeekGate,
    });
  }

  return {
    currentOrder,
    currentPhase: current?.phase ?? null,
    completedWeeks,
    requiredWeeks,
    canBypass,
    options,
  };
}

/**
 * Chuyển khách sang một giai đoạn: đặt CT của giai đoạn đó thành ACTIVE (tạo mới
 * từ mẫu nếu khách chưa có), mọi CT còn lại thành ARCHIVED. Kiểm tra lại quyền
 * trước khi làm — trả `{ ok: false, error, status }` để API dịch thành 403/400.
 */
export async function switchClientPhase(
  clientId: string,
  targetOrder: number,
  actor: Actor
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!Number.isInteger(targetOrder) || targetOrder < 1 || targetOrder > MAX_PHASE_ORDER) {
    return { ok: false, error: "Giai đoạn không hợp lệ.", status: 400 };
  }

  const info = await evaluatePhaseSwitch(clientId, actor);
  const option = info.options.find((o) => o.order === targetOrder);
  if (!option) return { ok: false, error: "Giai đoạn không hợp lệ.", status: 400 };
  if (option.isCurrent) {
    return { ok: false, error: "Khách đang tập ở giai đoạn này rồi.", status: 400 };
  }
  if (!option.allowed) {
    return { ok: false, error: option.reason ?? "Bạn không có quyền chuyển giai đoạn.", status: 403 };
  }

  const byOrder = await programsByOrder(clientId);
  let target = byOrder.get(targetOrder) ?? null;

  if (!target) {
    // Chưa có CT cho giai đoạn này → dựng từ mẫu, bài tập để trống cho PT điền.
    const base = byOrder.get(info.currentOrder) ?? Array.from(byOrder.values())[0] ?? null;
    target = await createPhaseProgram(
      clientId,
      base?.createdById ?? actor.id,
      targetOrder,
      base?.sessionsPerWeek ?? 3
    );
    if (!target) {
      return { ok: false, error: "Không tạo được chương trình cho giai đoạn này.", status: 500 };
    }
  }

  // Đúng MỘT chương trình ACTIVE — cổng khách hàng đọc theo trạng thái này.
  await prisma.workoutProgram.updateMany({
    where: { clientId, id: { not: target.id }, status: { not: "ARCHIVED" } },
    data: { status: "ARCHIVED" },
  });
  await prisma.workoutProgram.update({
    where: { id: target.id },
    data: {
      status: "ACTIVE",
      // Đánh dấu CT được mở khi khách chưa tập đủ số tuần, để nhìn là biết.
      manualPhaseOverride: option.bypassesWeekGate,
    },
  });

  return { ok: true };
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

  // Tìm WorkoutPhase tương ứng trong DB để giữ liên kết, và quan trọng hơn: lấy
  // tên buổi + chuyển động do Admin cấu hình. Giai đoạn Admin tự tạo không có
  // trong mẫu tĩnh, nên nếu chỉ đọc mẫu tĩnh thì buổi sẽ rỗng.
  const dbPhases = await prisma.workoutPhase.findMany({
    select: { id: true, name: true, templateKey: true, sessionTypes: true, defaultReps: true },
  });
  let dbPhase: (typeof dbPhases)[number] | null = null;
  if (workoutType) dbPhase = dbPhases.find((p) => p.templateKey === workoutType) ?? null;
  if (!dbPhase) dbPhase = dbPhases.find((p) => p.name === baseName) ?? null;
  if (!dbPhase) dbPhase = dbPhases.find((p) => phaseOrderOf(p.name) === order) ?? null;
  const phaseId: string | null = dbPhase?.id ?? null;
  if (dbPhase?.templateKey) workoutType = dbPhase.templateKey;

  const sessionTypes =
    dbPhase && dbPhase.sessionTypes.length > 0
      ? dbPhase.sessionTypes
      : getSessionTypeOptions(baseName, workoutType ?? baseName).map((o) => o.value);
  const fallbackTypes = sessionTypes.length > 0 ? sessionTypes : ["Tạ 1"];
  const spw = sessionsPerWeek > 0 ? sessionsPerWeek : 3;

  const movements = dbPhase ? await loadPhaseMovements(dbPhase) : {};

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
      notes: `Tạo khi chuyển sang ${baseName}. PT vui lòng chọn bài tập.`,
    },
  });

  const week = await prisma.workoutWeek.create({
    data: { programId: program.id, weekNumber: 1 },
  });

  for (let i = 0; i < spw; i++) {
    const sessionType = fallbackTypes[i % fallbackTypes.length];
    const slots = slotsForSession(movements, sessionType, workoutType, dbPhase?.defaultReps);
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
