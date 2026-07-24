import { NextResponse }     from "next/server";
import { getServerSession }  from "next-auth";
import { authOptions }       from "@/lib/auth";
import { prisma }            from "@/lib/prisma";

const L1_L2_LOYAL = new Set(["L1", "L2", "Loyalfit"]);

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "FM") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId") ?? "";
  const month    = parseInt(searchParams.get("month") ?? "1");
  const year     = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()));
  const userIds  = (searchParams.get("userIds") ?? "").split(",").filter(Boolean);

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
  if (!managedBranchIds.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gte = new Date(year, month - 1, 1);
  const lt  = new Date(year, month, 1);

  const result: Record<string, { showsL1L2Loyal: number; showsL3L4L5: number }> = {};

  await Promise.all(
    userIds.map(async userId => {
      // Show được tính cho NGƯỜI THỰC SỰ DẠY buổi (wl."createdById" — người ký
      // check-in/check-out buổi đó), KHÔNG theo client."assignedPTId". Nhờ vậy khi
      // một PT dạy hộ (substitute) khách của PT khác, buổi ký check-out xong sẽ ghi
      // công cho đúng người dạy hộ. Phân loại gói (L1/L2/Loyal vs còn lại) và loại
      // trừ KOL vẫn dựa trên gói ACTIVE của KHÁCH được dạy.
      // Raw SQL để đọc contractType (có thể chưa có trong Prisma client cũ).
      const rows = await prisma.$queryRawUnsafe<{
        contractType: string;
        packageName:  string;
      }[]>(
        `
        SELECT
          COALESCE(pe."contractType"::text, 'NORMAL') AS "contractType",
          COALESCE(pe."packageName", '')               AS "packageName"
        FROM workout_logs wl
        JOIN clients c ON c.id = wl."clientId"
        LEFT JOIN LATERAL (
          SELECT pe."contractType"::text AS "contractType", pe."packageName"
          FROM package_enrollments pe
          WHERE pe."clientId" = c.id AND pe.status = 'ACTIVE'
          ORDER BY pe."createdAt" DESC
          LIMIT 1
        ) pe ON true
        WHERE wl."createdById" = $1
          AND wl."status" = 'COMPLETED'
          AND wl."sessionDate" >= $2
          AND wl."sessionDate" <  $3
        `,
        userId, gte, lt
      );

      let showsL1L2Loyal = 0;
      let showsL3L4L5    = 0;

      for (const row of rows) {
        if (row.contractType === "KOL") continue;
        if (L1_L2_LOYAL.has(row.packageName)) showsL1L2Loyal++;
        else showsL3L4L5++;
      }

      result[userId] = { showsL1L2Loyal, showsL3L4L5 };
    })
  );

  return NextResponse.json(result);
}
