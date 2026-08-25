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

/** Một giáo án cụ thể của một bậc giai đoạn, vd "Giai đoạn 2: Giảm béo". */
export type PhaseVariant = {
  id: string;
  /** Tên đầy đủ trong Kho bài tập ("Giai đoạn 2: Giảm béo"). */
  name: string;
  /** Nhãn ngắn để chọn ("Giảm béo"); rơi về tên đầy đủ nếu không có dấu ":". */
  label: string;
  templateKey: string;
  order: number;
};

/**
 * Các giáo án người này được phép chuyển khách sang, gom theo bậc 1/2/3.
 *
 * PT có hệ thống cấp độ BẬT và cấp độ đã cấu hình quyền → chỉ những giai đoạn
 * cấp độ được cấp quyền (giống hệt cách /api/admin/phases đang lọc). FM/Admin,
 * và PT chưa cấu hình quyền, lấy toàn bộ giai đoạn đang bật.
 *
 * `restricted` cho biết có đang giới hạn theo cấp độ hay không — chỉ khi đó một
 * bậc rỗng mới bị chặn với lý do "chưa được cấp quyền".
 */
async function targetablePhasesForActor(
  actor: Actor
): Promise<{ byOrder: Map<number, PhaseVariant[]>; restricted: boolean }> {
  const [phases, sysConfig, user] = await Promise.all([
    prisma.workoutPhase.findMany({
      where: { isActive: true },
      select: { id: true, name: true, templateKey: true, order: true },
      orderBy: { order: "asc" },
    }),
    prisma.systemConfig.findUnique({ where: { id: "main" } }),
    actor.role === "PT"
      ? prisma.user.findUnique({
          where: { id: actor.id },
          select: {
            ptLevel: {
              select: { phaseAccess: { select: { phaseId: true, hasAccess: true } } },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const access = user?.ptLevel?.phaseAccess ?? [];
  const restricted =
    actor.role === "PT" && sysConfig?.enableLevelSystem === true && access.length > 0;
  const allowedIds = restricted
    ? new Set(access.filter((a) => a.hasAccess).map((a) => a.phaseId))
    : null;

  const byOrder = new Map<number, PhaseVariant[]>();
  for (const p of phases) {
    if (allowedIds && !allowedIds.has(p.id)) continue;
    // Ưu tiên số trong tên ("Giai đoạn 2"), rơi về cột order nếu tên không chuẩn.
    const ord = phaseOrderOf(p.name) || p.order;
    if (ord < 1 || ord > MAX_PHASE_ORDER) continue;
    const sep = p.name.indexOf(":");
    const label = sep >= 0 ? p.name.slice(sep + 1).trim() || p.name : p.name;
    const list = byOrder.get(ord) ?? [];
    list.push({ id: p.id, name: p.name, label, templateKey: p.templateKey, order: ord });
    byOrder.set(ord, list);
  }
  return { byOrder, restricted };
}

/**
 * Chương trình sẵn có của ĐÚNG một giáo án. Khớp theo phaseId; CT cũ chưa gắn
 * phaseId thì khớp theo bậc + loại hình tập (workoutType lưu chính templateKey).
 * Ưu tiên CT đang áp dụng, cùng hạng lấy CT mới nhất — như programsByOrder.
 */
async function programForPhase(clientId: string, phase: PhaseVariant): Promise<ProgRow | null> {
  const programs = await prisma.workoutProgram.findMany({
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
      workoutType: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const rank = (s: string) => (s === "ACTIVE" ? 2 : 1);
  let best: ProgRow | null = null;
  for (const p of programs) {
    const matches =
      p.phaseId === phase.id ||
      (p.phaseId == null &&
        phaseOrderOf(p.phase) === phase.order &&
        (phase.templateKey ? p.workoutType === phase.templateKey : p.phase === phase.name));
    if (!matches) continue;
    if (
      !best ||
      rank(p.status) > rank(best.status) ||
      (rank(p.status) === rank(best.status) && p.createdAt > best.createdAt)
    ) {
      best = p;
    }
  }
  return best;
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
  /**
   * Các giáo án của bậc này người đang đăng nhập được chuyển sang (đã lọc theo
   * cấp độ). Nhiều hơn 1 thì giao diện hỏi chọn; đúng 1 thì chuyển thẳng.
   */
  phases: PhaseVariant[];
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
  const [byOrder, canBypass, phase1Weeks, targetable] = await Promise.all([
    programsByOrder(clientId),
    canBypassPhaseGate(actor, clientId),
    requiredWeeksForPhase1(clientId),
    targetablePhasesForActor(actor),
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
    const variants = targetable.byOrder.get(order) ?? [];
    if (order === currentOrder) {
      options.push({
        order,
        label,
        isCurrent: true,
        allowed: false,
        bypassesWeekGate: false,
        phases: variants,
      });
      continue;
    }

    let reason: string | undefined;
    let bypassesWeekGate = false;

    if (order < currentOrder && !isAdmin) {
      reason = "Chỉ Admin mới được chuyển khách về giai đoạn trước đó.";
    } else if (targetable.restricted && variants.length === 0) {
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
      phases: variants,
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
 *
 * `targetPhaseId` là giáo án cụ thể của bậc đó (GĐ2: Giảm béo / Skinny Fat…).
 * Bỏ trống thì: đúng một giáo án được cấp quyền → dùng luôn giáo án đó; nhiều
 * hơn một → trả lỗi 400 để giao diện hỏi người dùng chọn.
 */
export async function switchClientPhase(
  clientId: string,
  targetOrder: number,
  actor: Actor,
  targetPhaseId?: string | null
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

  // Một bậc có thể có nhiều giáo án. `option.phases` đã lọc theo cấp độ, nên
  // gửi lên id của giáo án ngoài quyền (hoặc id bịa) đều bị chặn ngay tại đây —
  // giao diện chỉ là nơi hiển thị, luật vẫn nằm ở server.
  let chosen: PhaseVariant | null = null;
  if (targetPhaseId) {
    chosen = option.phases.find((p) => p.id === targetPhaseId) ?? null;
    if (!chosen) {
      return { ok: false, error: "Bạn chưa được cấp quyền giáo án này.", status: 403 };
    }
  } else if (option.phases.length === 1) {
    // Chỉ một giáo án được cấp quyền → chuyển thẳng, khỏi hỏi.
    chosen = option.phases[0];
  } else if (option.phases.length > 1) {
    return {
      ok: false,
      error: `Hãy chọn giáo án cho ${option.label}: ${option.phases.map((p) => p.label).join(", ")}.`,
      status: 400,
    };
  }

  const byOrder = await programsByOrder(clientId);
  // Mở lại CT của ĐÚNG giáo án được chọn. Khách từng tập một giáo án khác cùng
  // bậc (vd Skinny Fat) không tính là đã có CT "Giảm béo".
  let target = chosen ? await programForPhase(clientId, chosen) : byOrder.get(targetOrder) ?? null;

  if (!target) {
    // Chưa có CT cho giai đoạn này → dựng từ mẫu, bài tập để trống cho PT điền.
    const base = byOrder.get(info.currentOrder) ?? Array.from(byOrder.values())[0] ?? null;
    target = await createPhaseProgram(
      clientId,
      base?.createdById ?? actor.id,
      targetOrder,
      base?.sessionsPerWeek ?? 3,
      chosen
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

/**
 * Tạo chương trình tập cho một giai đoạn từ template (bài tập để trống).
 * `chosen` là giáo án người dùng đã chọn — có thì dùng thẳng, không có mới đoán
 * theo mẫu tĩnh như trước (đường cũ, dành cho DB chưa cấu hình Kho bài tập).
 */
async function createPhaseProgram(
  clientId: string,
  createdById: string,
  order: number,
  sessionsPerWeek: number,
  chosen: PhaseVariant | null = null
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
  if (chosen) {
    dbPhase = dbPhases.find((p) => p.id === chosen.id) ?? null;
  } else {
    if (workoutType) dbPhase = dbPhases.find((p) => p.templateKey === workoutType) ?? null;
    if (!dbPhase) dbPhase = dbPhases.find((p) => p.name === baseName) ?? null;
    if (!dbPhase) dbPhase = dbPhases.find((p) => phaseOrderOf(p.name) === order) ?? null;
  }
  const phaseId: string | null = dbPhase?.id ?? null;
  // Giáo án đã chọn quyết định loại hình tập — kể cả khi nó không có templateKey
  // (giai đoạn Admin tự tạo), tuyệt đối không rơi về mặc định "Skinny Fat".
  if (chosen) workoutType = dbPhase?.templateKey || null;
  else if (dbPhase?.templateKey) workoutType = dbPhase.templateKey;

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
      notes: `Tạo khi chuyển sang ${dbPhase?.name ?? baseName}. PT vui lòng chọn bài tập.`,
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
