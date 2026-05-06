import { NextResponse }    from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "@/lib/auth";
import { prisma }           from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "FM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const ptId  = searchParams.get("ptId") ?? "";
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);
  const year  = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()), 10);

  const managedBranchIds = session.user.managedBranchIds ?? [];
  if (!ptId) return NextResponse.json({ error: "ptId required" }, { status: 400 });

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 1);

  const [pt, logs] = await Promise.all([
    prisma.user.findUnique({ where: { id: ptId }, select: { name: true, email: true } }),
    prisma.workoutLog.findMany({
      where: {
        createdById: ptId,
        sessionDate: { gte: monthStart, lt: monthEnd },
        client: { branchId: { in: managedBranchIds } },
      },
      select: {
        id:          true,
        sessionDate: true,
        notes:       true,
        client: {
          select: {
            id:       true,
            fullName: true,
            packageEnrollments: {
              where:   { status: "ACTIVE" },
              select:  { packageName: true },
              take:    1,
              orderBy: { createdAt: "desc" },
            },
          },
        },
        session: { select: { sessionName: true } },
        program: { select: { phase: true } },
      },
      orderBy: [{ clientId: "asc" }, { sessionDate: "asc" }],
    }),
  ]);

  // Group logs by client
  const clientMap = new Map<string, {
    clientId:    string;
    clientName:  string;
    packageName: string;
    sessions: { date: string; sessionName: string; phase: string; notes: string | null }[];
  }>();

  for (const log of logs) {
    const cid  = log.client.id;
    const date = log.sessionDate;
    const dd   = String(date.getDate()).padStart(2, "0");
    const mm   = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();

    if (!clientMap.has(cid)) {
      clientMap.set(cid, {
        clientId:    cid,
        clientName:  log.client.fullName,
        packageName: log.client.packageEnrollments[0]?.packageName ?? "",
        sessions:    [],
      });
    }
    clientMap.get(cid)!.sessions.push({
      date:        `${dd}/${mm}/${yyyy}`,
      sessionName: log.session.sessionName,
      phase:       log.program.phase,
      notes:       log.notes ?? null,
    });
  }

  return NextResponse.json({
    ptName:  pt?.name ?? pt?.email ?? ptId,
    clients: Array.from(clientMap.values()),
  });
}
