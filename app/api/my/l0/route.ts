import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import {
  L0_PHASE_PREFIX,
  buildFaultHistory,
  disallowedL0Exercises,
  faultCount,
  isL0AllowedExercise,
  l0DayOf,
  l0FaultsVisibleToClient,
  type L0Day,
} from "@/lib/l0-program";

// Lộ trình L0 trên app khách.
//   GET — tiến độ 4 buổi, buổi 3 khách tự soạn, và tổng kết lỗi kỹ thuật (CHỈ
//         khi đã xong Buổi 4: Buổi 1–3 PT không nói lỗi với khách).
//   PUT — khách lưu buổi tự thiết kế vào buổi "Ngày 3" của giáo án.

const MAX_EXERCISES = 12;

async function loadL0(clientId: string) {
  const programs = await prisma.workoutProgram.findMany({
    where: { clientId, phase: { startsWith: L0_PHASE_PREFIX } },
    orderBy: { createdAt: "desc" },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          sessions: {
            orderBy: { order: "asc" },
            include: { movements: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });
  const program = programs.find((p) => p.status === "ACTIVE") ?? programs[0] ?? null;
  if (!program) return null;

  const logs = await prisma.workoutLog.findMany({
    where: { programId: program.id, status: { in: ["COMPLETED", "IN_PROGRESS"] } },
    orderBy: { sessionDate: "asc" },
    select: {
      id: true,
      status: true,
      sessionId: true,
      sessionDate: true,
      session: { select: { sessionName: true } },
      setLogs: { select: { movementName: true, exerciseName: true, faults: true } },
    },
  });
  return { program, logs };
}

export async function GET() {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await loadL0(session.user.id);
  if (!data) return NextResponse.json(null);
  const { program, logs } = data;

  const dayLogs = logs
    .map((l) => ({ ...l, day: l0DayOf(program.phase, l.session.sessionName) }))
    .filter((l): l is typeof l & { day: L0Day } => l.day != null);
  const completed = dayLogs.filter((l) => l.status === "COMPLETED");
  const completedDays = Array.from(new Set(completed.map((l) => l.day))).sort();
  const lastDateOf = (d: L0Day) =>
    completed.filter((l) => l.day === d).map((l) => l.sessionDate).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  // Buổi "Ngày 3" đầu tiên chưa tập xong — nơi khách soạn buổi tự tập.
  const completedSessionIds = new Set(completed.map((l) => l.sessionId));
  const day3Session = program.weeks
    .flatMap((w) => w.sessions)
    .find((s) => l0DayOf(program.phase, s.sessionName) === 3 && !completedSessionIds.has(s.id)) ?? null;

  // Bài khách được chọn khi tự soạn: CHỈ danh sách cố định của gói L0 (lấy tên
  // thật ở Kho bài tập). Bài đã học ở Buổi 1–2 xếp lên đầu.
  const learned = new Set(
    completed
      .filter((l) => l.day <= 2)
      .flatMap((l) => l.setLogs.map((sl) => sl.exerciseName.trim()))
      .filter(Boolean)
  );
  const library = await prisma.workoutExercise.findMany({
    where: { phase: { startsWith: L0_PHASE_PREFIX } },
    distinct: ["name"],
    select: { name: true },
    orderBy: { name: "asc" },
  });
  const allowed = library.map((e) => e.name).filter(isL0AllowedExercise);
  const choices = [...allowed.filter((n) => learned.has(n)), ...allowed.filter((n) => !learned.has(n))];

  let summary = null;
  if (l0FaultsVisibleToClient(completedDays)) {
    const history = buildFaultHistory(
      completed.map((l) => ({ day: l.day, date: l.sessionDate, setLogs: l.setLogs }))
    );
    const firstLogOf = (d: L0Day) => completed.find((l) => l.day === d) ?? null;
    const lastLogOf = (d: L0Day) => [...completed].reverse().find((l) => l.day === d) ?? null;
    const d1 = firstLogOf(1);
    const d4 = lastLogOf(4);
    summary = {
      faultsDay1: d1 ? faultCount(d1.setLogs) : null,
      faultsDay4: d4 ? faultCount(d4.setLogs) : null,
      exercises: history
        .map((h) => {
          const days = (Object.keys(h.byDay).map(Number) as L0Day[]).sort();
          const first = h.byDay[days[0]] ?? [];
          const last = h.byDay[days[days.length - 1]] ?? [];
          const reviewed = days.length > 1;
          return {
            key: h.guide.key,
            title: h.exerciseName.replace(/\s*\(.*$/, "") || h.guide.title,
            fixed: reviewed ? first.filter((f) => !last.includes(f)).map((f) => h.guide.faults[f - 1]?.title ?? "") : [],
            remaining: last.map((f) => ({ title: h.guide.faults[f - 1]?.title ?? "", fix: h.guide.faults[f - 1]?.fix ?? "" })),
          };
        })
        .filter((e) => e.fixed.length > 0 || e.remaining.length > 0),
    };
  }

  return NextResponse.json({
    programStatus: program.status,
    days: ([1, 2, 3, 4] as L0Day[]).map((d) => ({
      day: d,
      done: completedDays.includes(d),
      inProgress: dayLogs.some((l) => l.day === d && l.status === "IN_PROGRESS"),
      date: lastDateOf(d)?.toISOString() ?? null,
    })),
    design: day3Session
      ? {
          sessionId: day3Session.id,
          exercises: day3Session.movements
            .filter((m) => m.selectedExercise.trim())
            .map((m) => ({ name: m.selectedExercise, sets: m.sets, reps: m.reps, load: m.plannedLoad ?? "" })),
        }
      : null,
    choices,
    summary,
  });
}

type DesignInput = { name?: unknown; sets?: unknown; reps?: unknown; load?: unknown };

export async function PUT(req: Request) {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { sessionId?: string; exercises?: DesignInput[] } | null;
  if (!body?.sessionId || !Array.isArray(body.exercises)) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const exercises = body.exercises
    .map((e) => ({
      name: String(e.name ?? "").trim().slice(0, 150),
      sets: Math.min(6, Math.max(1, Math.round(Number(e.sets) || 3))),
      reps: String(e.reps ?? "").trim().slice(0, 30) || "12-15",
      load: String(e.load ?? "").trim().slice(0, 30),
    }))
    .filter((e) => e.name);
  if (exercises.length === 0) {
    return NextResponse.json({ error: "Chị thêm ít nhất 1 bài tập nhé" }, { status: 400 });
  }
  const bad = disallowedL0Exercises(exercises.map((e) => e.name));
  if (bad.length > 0) {
    return NextResponse.json(
      { error: `Buổi tự tập chỉ chọn các bài trong danh sách L0. Chị đổi lại: ${bad.join(", ")}` },
      { status: 400 }
    );
  }
  if (exercises.length > MAX_EXERCISES) {
    return NextResponse.json({ error: `Tối đa ${MAX_EXERCISES} bài trong một buổi` }, { status: 400 });
  }

  const target = await prisma.workoutSession.findFirst({
    where: { id: body.sessionId, program: { clientId: session.user.id, phase: { startsWith: L0_PHASE_PREFIX } } },
    select: { id: true, sessionName: true, program: { select: { phase: true } } },
  });
  if (!target || l0DayOf(target.program.phase, target.sessionName) !== 3) {
    return NextResponse.json({ error: "Không tìm thấy buổi tự tập" }, { status: 404 });
  }
  const done = await prisma.workoutLog.count({ where: { sessionId: target.id, status: "COMPLETED" } });
  if (done > 0) {
    return NextResponse.json({ error: "Buổi tự tập đã hoàn thành, không sửa được nữa" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.workoutMovement.deleteMany({ where: { sessionId: target.id } }),
    prisma.workoutMovement.createMany({
      data: exercises.map((e, i) => ({
        sessionId: target.id,
        movementCode: `Bài ${i + 1}`,
        movementName: `Bài ${i + 1}`,
        selectedExercise: e.name,
        sets: e.sets,
        reps: e.reps,
        order: i,
        plannedLoad: e.load || null,
      })),
    }),
  ]);

  return NextResponse.json({ ok: true, count: exercises.length });
}
