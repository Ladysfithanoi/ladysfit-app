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

    // ── Standard fields ──────────────────────────────────────────────────
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.order !== undefined) data.order = Number(body.order);
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.sessionTypes !== undefined && Array.isArray(body.sessionTypes)) {
      data.sessionTypes = body.sessionTypes as string[];
    }

    // ── Session type: append new ─────────────────────────────────────────
    if (body.addSessionType !== undefined) {
      const newType = String(body.addSessionType).trim();
      if (newType) {
        const current = await prisma.workoutPhase.findUnique({
          where: { id: params.id },
          select: { sessionTypes: true },
        });
        const types = current?.sessionTypes ?? [];
        if (!types.includes(newType)) {
          data.sessionTypes = [...types, newType];
        }
      }
    }

    // ── Session type: rename + cascade to templates ───────────────────────
    if (body.renameSession !== undefined) {
      const { phaseKey, from, to } = body.renameSession as {
        phaseKey: string;
        from: string;
        to: string;
      };
      const toTrimmed = to.trim();
      if (toTrimmed && from !== toTrimmed) {
        const current = await prisma.workoutPhase.findUnique({
          where: { id: params.id },
          select: { sessionTypes: true },
        });
        const types = current?.sessionTypes ?? [];
        if (types.includes(from)) {
          data.sessionTypes = types.map((s: string) => (s === from ? toTrimmed : s));
        }
        // Cascade rename to movement templates for this exact phaseKey
        await prisma.workoutMovementTemplate.updateMany({
          where: { phaseKey, sessionType: from },
          data: { sessionType: toTrimmed },
        });
      }
    }

    // ── Session type: remove ─────────────────────────────────────────────
    if (body.removeSession !== undefined) {
      const { phaseKey, name } = body.removeSession as { phaseKey: string; name: string };
      const templateCount = await prisma.workoutMovementTemplate.count({
        where: { phaseKey, sessionType: name },
      });
      if (templateCount > 0) {
        return NextResponse.json(
          { error: `Loại buổi tập "${name}" còn ${templateCount} chuyển động, không thể xóa` },
          { status: 400 }
        );
      }
      const current = await prisma.workoutPhase.findUnique({
        where: { id: params.id },
        select: { sessionTypes: true },
      });
      data.sessionTypes = (current?.sessionTypes ?? []).filter((s: string) => s !== name);
    }

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

    const phase = await prisma.workoutPhase.findUnique({
      where: { id: params.id },
      select: { name: true },
    });
    if (!phase) return NextResponse.json({ error: "Không tìm thấy giai đoạn" }, { status: 404 });

    // Unlink client programs so they're preserved but no longer reference this phase
    await prisma.workoutProgram.updateMany({
      where: { phaseId: params.id },
      data: { phaseId: null },
    });

    // Delete all movement templates belonging to this phase
    await prisma.workoutMovementTemplate.deleteMany({
      where: { phaseKey: phase.name },
    });

    // Delete the phase (PTLevelPhaseAccess cascades automatically via onDelete: Cascade)
    await prisma.workoutPhase.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Phases DELETE error:", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
