import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const levels = await prisma.pTLevel.findMany({
    orderBy: { order: "asc" },
    include: {
      phaseAccess: { include: { phase: true } },
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json(levels);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name: string;
    color?: string;
    retestIntervalDays?: number;
    isDefault?: boolean;
    phaseIds?: string[];
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Tên cấp độ không được trống" }, { status: 400 });
  }

  const maxOrder = await prisma.pTLevel.aggregate({ _max: { order: true } });
  const nextOrder = (maxOrder._max.order ?? 0) + 1;

  if (body.isDefault) {
    await prisma.pTLevel.updateMany({ data: { isDefault: false } });
  }

  const level = await prisma.pTLevel.create({
    data: {
      name: body.name.trim(),
      order: nextOrder,
      color: body.color ?? "#6b7280",
      retestIntervalDays: body.retestIntervalDays ?? 30,
      isDefault: body.isDefault ?? false,
      phaseAccess: body.phaseIds?.length
        ? { create: body.phaseIds.map((phaseId) => ({ phaseId, hasAccess: true })) }
        : undefined,
    },
    include: {
      phaseAccess: { include: { phase: true } },
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json(level);
}
