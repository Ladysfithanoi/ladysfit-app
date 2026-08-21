import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadMovementsForPhases } from "@/lib/movement-templates";

const DEFAULT_PHASES = [
  { name: "Giai đoạn 1", order: 1 },
  { name: "Giai đoạn 2", order: 2 },
  { name: "Giai đoạn 3", order: 3 },
];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const count = await prisma.workoutPhase.count();
    if (count === 0) {
      await prisma.workoutPhase.createMany({ data: DEFAULT_PHASES });
    }

    const rows = await prisma.workoutPhase.findMany({
      include: { _count: { select: { programs: true } } },
      orderBy: { order: "asc" },
    });

    // Kèm chuyển động nền tảng của từng buổi (Kho bài tập). Giao diện dựng sẵn
    // giáo án theo đây; mẫu tĩnh trong lib/workout-structure không biết các giai
    // đoạn Admin mới tạo nên nếu thiếu trường này buổi tập sẽ hiện ra rỗng.
    const movementMap = await loadMovementsForPhases(rows);
    const phases = rows.map((p) => ({
      ...p,
      movements: movementMap.get(p.name) ?? {},
    }));

    if (session.user.role === "PT") {
      const [sysConfig, user] = await Promise.all([
        prisma.systemConfig.findUnique({ where: { id: "main" } }),
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: { ptLevel: { select: { phaseAccess: { select: { phaseId: true, hasAccess: true } } } } },
        }),
      ]);
      if (sysConfig?.enableLevelSystem && user?.ptLevel?.phaseAccess.length) {
        const allowedIds = new Set(
          user.ptLevel.phaseAccess.filter((a) => a.hasAccess).map((a) => a.phaseId)
        );
        return NextResponse.json(phases.filter((p) => allowedIds.has(p.id)));
      }
    }

    return NextResponse.json(phases);
  } catch (error) {
    console.error("Phases GET error:", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, order } = body;
    if (!name?.trim()) {
      return NextResponse.json({ error: "Tên giai đoạn không được để trống" }, { status: 400 });
    }

    const phase = await prisma.workoutPhase.create({
      data: { name: name.trim(), order: order ? Number(order) : 99 },
      include: { _count: { select: { programs: true } } },
    });

    return NextResponse.json(phase, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Lỗi server";
    console.error("Phases POST error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
