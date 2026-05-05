import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: { id: string; programId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const program = await prisma.workoutProgram.findUnique({
    where: { id: params.programId, clientId: params.id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      packageEnrollment: { select: { id: true, packageName: true } },
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          sessions: {
            orderBy: { order: "asc" },
            include: { movements: { orderBy: { order: "asc" } } },
          },
        },
      },
      sessions: {
        where: { weekId: null },
        orderBy: { order: "asc" },
        include: { movements: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(program);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; programId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { status?: string; notes?: string };

  const program = await prisma.workoutProgram.update({
    where: { id: params.programId, clientId: params.id },
    data: {
      ...(body.status === "ARCHIVED" || body.status === "ACTIVE"
        ? { status: body.status }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  });

  return NextResponse.json(program);
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; programId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.workoutProgram.delete({
    where: { id: params.programId, clientId: params.id },
  });

  return NextResponse.json({ ok: true });
}
