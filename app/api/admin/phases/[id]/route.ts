import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.order !== undefined) data.order = Number(body.order);
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const phase = await prisma.workoutPhase.update({
      where: { id: params.id },
      data,
      include: { _count: { select: { programs: true } } },
    });

    return NextResponse.json(phase);
  } catch (error) {
    console.error("Phases PUT error:", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const programCount = await prisma.workoutProgram.count({ where: { phaseId: params.id } });
    if (programCount > 0) {
      return NextResponse.json(
        { error: `Giai đoạn này có ${programCount} chương trình, không thể xóa` },
        { status: 400 }
      );
    }

    await prisma.workoutPhase.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Phases DELETE error:", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
