import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { movement } = await req.json() as { movement: string };
  if (!movement?.trim()) return NextResponse.json({ error: "Missing movement" }, { status: 400 });

  const updated = await prisma.workoutMovementTemplate.update({
    where: { id: params.id },
    data: { movement: movement.trim() },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const template = await prisma.workoutMovementTemplate.findUnique({ where: { id: params.id } });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dbPhase = template.phaseKey.split(":")[0].trim();
  const count = await prisma.workoutExercise.count({
    where: { phase: dbPhase, movement: template.movement },
  });

  if (count > 0) {
    return NextResponse.json(
      { error: `Không thể xóa: còn ${count} bài tập cho chuyển động này` },
      { status: 400 }
    );
  }

  await prisma.workoutMovementTemplate.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
