import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { vnMonthStart } from "@/lib/format-date";
import { TRIAL_PACKAGE } from "@/lib/packages";
import { L0_PHASE_PREFIX, buildFaultHistory, l0DayOf, oldFaultRecurrence, type L0Day } from "@/lib/l0-program";
import { isSatisfied } from "@/lib/session-rating";
import { monthYearParams, statsBranchIds } from "@/lib/stats-scope";

// GET /api/dashboard/l0?month=&year=&branchId=
//
// "Phiếu đánh giá FM" của lộ trình L0, tự điền từ dữ liệu — FM không phải ghi
// tay. Nhóm khách = gói L0 BẮT ĐẦU trong tháng (giờ VN; gói chưa có ngày bắt
// đầu thì lấy ngày tạo). Mỗi khách:
//   • Hoàn thành Buổi 1–4   — có nhật ký COMPLETED ở buổi "Ngày N" của giáo án
//                              Giai đoạn 0
//   • Hài lòng              — điểm khách tự chấm trên app (≥ 4 sao)
//   • Lỗi cũ còn lặp lại    — lỗi đã tick ở Buổi 1–3 bị tick lại ở Buổi 4
//   • Đăng ký lộ trình      — có gói khác L0 tạo từ ngày mua L0 trở đi (Hậu L0)

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const branchIds = await statsBranchIds(session.user, new URL(req.url).searchParams.get("branchId"));
  if (!branchIds) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { month, year } = monthYearParams(req.url);
  const from = vnMonthStart(year, month);
  const to = vnMonthStart(year, month + 1);

  const enrollments = await prisma.packageEnrollment.findMany({
    where: {
      packageName: TRIAL_PACKAGE,
      client: { branchId: { in: branchIds } },
      OR: [
        { startDate: { gte: from, lt: to } },
        { startDate: null, createdAt: { gte: from, lt: to } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      clientId: true,
      createdAt: true,
      startDate: true,
      refunded: true,
      client: {
        select: {
          fullName: true,
          assignedPTId: true,
          assignedPT: { select: { name: true, email: true } },
          branch: { select: { name: true } },
        },
      },
    },
  });
  // Một khách mua L0 hai lần trong tháng (hiếm) → tính một lần, gói đầu.
  const seen = new Set<string>();
  const cohort = enrollments.filter((e) => (seen.has(e.clientId) ? false : (seen.add(e.clientId), true)));
  const clientIds = cohort.map((e) => e.clientId);

  const [logs, laterPackages] = clientIds.length
    ? await Promise.all([
        prisma.workoutLog.findMany({
          where: { clientId: { in: clientIds }, status: "COMPLETED", program: { phase: { startsWith: L0_PHASE_PREFIX } } },
          orderBy: { sessionDate: "asc" },
          select: {
            clientId: true,
            sessionDate: true,
            program: { select: { phase: true } },
            session: { select: { sessionName: true } },
            setLogs: { select: { movementName: true, exerciseName: true, faults: true } },
            rating: { select: { score: true, comment: true } },
          },
        }),
        prisma.packageEnrollment.findMany({
          where: { clientId: { in: clientIds }, packageName: { not: TRIAL_PACKAGE } },
          select: { clientId: true, packageName: true, createdAt: true },
        }),
      ])
    : [[], []];

  const rows = cohort.map((e) => {
    const mine = logs
      .filter((l) => l.clientId === e.clientId)
      .map((l) => ({ ...l, day: l0DayOf(l.program.phase, l.session.sessionName) }))
      .filter((l): l is typeof l & { day: L0Day } => l.day != null);
    const days = ([1, 2, 3, 4] as L0Day[]).map((d) => {
      const ofDay = mine.filter((l) => l.day === d);
      const last = ofDay[ofDay.length - 1];
      const rated = ofDay.find((l) => l.rating)?.rating ?? null;
      return {
        day: d,
        done: ofDay.length > 0,
        date: last ? last.sessionDate.toISOString() : null,
        score: rated?.score ?? null,
        comment: rated?.comment ?? null,
      };
    });
    const recurrence = oldFaultRecurrence(
      buildFaultHistory(mine.map((l) => ({ day: l.day, date: l.sessionDate, setLogs: l.setLogs })))
    );
    const next = laterPackages
      .filter((p) => p.clientId === e.clientId && p.createdAt >= e.createdAt)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    return {
      clientId: e.clientId,
      clientName: e.client.fullName,
      ptId: e.client.assignedPTId,
      ptName: e.client.assignedPT.name ?? e.client.assignedPT.email,
      branchName: e.client.branch.name,
      startDate: (e.startDate ?? e.createdAt).toISOString(),
      refunded: e.refunded,
      days,
      recurrence,
      registeredPackage: next?.packageName ?? null,
    };
  });

  type Row = (typeof rows)[number];
  const aggregate = (list: Row[]) => {
    const done = [1, 2, 3, 4].map((d) => list.filter((r) => r.days[d - 1].done).length);
    const scores = list.flatMap((r) => r.days.map((d) => d.score).filter((s): s is number => s != null));
    const rec = list.reduce(
      (a, r) => (r.recurrence ? { old: a.old + r.recurrence.old, recurred: a.recurred + r.recurrence.recurred } : a),
      { old: 0, recurred: 0 }
    );
    return {
      clients: list.length,
      done,
      rated: scores.length,
      satisfied: scores.filter(isSatisfied).length,
      oldFaults: rec.old,
      recurredFaults: rec.recurred,
      registered: list.filter((r) => r.registeredPackage).length,
    };
  };

  const byPt = new Map<string, Row[]>();
  for (const r of rows) byPt.set(r.ptId, [...(byPt.get(r.ptId) ?? []), r]);

  return NextResponse.json({
    total: aggregate(rows),
    byPt: Array.from(byPt.entries())
      .map(([ptId, list]) => ({ ptId, ptName: list[0].ptName, ...aggregate(list) }))
      .sort((a, b) => b.clients - a.clients),
    clients: rows,
  });
}
