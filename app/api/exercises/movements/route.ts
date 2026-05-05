import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await prisma.workoutMovementTemplate.findMany({
    orderBy: [{ phaseKey: "asc" }, { sessionType: "asc" }, { movement: "asc" }],
  });

  // Batch exercise counts in two queries
  const exerciseCounts = await prisma.workoutExercise.groupBy({
    by: ["phase", "movement"],
    _count: { id: true },
  });

  const countMap = new Map(
    exerciseCounts.map((e) => [`${e.phase}|${e.movement}`, e._count.id])
  );

  const result = templates.map((t) => ({
    ...t,
    exerciseCount: countMap.get(`${t.phaseKey.split(":")[0].trim()}|${t.movement}`) ?? 0,
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { phaseKey: string; sessionType: string; movement: string };
  const { phaseKey, sessionType, movement } = body;
  if (!phaseKey || !sessionType || !movement?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const template = await prisma.workoutMovementTemplate.create({
    data: { phaseKey, sessionType, movement: movement.trim() },
  });

  return NextResponse.json({ ...template, exerciseCount: 0 });
}
