import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientDetailPage } from "@/components/dashboard/client-detail-page";

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

  let client, branches, staff, enrollments, programs, workoutLogs, mealPlans, activityLogs;
  try {
    [client, branches, staff, enrollments, programs, workoutLogs, mealPlans, activityLogs] = await Promise.all([
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
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }).catch((e) => { console.error("staff query failed:", e); return []; }),
      prisma.$queryRawUnsafe<{
        id: string; client_id: string; contract_code: string | null;
        package_name: string; package_stage: string; sessions: bigint; sessions_used: bigint;
        start_date: Date | null; end_date: Date | null; duration_days: bigint;
        reserved_days: bigint; extension_days: bigint; price: number;
        contract_type: string; status: string; notes: string | null; created_at: Date;
      }[]>(
        `SELECT id, client_id, contract_code, package_name, package_stage, sessions, sessions_used,
                start_date, end_date, duration_days, reserved_days, extension_days, price,
                contract_type, status, notes, created_at
         FROM package_enrollments WHERE client_id = $1 ORDER BY created_at ASC`,
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

  if (!isAdmin) {
    if (isFM) {
      if (!managedBranchIds.includes(client.branchId)) redirect("/dashboard/clients");
    } else {
      if (client.assignedPTId !== session.user.id) redirect("/dashboard/clients");
    }
  }

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
    id: string; client_id: string; contract_code: string | null;
    package_name: string; package_stage: string; sessions: bigint; sessions_used: bigint;
    start_date: Date | null; end_date: Date | null; duration_days: bigint;
    reserved_days: bigint; extension_days: bigint; price: number;
    contract_type: string; status: string; notes: string | null; created_at: Date;
  };
  const serializedPackages = (enrollments as EnrollmentRaw[]).map((p) => ({
    id: p.id,
    packageName: p.package_name,
    packageStage: p.package_stage,
    sessions: Number(p.sessions),
    sessionsUsed: Number(p.sessions_used),
    startDate: p.start_date?.toISOString() ?? null,
    endDate: p.end_date?.toISOString() ?? null,
    durationDays: Number(p.duration_days),
    reservedDays: Number(p.reserved_days),
    extensionDays: Number(p.extension_days),
    price: Number(p.price),
    status: p.status as "ACTIVE" | "COMPLETED" | "PAUSED" | "EXPIRED",
    notes: p.notes,
    contractCode: p.contract_code ?? null,
    createdAt: p.created_at.toISOString(),
    contractType: (p.contract_type ?? "NORMAL") as "NORMAL" | "KOC" | "KOL",
  }));

  const serializedPrograms = programs.map((p) => ({
    id: p.id,
    phase: p.phase,
    workoutType: p.workoutType ?? null,
    sessionsPerWeek: p.sessionsPerWeek,
    currentWeek: p.currentWeek,
    notes: p.notes,
    status: p.status as "ACTIVE" | "ARCHIVED",
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
    />
  );
}
