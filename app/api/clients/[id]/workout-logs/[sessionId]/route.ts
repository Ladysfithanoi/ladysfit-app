import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { id: string; sessionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await prisma.workoutLog.findMany({
    where: { clientId: params.id, sessionId: params.sessionId },
    include: {
      setLogs: { orderBy: { id: "asc" } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { sessionDate: "desc" },
  });

  return NextResponse.json(
    logs.map((l) => ({
      ...l,
      sessionDate: l.sessionDate.toISOString(),
      createdAt: l.createdAt.toISOString(),
    }))
  );
}
