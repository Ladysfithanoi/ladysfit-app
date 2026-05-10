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

  const { phaseIds } = (await req.json()) as { phaseIds: string[] };

  // Replace all phase access for this level
  await prisma.pTLevelPhaseAccess.deleteMany({ where: { levelId: params.id } });

  if (phaseIds.length > 0) {
    await prisma.pTLevelPhaseAccess.createMany({
      data: phaseIds.map((phaseId) => ({
        levelId: params.id,
        phaseId,
        hasAccess: true,
      })),
    });
  }

  const level = await prisma.pTLevel.findUnique({
    where: { id: params.id },
    include: {
      phaseAccess: { include: { phase: true } },
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json(level);
}
