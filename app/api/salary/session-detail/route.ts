import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function valuePerSession(packageName: string): number {
  return ["L1", "L2", "Loyalfit"].includes(packageName) ? 60_000 : 100_000;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ptId  = searchParams.get("ptId");
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year  = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()));

  if (!ptId) return NextResponse.json({ error: "ptId required" }, { status: 400 });

  const role = session.user.role;
  if (role !== "FM" && role !== "ADMIN" && session.user.id !== ptId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollments = await prisma.packageEnrollment.findMany({
    where: {
      status: "ACTIVE",
      client: { assignedPTId: ptId },
    },
    include: {
      client: { select: { id: true, fullName: true } },
    },
    orderBy: [{ client: { fullName: "asc" } }, { createdAt: "asc" }],
  });

  if (enrollments.length === 0) return NextResponse.json({ rows: [] });

  const clientIds = Array.from(new Set(enrollments.map(e => e.clientId)));
  const startDate = new Date(year, month - 1, 1);
  const endDate   = new Date(year, month, 1);

  const logs = await prisma.workoutLog.findMany({
    where: {
      clientId:    { in: clientIds },
      createdById: ptId,
      sessionDate: { gte: startDate, lt: endDate },
    },
    select: { clientId: true },
  });

  const logCountByClient = new Map<string, number>();
  for (const log of logs) {
    logCountByClient.set(log.clientId, (logCountByClient.get(log.clientId) ?? 0) + 1);
  }

  const photos = await prisma.sessionPhoto.findMany({
    where: {
      ptId,
      packageEnrollmentId: { in: enrollments.map(e => e.id) },
      month,
      year,
    },
  });
  const photoByEnrollment = new Map(photos.map(p => [p.packageEnrollmentId, p]));

  const rows = enrollments.map((e, idx) => {
    const photo = photoByEnrollment.get(e.id);
    const sessionsThisMonth = logCountByClient.get(e.clientId) ?? 0;
    const vpSession = valuePerSession(e.packageName);
    return {
      stt: idx + 1,
      enrollmentId: e.id,
      contractCode: e.contractCode,
      clientId: e.client.id,
      clientName: e.client.fullName,
      packageName: e.packageName,
      totalSessions: e.sessions,
      sessionsUsed: e.sessionsUsed,
      sessionsRemaining: e.sessions - e.sessionsUsed,
      sessionsThisMonth,
      valuePerSession: vpSession,
      totalValue: sessionsThisMonth * vpSession,
      photo: photo ? {
        id: photo.id,
        checkinImages:   photo.checkinImages  ? JSON.parse(photo.checkinImages)  : [],
        transformImages: photo.transformImages ? JSON.parse(photo.transformImages) : [],
        hasTransformed:  photo.hasTransformed,
      } : null,
    };
  });

  return NextResponse.json({ rows });
}
