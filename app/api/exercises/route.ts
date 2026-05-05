import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const phase = searchParams.get("phase");
  const movement = searchParams.get("movement");

  const exercises = await prisma.workoutExercise.findMany({
    where: {
      ...(phase ? { phase } : {}),
      ...(movement ? { movement } : {}),
    },
    // only deduplicate by name when not filtering by movement (e.g. broad discovery queries)
    ...(!movement ? { distinct: ["name"] as const } : {}),
    orderBy: { name: "asc" },
  });

  return NextResponse.json(exercises);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { phase, movement, name } = body as { phase: string; movement: string; name: string };
  if (!phase || !movement || !name?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const dotIdx = movement.indexOf(". ");
  const type = dotIdx !== -1 ? movement.slice(dotIdx + 2) : movement;

  const exercise = await prisma.workoutExercise.create({
    data: { phase, type, movement, name: name.trim() },
  });

  return NextResponse.json(exercise);
}
