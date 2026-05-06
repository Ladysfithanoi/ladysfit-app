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
      // Sessions are attributed to the PT via client.assignedPTId,
      // not createdById — the ADMIN typically clicks save on behalf of all PTs.
      const logs = await prisma.workoutLog.findMany({
        where: {
          client:      { assignedPTId: userId },
          sessionDate: { gte, lt },
        },
        select: {
          program: {
            select: {
              packageEnrollment: { select: { packageName: true } },
            },
          },
          client: {
            select: {
              packageEnrollments: {
                where:   { status: "ACTIVE" },
                select:  { packageName: true },
                take:    1,
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      });

      let showsL1L2Loyal = 0;
      let showsL3L4L5    = 0;

      for (const log of logs) {
        // workoutType stores phase names like "Giai đoạn 1", not package codes —
        // use program.packageEnrollment first, then client's active enrollment.
        const pkgName = log.program?.packageEnrollment?.packageName
                     ?? log.client?.packageEnrollments?.[0]?.packageName
                     ?? "";
        if (L1_L2_LOYAL.has(pkgName)) showsL1L2Loyal++;
        else showsL3L4L5++;
      }

      result[userId] = { showsL1L2Loyal, showsL3L4L5 };
    })
  );

  return NextResponse.json(result);
}
