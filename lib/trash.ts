import { prisma } from "@/lib/prisma";
import { recountClientContracts } from "@/lib/recount-contracts";

/**
 * ── Thùng rác ───────────────────────────────────────────────────────────────
 *
 * Mọi thao tác xóa dữ liệu của PT / FM / Admin đều gọi `captureTrash(...)` NGAY
 * TRƯỚC khi xóa thật. Hàm này chụp lại bản ghi cùng toàn bộ bảng con sẽ bị
 * cascade, cất vào bảng `trash_items` dưới dạng JSON phẳng:
 *
 *     { "<tên model prisma>": [ ...dòng dữ liệu nguyên vẹn ] }
 *
 * Khôi phục = ghi lại từng bảng theo đúng thứ tự phụ thuộc (RESTORE_ORDER),
 * GIỮ NGUYÊN id cũ nên mọi khóa ngoại giữa các bảng con vẫn khớp y như trước
 * khi xóa. Cách này không cần viết riêng logic khôi phục cho từng loại dữ liệu.
 */

// ─── Kiểu dữ liệu ────────────────────────────────────────────────────────────

/** Ảnh chụp dữ liệu: tên model prisma → danh sách dòng. */
export type TrashSnapshot = Record<string, Record<string, unknown>[]>;

export type TrashActor = {
  id?: string | null;
  name?: string | null;
  role?: string | null;
};

type CaptureResult = {
  snapshot: TrashSnapshot;
  label: string;
  summary?: string | null;
  branchId?: string | null;
  branchName?: string | null;
};

type TrashTypeDef = {
  /** Tên loại dữ liệu hiển thị trong bộ lọc và danh sách. */
  label: string;
  /** Gom bản ghi gốc + các bảng con sẽ mất khi xóa. Trả null nếu không tìm thấy. */
  collect: (id: string) => Promise<CaptureResult | null>;
  /**
   * Việc cần làm SAU khi đã ghi lại các bảng — dùng để nối lại những khóa ngoại
   * bị SetNull lúc xóa (vd hồ sơ tư vấn trỏ về khách hàng).
   */
  afterRestore?: (snapshot: TrashSnapshot) => Promise<void>;
};

// ─── Thứ tự khôi phục ────────────────────────────────────────────────────────
// Bảng cha đứng trước bảng con. Key nào không có trong danh sách này sẽ bị bỏ
// qua khi khôi phục (vd `__meta` — chỗ cất id để nối lại quan hệ).

const RESTORE_ORDER = [
  "client",
  "clientPTAssignment",
  "consultation",
  "consultationInfo",
  "consultationAssessment",
  "consultationPackage",
  "packageEnrollment",
  "pTSessionAdjustment",
  "kocContract",
  "sessionPhoto",
  "workoutProgram",
  "workoutWeek",
  "workoutSession",
  "workoutMovement",
  "workoutLog",
  "workoutSetLog",
  "workoutNotification",
  "weightLog",
  "activityLog",
  "bodyMeasurementLog",
  "measurementNotification",
  "mealPlan",
  "mealPlanDay",
  "foodScanLog",
  "performanceAlert",
  "complaint",
  "substituteRequest",
  "salesLead",
  "transaction",
] as const;

// ─── Tiện ích gom dữ liệu ────────────────────────────────────────────────────

type Row = Record<string, unknown>;

const ids = (rows: Row[]): string[] => rows.map((r) => r.id as string);

/** Bỏ các mảng rỗng cho ảnh chụp gọn nhẹ. */
function compact(snapshot: TrashSnapshot): TrashSnapshot {
  const out: TrashSnapshot = {};
  for (const [k, v] of Object.entries(snapshot)) {
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Gom cây lộ trình tập: tuần → buổi → bài tập → nhật ký → set.
 * Nhận danh sách chương trình đã lấy sẵn để dùng chung cho nhiều loại dữ liệu.
 */
async function collectProgramTree(programIds: string[]): Promise<TrashSnapshot> {
  if (programIds.length === 0) return {};

  const [weeks, sessions, logs] = await Promise.all([
    prisma.workoutWeek.findMany({ where: { programId: { in: programIds } } }),
    prisma.workoutSession.findMany({ where: { programId: { in: programIds } } }),
    prisma.workoutLog.findMany({ where: { programId: { in: programIds } } }),
  ]);

  return collectSessionLeaves(weeks as Row[], sessions as Row[], logs as Row[]);
}

/** Phần đuôi chung: bài tập của buổi, set của nhật ký, thông báo của nhật ký. */
async function collectSessionLeaves(
  weeks: Row[],
  sessions: Row[],
  logs: Row[]
): Promise<TrashSnapshot> {
  const sessionIds = ids(sessions);
  const logIds = ids(logs);

  const [movements, setLogs, notifications] = await Promise.all([
    sessionIds.length
      ? prisma.workoutMovement.findMany({ where: { sessionId: { in: sessionIds } } })
      : [],
    logIds.length
      ? prisma.workoutSetLog.findMany({ where: { workoutLogId: { in: logIds } } })
      : [],
    logIds.length
      ? prisma.workoutNotification.findMany({ where: { workoutLogId: { in: logIds } } })
      : [],
  ]);

  return {
    workoutWeek: weeks,
    workoutSession: sessions,
    workoutMovement: movements as Row[],
    workoutLog: logs,
    workoutSetLog: setLogs as Row[],
    workoutNotification: notifications as Row[],
  };
}

/** Gom thực đơn + các ngày của thực đơn. */
async function collectMealPlans(where: Row): Promise<TrashSnapshot> {
  const plans = (await prisma.mealPlan.findMany({ where })) as Row[];
  if (plans.length === 0) return {};
  const days = (await prisma.mealPlanDay.findMany({
    where: { mealPlanId: { in: ids(plans) } },
  })) as Row[];
  return { mealPlan: plans, mealPlanDay: days };
}

// ─── Tiện ích sau khi khôi phục ──────────────────────────────────────────────

/**
 * Trả lại số buổi đã bị hoàn khi xóa.
 *
 * Xóa nhật ký / buổi / tuần tập sẽ gọi `reversePackageSession` để trừ lại số
 * buổi đã tính cho lộ trình lúc check-in. Khôi phục thì phải cộng ngược lên,
 * nếu không lộ trình của khách sẽ dôi ra đúng bằng số buổi vừa khôi phục.
 */
async function reapplyPackageSessions(snapshot: TrashSnapshot): Promise<void> {
  const logs = (snapshot.workoutLog ?? []).filter((l) => l.packageCounted === true);
  if (logs.length === 0) return;

  // Gom theo lộ trình để mỗi gói chỉ cần một lần cập nhật.
  const perPackage: Record<string, number> = {};
  for (const log of logs) {
    const pkgId = log.packageEnrollmentId as string | null;
    if (!pkgId) continue;
    perPackage[pkgId] = (perPackage[pkgId] ?? 0) + 1;
  }

  for (const [pkgId, count] of Object.entries(perPackage)) {
    const pkg = await prisma.packageEnrollment.findUnique({ where: { id: pkgId } });
    if (!pkg) continue;
    await prisma.packageEnrollment.update({
      where: { id: pkgId },
      data: { sessionsUsed: Math.min(pkg.sessionsUsed + count, pkg.sessions) },
    });
  }
}

// ─── Định nghĩa từng loại dữ liệu ────────────────────────────────────────────

export const TRASH_TYPES: Record<string, TrashTypeDef> = {
  CLIENT: {
    label: "Khách hàng",
    collect: async (id) => {
      const client = await prisma.client.findUnique({
        where: { id },
        include: {
          branch: { select: { id: true, name: true } },
          assignedPT: { select: { name: true } },
        },
      });
      if (!client) return null;
      const { branch, assignedPT, ...row } = client;

      const [packages, programs] = await Promise.all([
        prisma.packageEnrollment.findMany({ where: { clientId: id } }),
        prisma.workoutProgram.findMany({ where: { clientId: id } }),
      ]);

      const [
        programTree,
        mealPlans,
        adjustments,
        kocContracts,
        sessionPhotos,
        weightLogs,
        activityLogs,
        measurements,
        measurementNotifs,
        foodScanLogs,
        alerts,
        complaints,
        substitutes,
        ptAssignments,
        linkedConsultations,
      ] = await Promise.all([
        collectProgramTree(ids(programs as Row[])),
        collectMealPlans({ clientId: id }),
        packages.length
          ? prisma.pTSessionAdjustment.findMany({
              where: { enrollmentId: { in: ids(packages as Row[]) } },
            })
          : [],
        prisma.kOCContract.findMany({ where: { clientId: id } }),
        prisma.sessionPhoto.findMany({ where: { clientId: id } }),
        prisma.weightLog.findMany({ where: { clientId: id } }),
        prisma.activityLog.findMany({ where: { clientId: id } }),
        prisma.bodyMeasurementLog.findMany({ where: { clientId: id } }),
        prisma.measurementNotification.findMany({ where: { clientId: id } }),
        prisma.foodScanLog.findMany({ where: { clientId: id } }),
        prisma.performanceAlert.findMany({ where: { clientId: id } }),
        prisma.complaint.findMany({ where: { clientId: id } }),
        prisma.substituteRequest.findMany({ where: { clientId: id } }),
        prisma.clientPTAssignment.findMany({ where: { clientId: id } }),
        prisma.consultation.findMany({
          where: { convertedClientId: id },
          select: { id: true },
        }),
      ]);

      return {
        label: client.fullName,
        summary: [
          client.phone,
          assignedPT?.name ? `PT ${assignedPT.name}` : null,
          packages.length ? `${packages.length} lộ trình` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        branchId: branch?.id ?? null,
        branchName: branch?.name ?? null,
        snapshot: compact({
          client: [row as Row],
          clientPTAssignment: ptAssignments as Row[],
          packageEnrollment: packages as Row[],
          pTSessionAdjustment: adjustments as Row[],
          kocContract: kocContracts as Row[],
          sessionPhoto: sessionPhotos as Row[],
          workoutProgram: programs as Row[],
          ...programTree,
          ...mealPlans,
          weightLog: weightLogs as Row[],
          activityLog: activityLogs as Row[],
          bodyMeasurementLog: measurements as Row[],
          measurementNotification: measurementNotifs as Row[],
          foodScanLog: foodScanLogs as Row[],
          performanceAlert: alerts as Row[],
          complaint: complaints as Row[],
          substituteRequest: substitutes as Row[],
          __meta: [{ consultationIds: ids(linkedConsultations as Row[]) }],
        }),
      };
    },
    // Lúc xóa khách, `convertedClientId` của hồ sơ tư vấn bị gỡ về null — nối lại.
    afterRestore: async (snapshot) => {
      const meta = snapshot.__meta?.[0] as { consultationIds?: string[] } | undefined;
      const clientId = snapshot.client?.[0]?.id as string | undefined;
      if (!clientId || !meta?.consultationIds?.length) return;
      await prisma.consultation.updateMany({
        where: { id: { in: meta.consultationIds }, convertedClientId: null },
        data: { convertedClientId: clientId },
      });
    },
  },

  CONSULTATION: {
    label: "Hồ sơ tư vấn",
    collect: async (id) => {
      const c = await prisma.consultation.findUnique({
        where: { id },
        include: {
          info: true,
          assessment: true,
          packages: true,
          branch: { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
        },
      });
      if (!c) return null;
      const { info, assessment, packages, branch, createdBy, ...row } = c;

      const programs = (await prisma.workoutProgram.findMany({
        where: { consultationId: id },
      })) as Row[];

      const [programTree, mealPlans, linkedLeads] = await Promise.all([
        collectProgramTree(ids(programs)),
        collectMealPlans({ consultationId: id }),
        prisma.salesLead.findMany({ where: { consultationId: id }, select: { id: true } }),
      ]);

      return {
        label: info?.fullName?.trim() || "Hồ sơ tư vấn",
        summary: [info?.phone, createdBy?.name ? `NV ${createdBy.name}` : null, `Bước ${c.currentStep}`]
          .filter(Boolean)
          .join(" · "),
        branchId: branch?.id ?? null,
        branchName: branch?.name ?? null,
        snapshot: compact({
          consultation: [row as Row],
          consultationInfo: info ? [info as Row] : [],
          consultationAssessment: assessment ? [assessment as Row] : [],
          consultationPackage: packages as Row[],
          workoutProgram: programs,
          ...programTree,
          ...mealPlans,
          __meta: [{ leadIds: ids(linkedLeads as Row[]) }],
        }),
      };
    },
    // `salesLead.consultationId` bị gỡ về null khi xóa hồ sơ tư vấn — nối lại.
    afterRestore: async (snapshot) => {
      const meta = snapshot.__meta?.[0] as { leadIds?: string[] } | undefined;
      const consultationId = snapshot.consultation?.[0]?.id as string | undefined;
      if (!consultationId || !meta?.leadIds?.length) return;
      await prisma.salesLead.updateMany({
        where: { id: { in: meta.leadIds }, consultationId: null },
        data: { consultationId },
      });
    },
  },

  PACKAGE_ENROLLMENT: {
    label: "Lộ trình (gói tập)",
    collect: async (id) => {
      const pkg = await prisma.packageEnrollment.findUnique({
        where: { id },
        include: { client: { select: { fullName: true, branch: { select: { id: true, name: true } } } } },
      });
      if (!pkg) return null;
      const { client, ...row } = pkg;

      const [adjustments, koc, photos, programs] = await Promise.all([
        prisma.pTSessionAdjustment.findMany({ where: { enrollmentId: id } }),
        prisma.kOCContract.findMany({ where: { enrollmentId: id } }),
        prisma.sessionPhoto.findMany({ where: { packageEnrollmentId: id } }),
        prisma.workoutProgram.findMany({ where: { packageEnrollmentId: id }, select: { id: true } }),
      ]);

      return {
        label: `${pkg.packageName} — ${client.fullName}`,
        summary: `${pkg.sessionsUsed}/${pkg.sessions} buổi · ${pkg.status}`,
        branchId: client.branch?.id ?? null,
        branchName: client.branch?.name ?? null,
        snapshot: compact({
          packageEnrollment: [row as Row],
          pTSessionAdjustment: adjustments as Row[],
          kocContract: koc as Row[],
          sessionPhoto: photos as Row[],
          __meta: [{ programIds: ids(programs as Row[]) }],
        }),
      };
    },
    afterRestore: async (snapshot) => {
      const pkg = snapshot.packageEnrollment?.[0];
      if (!pkg) return;

      // Lộ trình tập trỏ tới gói bị gỡ về null khi xóa gói — nối lại.
      const meta = snapshot.__meta?.[0] as { programIds?: string[] } | undefined;
      if (meta?.programIds?.length) {
        await prisma.workoutProgram.updateMany({
          where: { id: { in: meta.programIds }, packageEnrollmentId: null },
          data: { packageEnrollmentId: pkg.id as string },
        });
      }

      // Số lộ trình đăng ký của khách được đếm lại sau mỗi lần thêm/xóa gói.
      await recountClientContracts(pkg.clientId as string);
    },
  },

  WORKOUT_PROGRAM: {
    label: "Chương trình tập",
    collect: async (id) => {
      const program = await prisma.workoutProgram.findUnique({
        where: { id },
        include: { client: { select: { fullName: true, branch: { select: { id: true, name: true } } } } },
      });
      if (!program) return null;
      const { client, ...row } = program;
      const tree = await collectProgramTree([id]);

      return {
        label: `Chương trình tập — ${client?.fullName ?? "—"}`,
        summary: `${program.phase} · ${program.sessionsPerWeek} buổi/tuần · ${(tree.workoutWeek ?? []).length} tuần`,
        branchId: client?.branch?.id ?? null,
        branchName: client?.branch?.name ?? null,
        snapshot: compact({ workoutProgram: [row as Row], ...tree }),
      };
    },
  },

  WORKOUT_WEEK: {
    label: "Tuần tập",
    collect: async (id) => {
      const week = await prisma.workoutWeek.findUnique({
        where: { id },
        include: {
          program: {
            select: {
              currentWeek: true,
              client: { select: { fullName: true, branch: { select: { id: true, name: true } } } },
            },
          },
        },
      });
      if (!week) return null;
      const { program, ...row } = week;

      const [sessions, logs] = await Promise.all([
        prisma.workoutSession.findMany({ where: { weekId: id } }),
        prisma.workoutLog.findMany({ where: { weekId: id } }),
      ]);
      const leaves = await collectSessionLeaves([row as Row], sessions as Row[], logs as Row[]);

      return {
        label: `Tuần ${week.weekNumber} — ${program?.client?.fullName ?? "—"}`,
        summary: `${sessions.length} buổi tập`,
        branchId: program?.client?.branch?.id ?? null,
        branchName: program?.client?.branch?.name ?? null,
        snapshot: compact({
          ...leaves,
          // Xóa tuần kéo `currentWeek` của chương trình về tuần còn lại lớn nhất
          // — nhớ mốc cũ để trả lại đúng chỗ khi khôi phục.
          __meta: [{ programId: week.programId, currentWeek: program?.currentWeek ?? null }],
        }),
      };
    },
    afterRestore: async (snapshot) => {
      const meta = snapshot.__meta?.[0] as
        | { programId?: string; currentWeek?: number | null }
        | undefined;
      if (meta?.programId && typeof meta.currentWeek === "number") {
        await prisma.workoutProgram.update({
          where: { id: meta.programId },
          data: { currentWeek: meta.currentWeek },
        });
      }
      await reapplyPackageSessions(snapshot);
    },
  },

  WORKOUT_SESSION: {
    label: "Buổi tập",
    collect: async (id) => {
      const s = await prisma.workoutSession.findUnique({
        where: { id },
        include: {
          program: {
            select: { client: { select: { fullName: true, branch: { select: { id: true, name: true } } } } },
          },
        },
      });
      if (!s) return null;
      const { program, ...row } = s;

      const logs = (await prisma.workoutLog.findMany({ where: { sessionId: id } })) as Row[];
      const leaves = await collectSessionLeaves([], [row as Row], logs);

      return {
        label: `${s.sessionName} — ${program?.client?.fullName ?? "—"}`,
        summary: logs.length ? `${logs.length} nhật ký buổi tập` : null,
        branchId: program?.client?.branch?.id ?? null,
        branchName: program?.client?.branch?.name ?? null,
        snapshot: compact(leaves),
      };
    },
    afterRestore: reapplyPackageSessions,
  },

  WORKOUT_LOG: {
    label: "Nhật ký buổi tập",
    collect: async (id) => {
      const log = await prisma.workoutLog.findUnique({
        where: { id },
        include: { client: { select: { fullName: true, branch: { select: { id: true, name: true } } } } },
      });
      if (!log) return null;
      const { client, ...row } = log;
      const leaves = await collectSessionLeaves([], [], [row as Row]);

      return {
        label: `Nhật ký buổi tập — ${client.fullName}`,
        summary: `${log.status} · ${new Date(log.sessionDate).toLocaleDateString("vi-VN")}`,
        branchId: client.branch?.id ?? null,
        branchName: client.branch?.name ?? null,
        snapshot: compact({
          workoutLog: leaves.workoutLog,
          workoutSetLog: leaves.workoutSetLog,
          workoutNotification: leaves.workoutNotification,
        }),
      };
    },
    afterRestore: reapplyPackageSessions,
  },

  WEIGHT_LOG: {
    label: "Nhật ký cân nặng",
    collect: async (id) => {
      const log = await prisma.weightLog.findUnique({
        where: { id },
        include: { client: { select: { fullName: true, branch: { select: { id: true, name: true } } } } },
      });
      if (!log) return null;
      const { client, ...row } = log;
      return {
        label: `Cân nặng ${log.weight}kg — ${client.fullName}`,
        summary: new Date(log.date).toLocaleDateString("vi-VN"),
        branchId: client.branch?.id ?? null,
        branchName: client.branch?.name ?? null,
        snapshot: { weightLog: [row as Row] },
      };
    },
    // Xóa nhật ký cân nặng kéo `currentWeight` về lần cân còn lại gần nhất —
    // khôi phục thì phải tính lại, nếu không hồ sơ khách vẫn hiển thị số cũ.
    afterRestore: async (snapshot) => {
      const clientId = snapshot.weightLog?.[0]?.clientId as string | undefined;
      if (!clientId) return;
      const latest = await prisma.weightLog.findFirst({
        where: { clientId },
        orderBy: { date: "desc" },
      });
      if (!latest) return;
      await prisma.client.update({
        where: { id: clientId },
        data: { currentWeight: latest.weight },
      });
    },
  },

  BODY_MEASUREMENT: {
    label: "Số đo cơ thể",
    collect: async (id) => {
      const log = await prisma.bodyMeasurementLog.findUnique({
        where: { id },
        include: { client: { select: { fullName: true, branch: { select: { id: true, name: true } } } } },
      });
      if (!log) return null;
      const { client, ...row } = log;
      return {
        label: `Số đo — ${client.fullName}`,
        summary: new Date(log.measuredDate).toLocaleDateString("vi-VN"),
        branchId: client.branch?.id ?? null,
        branchName: client.branch?.name ?? null,
        snapshot: { bodyMeasurementLog: [row as Row] },
      };
    },
  },

  SALES_LEAD: {
    label: "Data khách (Setup doanh số)",
    collect: async (id) => {
      const lead = await prisma.salesLead.findUnique({
        where: { id },
        include: {
          branch: { select: { id: true, name: true } },
          assignedPT: { select: { name: true } },
        },
      });
      if (!lead) return null;
      const { branch, assignedPT, ...row } = lead;

      // Dòng thu chi sinh tự động từ lead cũng bị xóa theo — cất lại luôn.
      const transactions = (await prisma.transaction.findMany({
        where: { referenceId: id },
      })) as Row[];

      return {
        label: lead.customerName,
        summary: [lead.phone, assignedPT?.name ? `PT ${assignedPT.name}` : null, `${lead.month}/${lead.year}`]
          .filter(Boolean)
          .join(" · "),
        branchId: branch?.id ?? null,
        branchName: branch?.name ?? null,
        snapshot: compact({ salesLead: [row as Row], transaction: transactions }),
      };
    },
  },

  TRANSACTION: {
    label: "Phiếu thu chi",
    collect: async (id) => {
      const tx = await prisma.transaction.findUnique({
        where: { id },
        include: { branch: { select: { id: true, name: true } } },
      });
      if (!tx) return null;
      const { branch, ...row } = tx;
      return {
        label: `${tx.type === "INCOME" ? "Thu" : "Chi"} ${tx.amount.toLocaleString("vi-VN")}đ — ${tx.category}`,
        summary: tx.description ?? null,
        branchId: branch?.id ?? null,
        branchName: branch?.name ?? null,
        snapshot: { transaction: [row as Row] },
      };
    },
  },

  STAFF: {
    label: "Nhân sự",
    collect: async (id) => {
      const user = await prisma.user.findUnique({
        where: { id },
        include: { branch: { select: { id: true, name: true } } },
      });
      if (!user) return null;
      return {
        label: user.name ?? user.email,
        summary: `${user.role} · ${user.email}`,
        branchId: user.branch?.id ?? null,
        branchName: user.branch?.name ?? null,
        // Nhân sự chỉ bị "xóa mềm" (đặt deletedAt + đổi email) nên chỉ cần cất
        // lại email gốc để khôi phục — xem restoreTrashItem.
        snapshot: { __meta: [{ userId: user.id, email: user.email }] },
      };
    },
    afterRestore: async (snapshot) => {
      const meta = snapshot.__meta?.[0] as { userId?: string; email?: string } | undefined;
      if (!meta?.userId || !meta.email) return;
      await prisma.user.update({
        where: { id: meta.userId },
        data: { deletedAt: null, email: meta.email },
      });
    },
  },
};

export type TrashTypeKey = keyof typeof TRASH_TYPES;

/** Danh sách loại dữ liệu cho bộ lọc ở giao diện. */
export const TRASH_TYPE_OPTIONS = Object.entries(TRASH_TYPES).map(([value, def]) => ({
  value,
  label: def.label,
}));

// ─── Ghi vào thùng rác ───────────────────────────────────────────────────────

/**
 * Chụp lại bản ghi trước khi xóa. Gọi NGAY TRƯỚC lệnh xóa thật.
 *
 * Không bao giờ ném lỗi: thùng rác là lớp an toàn phụ, hỏng thùng rác không
 * được phép chặn thao tác xóa mà nhân sự vừa yêu cầu — lỗi chỉ ghi log.
 */
/**
 * Ngưỡng an toàn cho một dòng thùng rác. Nhật ký buổi tập mang chữ ký và ảnh
 * chụp cùng khách dưới dạng data URL, nên hồ sơ khách tập lâu năm có thể phình
 * lên hàng chục MB — quá ngưỡng thì bỏ phần ảnh để vẫn cất được dữ liệu chữ
 * (nhật ký, số buổi, set tập) thay vì mất trắng cả bản ghi.
 */
const MAX_PAYLOAD_BYTES = 30 * 1024 * 1024;

const HEAVY_LOG_FIELDS = ["signatureUrl", "checkInSignatureUrl", "checkOutPhotoUrl"] as const;

function serializeSnapshot(snapshot: TrashSnapshot): { payload: string; trimmed: boolean } {
  const full = JSON.stringify(snapshot);
  if (Buffer.byteLength(full, "utf8") <= MAX_PAYLOAD_BYTES) {
    return { payload: full, trimmed: false };
  }

  const lean: TrashSnapshot = { ...snapshot };
  if (lean.workoutLog) {
    lean.workoutLog = lean.workoutLog.map((log) => {
      const copy = { ...log };
      for (const field of HEAVY_LOG_FIELDS) copy[field] = null;
      return copy;
    });
  }
  return { payload: JSON.stringify(lean), trimmed: true };
}

export async function captureTrash(
  entityType: string,
  entityId: string,
  actor: TrashActor
): Promise<void> {
  try {
    const def = TRASH_TYPES[entityType];
    if (!def) return;

    const collected = await def.collect(entityId);
    if (!collected) return;

    const { payload, trimmed } = serializeSnapshot(collected.snapshot);
    const summary = [collected.summary, trimmed ? "(đã lược ảnh ký/chụp buổi tập)" : null]
      .filter(Boolean)
      .join(" ");

    await prisma.trashItem.create({
      data: {
        entityType,
        entityId,
        label: collected.label.slice(0, 300),
        summary: summary.slice(0, 500) || null,
        payload,
        branchId: collected.branchId ?? null,
        branchName: collected.branchName ?? null,
        deletedById: actor.id ?? null,
        deletedByName: actor.name ?? null,
        deletedByRole: actor.role ?? null,
      },
    });
  } catch (err) {
    console.error(`[trash] Không chụp được ${entityType}/${entityId}`, err);
  }
}

/** Chụp nhiều bản ghi cùng loại (xóa hàng loạt). */
export async function captureTrashMany(
  entityType: string,
  entityIds: string[],
  actor: TrashActor
): Promise<void> {
  for (const id of entityIds) {
    await captureTrash(entityType, id, actor);
  }
}

// ─── Khôi phục ───────────────────────────────────────────────────────────────

export type RestoreResult = { ok: true; restored: number } | { ok: false; error: string };

/**
 * Ghi lại toàn bộ ảnh chụp vào database rồi xóa dòng thùng rác.
 * Giữ nguyên id cũ nên quan hệ giữa các bảng con được nối lại y như trước.
 */
export async function restoreTrashItem(itemId: string): Promise<RestoreResult> {
  const item = await prisma.trashItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, error: "Không tìm thấy dữ liệu trong thùng rác" };

  const def = TRASH_TYPES[item.entityType];
  if (!def) return { ok: false, error: "Loại dữ liệu không còn được hỗ trợ khôi phục" };

  let snapshot: TrashSnapshot;
  try {
    snapshot = JSON.parse(item.payload) as TrashSnapshot;
  } catch {
    return { ok: false, error: "Dữ liệu sao lưu bị hỏng, không thể khôi phục" };
  }

  let restored = 0;
  try {
    await prisma.$transaction(async (tx) => {
      for (const model of RESTORE_ORDER) {
        const rows = snapshot[model];
        if (!rows || rows.length === 0) continue;
        const created = await (
          tx as unknown as Record<
            string,
            { createMany: (a: unknown) => Promise<{ count: number }> }
          >
        )[model].createMany({ data: rows, skipDuplicates: true });
        restored += created.count;
      }
    });
  } catch (err) {
    console.error("[trash] Khôi phục thất bại", err);
    return {
      ok: false,
      error:
        "Không thể khôi phục — dữ liệu liên quan (cơ sở, nhân sự phụ trách...) có thể đã bị xóa.",
    };
  }

  if (def.afterRestore) {
    try {
      await def.afterRestore(snapshot);
    } catch (err) {
      // Bản ghi chính đã về chỗ cũ; chỉ vài liên kết phụ chưa nối được.
      console.error("[trash] Nối lại liên kết sau khôi phục thất bại", err);
    }
  }

  await prisma.trashItem.delete({ where: { id: itemId } });
  return { ok: true, restored };
}

// ─── Tự động dọn ─────────────────────────────────────────────────────────────

/** Số ngày giữ dữ liệu trong thùng rác (0 = giữ mãi). */
export async function getTrashRetentionDays(): Promise<number> {
  const config = await prisma.systemConfig.findUnique({ where: { id: "main" } });
  return config?.trashRetentionDays ?? 30;
}

/** Xóa vĩnh viễn các bản ghi đã quá hạn giữ. Trả về số dòng đã dọn. */
export async function purgeExpiredTrash(): Promise<number> {
  const days = await getTrashRetentionDays();
  if (days <= 0) return 0; // giữ mãi

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { count } = await prisma.trashItem.deleteMany({ where: { deletedAt: { lt: cutoff } } });
  return count;
}
