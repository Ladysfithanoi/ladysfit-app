import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await prisma.activityLog.findMany({
    where: { clientId: params.id },
    orderBy: { date: "desc" },
    take: 60,
  });

  return NextResponse.json(
    logs.map((l) => ({
      id: l.id,
      date: l.date.toISOString(),
      steps: l.steps,
      minutesActive: l.minutesActive,
      minutesGym: l.minutesGym,
      note: l.note,
    }))
  );
}
