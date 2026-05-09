import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function valuePerSession(packageName: string): number {
  return ["L1", "L2", "Loyalfit"].includes(packageName) ? 60_000 : 100_000;
}

function calculateKOCCommission(startWeight: number, endWeight: number | null, sessions: number): number {
  if (endWeight == null) return 0;
  const weightLost = startWeight - endWeight;
  const maxSessions = Math.min(sessions, 60);

  if (startWeight < 70) return 0;
  if (weightLost >= 8 && weightLost <= 9.9) return maxSessions * 35_000;
  if (weightLost >= 5 && weightLost <= 7.9) return maxSessions * 25_000;
  if (weightLost >= 3 && weightLost <= 4.9) return maxSessions * 20_000;
  return 0;
}

function kocRatePerSession(startWeight: number, endWeight: number | null): number | null {
  if (endWeight == null) return null;
  const weightLost = startWeight - endWeight;
  if (startWeight < 70) return 0;
  if (weightLost >= 8 && weightLost <= 9.9) return 35_000;
  if (weightLost >= 5 && weightLost <= 7.9) return 25_000;
  if (weightLost >= 3 && weightLost <= 4.9) return 20_000;
  return 0;
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

  // Fetch NORMAL enrollments via raw SQL to get contractType
  const allEnrollments = await prisma.$queryRawUnsafe<{
    id: string;
    client_id: string;
    contract_code: string | null;
    package_name: string;
    package_stage: string;
    sessions: number;
    sessions_used: number;
    contract_type: string;
    full_name: string;
  }[]>(
    `
    SELECT pe.id, pe.client_id, pe.contract_code, pe.package_name, pe.package_stage,
           pe.sessions, pe.sessions_used, pe.contract_type,
           c.full_name
    FROM package_enrollments pe
    JOIN clients c ON c.id = pe.client_id
    WHERE pe.status = 'ACTIVE' AND c.assigned_pt_id = $1
    ORDER BY c.full_name ASC, pe.created_at ASC
    `,
    ptId
  );

  if (allEnrollments.length === 0) return NextResponse.json({ rows: [] });

  const clientIds = Array.from(new Set(allEnrollments.map(e => e.client_id)));
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

  const enrollmentIds = allEnrollments.map(e => e.id);

  const photos = await prisma.sessionPhoto.findMany({
    where: {
      ptId,
      packageEnrollmentId: { in: enrollmentIds },
      month,
      year,
    },
  });
  const photoByEnrollment = new Map(photos.map(p => [p.packageEnrollmentId, p]));

  // Fetch KOC contracts for these enrollments
  const kocEnrollmentIds = allEnrollments.filter(e => e.contract_type === "KOC").map(e => e.id);
  const kocContracts = kocEnrollmentIds.length > 0
    ? await prisma.$queryRawUnsafe<{
        enrollment_id: string;
        start_weight: number;
        end_weight: number | null;
        start_weight_confirmed: boolean;
        end_weight_confirmed: boolean;
        status: string;
        total_sessions: number;
      }[]>(
        `SELECT enrollment_id, start_weight, end_weight, start_weight_confirmed, end_weight_confirmed, status, total_sessions
         FROM koc_contracts
         WHERE enrollment_id = ANY($1::text[])`,
        kocEnrollmentIds
      )
    : [];
  const kocByEnrollment = new Map(kocContracts.map(k => [k.enrollment_id, k]));

  const rows = allEnrollments.map((e, idx) => {
    const photo = photoByEnrollment.get(e.id);
    const sessionsThisMonth = logCountByClient.get(e.client_id) ?? 0;
    const contractType = e.contract_type as "NORMAL" | "KOC" | "KOL";

    const base = {
      stt: idx + 1,
      enrollmentId: e.id,
      contractCode: e.contract_code,
      clientId: e.client_id,
      clientName: e.full_name,
      packageName: e.package_name,
      totalSessions: Number(e.sessions),
      sessionsUsed: Number(e.sessions_used),
      sessionsRemaining: Number(e.sessions) - Number(e.sessions_used),
      sessionsThisMonth,
      contractType,
      photo: photo ? {
        id: photo.id,
        checkinImages:   photo.checkinImages   ? JSON.parse(photo.checkinImages)   : [],
        transformImages: photo.transformImages  ? JSON.parse(photo.transformImages) : [],
        hasTransformed:  photo.hasTransformed,
      } : null,
    };

    if (contractType === "KOC") {
      const koc = kocByEnrollment.get(e.id);
      const startWeight = koc ? Number(koc.start_weight) : 0;
      const endWeight   = koc?.end_weight != null ? Number(koc.end_weight) : null;
      const ratePerSession = koc?.end_weight_confirmed ? kocRatePerSession(startWeight, endWeight) : null;
      const commission = koc?.end_weight_confirmed
        ? calculateKOCCommission(startWeight, endWeight, Number(koc.total_sessions))
        : 0;
      return {
        ...base,
        valuePerSession: ratePerSession ?? 0,
        totalValue: commission,
        koc: {
          startWeight,
          endWeight,
          startWeightConfirmed: koc?.start_weight_confirmed ?? false,
          endWeightConfirmed: koc?.end_weight_confirmed ?? false,
          status: koc?.status ?? "ACTIVE",
          totalSessions: koc ? Number(koc.total_sessions) : 0,
          ratePerSession,
        },
      };
    }

    if (contractType === "KOL") {
      return {
        ...base,
        valuePerSession: 60_000,
        totalValue: sessionsThisMonth * 60_000,
        koc: null,
      };
    }

    const vpSession = valuePerSession(e.package_name);
    return {
      ...base,
      valuePerSession: vpSession,
      totalValue: sessionsThisMonth * vpSession,
      koc: null,
    };
  });

  return NextResponse.json({ rows });
}
