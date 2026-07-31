import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientDetailPage } from "@/components/dashboard/client-detail-page";
import { ensureClientPhaseProgression } from "@/lib/phase-progression";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: { id: string } }) {
  console.log("CLIENT PAGE LOADED, id:", params.id);
  console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);
  console.log("NEXTAUTH_SECRET exists:", !!process.env.NEXTAUTH_SECRET);

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  console.log("Session user:", session.user.id, "role:", session.user.role);

  const weekInclude = {
    orderBy: { weekNumber: "asc" as const },
    include: {
      sessions: {
        orderBy: { order: "asc" as const },
        include: { movements: { orderBy: { order: "asc" as const } } },
      },
    },
  };

  // Tự động cập nhật tiến trình giai đoạn (mở khoá/lưu trữ/tạo CT giai đoạn kế)
  // trước khi đọc danh sách chương trình, để dữ liệu hiển thị luôn đúng.
  await ensureClientPhaseProgression(params.id);

  let client, branches, staff, enrollments, programs, workoutLogs, mealPlans, activityLogs, sysConfig;
  try {
    [client, branches, staff, enrollments, programs, workoutLogs, mealPlans, activityLogs, sysConfig] = await Promise.all([
      prisma.client.findUnique({
        where: { id: params.id },
        include: {
          assignedPT: { select: { id: true, name: true, email: true } },
          branch: { select: { id: true, name: true } },
          weightLogs: { orderBy: { date: "asc" } },
        },
      }).catch((e) => { console.error("client query failed:", e); return null; }),
      prisma.branch.findMany({ orderBy: { name: "asc" } })
        .catch((e) => { console.error("branches query failed:", e); return []; }),
      prisma.user.findMany({
        // CEO_FITPARTNER/COO are top management, not gym staff — exclude them so
        // they never show up as a "Nhân sự phụ trách" (assigned/substitute PT).
        where: { deletedAt: null, role: { notIn: ["CEO_FITPARTNER", "COO"] as Role[] } },
        select: { id: true, name: true, email: true, branchId: true, role: true },
        orderBy: { name: "asc" },
      }).catch((e) => { console.error("staff query failed:", e); return []; }),
      prisma.$queryRawUnsafe<{
        id: string; clientId: string; contractCode: string | null;
        packageName: string; packageStage: string; sessions: bigint; sessionsUsed: bigint;
        startDate: Date | null; endDate: Date | null; durationDays: bigint;
        reservedDays: bigint; extensionDays: bigint; price: number;
        contractType: string; status: string; notes: string | null; createdAt: Date;
      }[]>(
        `SELECT id, "clientId", "contractCode", "packageName", "packageStage", sessions, "sessionsUsed",
                "startDate", "endDate", "durationDays", "reservedDays", "extensionDays", price,
                "contractType", status, notes, "createdAt"
         FROM package_enrollments WHERE "clientId" = $1 ORDER BY "createdAt" ASC`,
        params.id
      ).catch((e) => { console.error("enrollments query failed:", e); return []; }),
      prisma.workoutProgram.findMany({
        where: { clientId: params.id },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          packageEnrollment: { select: { id: true, packageName: true } },
          weeks: weekInclude,
          sessions: {
            where: { weekId: null },
            orderBy: { order: "asc" },
            include: { movements: { orderBy: { order: "asc" } } },
          },
        },
        orderBy: { createdAt: "desc" },
      }).catch((e) => { console.error("programs query failed:", e); return []; }),
      prisma.workoutLog.findMany({
        where: { clientId: params.id },
        include: {
          setLogs: { orderBy: { id: "asc" } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { sessionDate: "desc" },
      }).catch((e) => { console.error("workoutLogs query failed:", e); return []; }),
      prisma.mealPlan.findMany({
        where: { clientId: params.id },
        include: { days: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
      }).catch((e) => { console.error("mealPlans query failed:", e); return []; }),
      prisma.activityLog.findMany({
        where: { clientId: params.id },
        orderBy: { date: "desc" },
        take: 30,
      }).catch((e) => { console.error("activityLogs query failed:", e); return []; }),
      prisma.systemConfig.findUnique({ where: { id: "main" } })
        .catch(() => null),
    ]);
    console.log("Data fetched OK. client found:", !!client);
  } catch (error) {
    console.error("CLIENT PAGE ERROR fetching data:", error);
    throw error;
  }

  if (!client) notFound();

  const isAdmin = session.user.role === "ADMIN";
  const isFM = session.user.role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  // Check if current user is an active substitute for this client
  let isSubstitute = false;
  if (!isAdmin && !isFM && client.assignedPTId !== session.user.id) {
    const subReq = await prisma.substituteRequest.findFirst({
      where: {
        clientId: params.id,
        substituteId: session.user.id,
        status: "ACTIVE",
        OR: [{ type: "LONG_TERM" }, { endDate: { gt: new Date() } }],
      },
    });
    isSubstitute = !!subReq;
  }

  if (!isAdmin) {
    if (isFM) {
      if (!managedBranchIds.includes(client.branchId)) redirect("/dashboard/clients");
    } else {
      if (client.assignedPTId !== session.user.id && !isSubstitute) redirect("/dashboard/clients");
    }
  }

  // Quyền bỏ qua rào số tuần của tiến trình giai đoạn (mở khóa sớm giai đoạn kế).
  // Admin: mọi khách. FM: khách thuộc cơ sở mình quản lý — gồm khách của chính FM
  // và khách của các PT dưới quyền. PT: không có quyền.
  const canBypassPhase = isAdmin || (isFM && managedBranchIds.includes(client.branchId));

  const serialized = {
    id: client.id,
    clientCode: client.clientCode ?? null,
    fullName: client.fullName,
    phone: client.phone,
    email: client.email ?? null,
    passwordSetAt: client.passwordSetAt?.toISOString() ?? null,
    dateOfBirth: client.dateOfBirth?.toISOString() ?? null,
    initialWeight: client.initialWeight,
    currentWeight: client.currentWeight,
    targetWeight: client.targetWeight,
    height: client.height,
    initialWaist: client.initialWaist,
    initialHip: client.initialHip,
    healthConditions: client.healthConditions,
    injuries: client.injuries,
    targetDate: client.targetDate?.toISOString() ?? null,
    goalNote: client.goalNote,
    myPlateImageUrl: client.myPlateImageUrl ?? null,
    myPlateNote: client.myPlateNote ?? null,
    avatarUrl: client.avatarUrl ?? null,
    dietPhase: client.dietPhase,
    status: client.status,
    createdAt: client.createdAt.toISOString(),
    assignedPT: client.assignedPT,
    branch: client.branch,
    weightLogs: client.weightLogs.map((log) => ({
      id: log.id,
      date: log.date.toISOString(),
      weight: log.weight,
      note: log.note,
    })),
  };

  type EnrollmentRaw = {
    id: string; clientId: string; contractCode: string | null;
    packageName: string; packageStage: string; sessions: bigint; sessionsUsed: bigint;
    startDate: Date | null; endDate: Date | null; durationDays: bigint;
    reservedDays: bigint; extensionDays: bigint; price: number;
    contractType: string; status: string; notes: string | null; createdAt: Date;
  };
  const now = new Date();
  const serializedPackages = (enrollments as EnrollmentRaw[]).map((p) => {
    const isAutoExpired = p.status === "ACTIVE" && p.endDate !== null && p.endDate < now;
    return {
      id: p.id,
      packageName: p.packageName,
      packageStage: p.packageStage,
      sessions: Number(p.sessions),
      sessionsUsed: Number(p.sessionsUsed),
      startDate: p.startDate?.toISOString() ?? null,
      endDate: p.endDate?.toISOString() ?? null,
      durationDays: Number(p.durationDays),
      reservedDays: Number(p.reservedDays),
      extensionDays: Number(p.extensionDays),
      price: Number(p.price),
      status: (isAutoExpired ? "EXPIRED" : p.status) as "ACTIVE" | "COMPLETED" | "PAUSED" | "EXPIRED",
      notes: p.notes,
      contractCode: p.contractCode ?? null,
      createdAt: p.createdAt.toISOString(),
      contractType: (p.contractType ?? "NORMAL") as "NORMAL" | "KOC" | "KOL",
    };
  });

  const serializedPrograms = programs.map((p) => ({
    id: p.id,
    phase: p.phase,
    phaseId: p.phaseId ?? null,
    workoutType: p.workoutType ?? null,
    sessionsPerWeek: p.sessionsPerWeek,
    currentWeek: p.currentWeek,
    notes: p.notes,
    status: p.status as "ACTIVE" | "ARCHIVED" | "LOCKED",
    manualPhaseOverride: p.manualPhaseOverride,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    createdBy: p.createdBy,
    packageEnrollment: p.packageEnrollment,
    weeks: p.weeks.map((w) => ({
      id: w.id,
      weekNumber: w.weekNumber,
      notes: w.notes,
      sessions: w.sessions.map((s) => ({
        id: s.id,
        sessionName: s.sessionName,
        order: s.order,
        movements: s.movements.map((m) => ({
          id: m.id,
          movementCode: m.movementCode,
          movementName: m.movementName,
          selectedExercise: m.selectedExercise,
          sets: m.sets,
          reps: m.reps,
          order: m.order,
        })),
      })),
    })),
    sessions: p.sessions.map((s) => ({
      id: s.id,
      sessionName: s.sessionName,
      order: s.order,
      movements: s.movements.map((m) => ({
        id: m.id,
        movementCode: m.movementCode,
        movementName: m.movementName,
        selectedExercise: m.selectedExercise,
        sets: m.sets,
        reps: m.reps,
        order: m.order,
      })),
    })),
  }));

  const serializedLogs = workoutLogs.map((l) => ({
    id: l.id,
    sessionId: l.sessionId,
    weekId: l.weekId,
    programId: l.programId,
    sessionDate: l.sessionDate.toISOString(),
    notes: l.notes,
    createdBy: l.createdBy,
    createdAt: l.createdAt.toISOString(),
    setLogs: l.setLogs,
    status: l.status,
    checkInAt: l.checkInAt?.toISOString() ?? null,
    checkOutAt: l.checkOutAt?.toISOString() ?? null,
    firstInteractionAt: l.firstInteractionAt?.toISOString() ?? null,
    signatureUrl: l.signatureUrl,
    earlyEndApprovedAt: l.earlyEndApprovedAt?.toISOString() ?? null,
    confirmationMethod: l.confirmationMethod,
    confirmedAt: l.confirmedAt?.toISOString() ?? null,
  }));

  return (
    <ClientDetailPage
      client={serialized}
      branches={branches}
      staffList={staff}
      packages={serializedPackages}
      workoutPrograms={serializedPrograms}
      workoutLogs={serializedLogs}
      mealPlans={mealPlans.map((p) => ({
        id: p.id,
        tdee: p.tdee,
        der: p.der,
        protein: p.protein,
        fat: p.fat,
        carbs: p.carbs,
        mealsPerDay: p.mealsPerDay,
        likes: p.likes,
        dislikes: p.dislikes,
        status: p.status as "ACTIVE" | "ARCHIVED",
        createdAt: p.createdAt.toISOString(),
        days: p.days.map((d) => {
          let meals = [];
          try { meals = JSON.parse(d.meals); } catch { meals = []; }
          return {
            id: d.id,
            dayLabel: d.dayLabel,
            meals,
            totalCalories: d.totalCalories,
            totalProtein: d.totalProtein,
            totalFat: d.totalFat,
            totalCarbs: d.totalCarbs,
          };
        }),
      }))}
      activityLogs={activityLogs.map((l) => ({
        id: l.id,
        date: l.date.toISOString(),
        steps: l.steps,
        minutesActive: l.minutesActive,
        note: l.note,
      }))}
      userRole={session.user.role}
      currentUserId={session.user.id}
      isSubstitute={isSubstitute}
      canBypassPhase={canBypassPhase}
      enableLevelSystem={sysConfig?.enableLevelSystem ?? true}
      minSessionMinutes={sysConfig?.minSessionMinutes ?? 30}
    />
  );
}
