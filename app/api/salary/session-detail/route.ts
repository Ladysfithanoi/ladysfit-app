import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionPayRate } from "@/lib/packages";
import { getTaughtSessions, countByClient } from "@/lib/pt-session-count";

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
  try {
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

    type EnrollmentRow = {
      id: string;
      clientId: string;
      contractCode: string | null;
      packageName: string;
      packageStage: string;
      sessions: number;
      sessionsUsed: number;
      contractType: string;
      fullName: string;
    };

    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 1);

    // Đếm buổi theo NGƯỜI THỰC SỰ DẠY (wl."createdById"), không theo assignedPTId.
    // Nhờ vậy buổi PT này dạy hộ khách của PT khác vẫn ghi công cho họ, và buổi
    // khách của họ do người khác dạy hộ sẽ KHÔNG bị tính cho họ. Chỉ buổi đã
    // check-out có chữ ký kèm nhật ký buổi tập mới được tính (xem pt-session-count).
    const logCountByClient = countByClient(await getTaughtSessions([ptId], startDate, endDate));

    // Hợp đồng ACTIVE của khách được GÁN cho PT này (hiện luôn cả khi tháng này
    // chưa dạy buổi nào — để thấy số buổi còn lại, ảnh, transform).
    const assignedEnrollments = await prisma.$queryRawUnsafe<EnrollmentRow[]>(
      `
      SELECT pe.id, pe."clientId", pe."contractCode", pe."packageName", pe."packageStage",
             pe.sessions, pe."sessionsUsed", pe."contractType"::text AS "contractType",
             c."fullName"
      FROM package_enrollments pe
      JOIN clients c ON c.id = pe."clientId"
      WHERE pe.status = 'ACTIVE' AND c."assignedPTId" = $1
      ORDER BY c."fullName" ASC, pe."createdAt" ASC
      `,
      ptId
    );

    // Thêm khách mà PT này DẠY HỘ tháng này (có buổi dạy nhưng không phải khách
    // được gán cho mình) → để buổi dạy hộ hiện ra và được tính giá trị.
    const assignedClientIds = new Set(assignedEnrollments.map(e => e.clientId));
    const substituteClientIds = Array.from(logCountByClient.keys()).filter(
      cid => !assignedClientIds.has(cid)
    );
    const substituteEnrollments = substituteClientIds.length > 0
      ? await prisma.$queryRawUnsafe<EnrollmentRow[]>(
          `
          SELECT pe.id, pe."clientId", pe."contractCode", pe."packageName", pe."packageStage",
                 pe.sessions, pe."sessionsUsed", pe."contractType"::text AS "contractType",
                 c."fullName"
          FROM package_enrollments pe
          JOIN clients c ON c.id = pe."clientId"
          WHERE pe.status = 'ACTIVE' AND c.id = ANY($1::text[])
          ORDER BY c."fullName" ASC, pe."createdAt" ASC
          `,
          substituteClientIds
        )
      : [];

    const allEnrollments = [
      ...assignedEnrollments.map(e => ({ ...e, isSubstitute: false })),
      ...substituteEnrollments.map(e => ({ ...e, isSubstitute: true })),
    ];

    if (allEnrollments.length === 0) return NextResponse.json({ rows: [] });

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

    // Fetch KOC contracts for these enrollments (camelCase columns)
    const kocEnrollmentIds = allEnrollments.filter(e => e.contractType === "KOC").map(e => e.id);
    const kocContracts = kocEnrollmentIds.length > 0
      ? await prisma.$queryRawUnsafe<{
          enrollmentId: string;
          startWeight: number;
          endWeight: number | null;
          startWeightConfirmed: boolean;
          endWeightConfirmed: boolean;
          status: string;
          totalSessions: number;
        }[]>(
          `SELECT "enrollmentId", "startWeight", "endWeight", "startWeightConfirmed", "endWeightConfirmed", status, "totalSessions"
           FROM koc_contracts
           WHERE "enrollmentId" = ANY($1::text[])`,
          kocEnrollmentIds
        )
      : [];
    const kocByEnrollment = new Map(kocContracts.map(k => [k.enrollmentId, k]));

    const rows = allEnrollments.map((e, idx) => {
      const photo = photoByEnrollment.get(e.id);
      const sessionsThisMonth = logCountByClient.get(e.clientId) ?? 0;
      const contractType = e.contractType as "NORMAL" | "KOC" | "KOL";

      const base = {
        stt: idx + 1,
        enrollmentId: e.id,
        contractCode: e.contractCode,
        clientId: e.clientId,
        clientName: e.fullName,
        isSubstitute: e.isSubstitute,
        packageName: e.packageName,
        totalSessions: Number(e.sessions),
        sessionsUsed: Number(e.sessionsUsed),
        sessionsRemaining: Number(e.sessions) - Number(e.sessionsUsed),
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
        const startWeight = koc ? Number(koc.startWeight) : 0;
        const endWeight   = koc?.endWeight != null ? Number(koc.endWeight) : null;
        const ratePerSession = koc?.endWeightConfirmed ? kocRatePerSession(startWeight, endWeight) : null;
        const commission = koc?.endWeightConfirmed
          ? calculateKOCCommission(startWeight, endWeight, Number(koc.totalSessions))
          : 0;
        return {
          ...base,
          valuePerSession: ratePerSession ?? 0,
          totalValue: commission,
          koc: {
            startWeight,
            endWeight,
            startWeightConfirmed: koc?.startWeightConfirmed ?? false,
            endWeightConfirmed: koc?.endWeightConfirmed ?? false,
            status: koc?.status ?? "ACTIVE",
            totalSessions: koc ? Number(koc.totalSessions) : 0,
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

      const vpSession = sessionPayRate(e.packageName);
      return {
        ...base,
        valuePerSession: vpSession,
        totalValue: sessionsThisMonth * vpSession,
        koc: null,
      };
    });

    return NextResponse.json({ rows });
  } catch (error: unknown) {
    const e = error as { message?: string; code?: string; stack?: string };
    console.error("Session detail error:", e.message);
    console.error("Code:", e.code);
    console.error("Stack:", e.stack);
    return NextResponse.json({ error: e.message, code: e.code }, { status: 500 });
  }
}
