import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      assignedPT: { select: { id: true, name: true, email: true } },
      branch: { select: { id: true, name: true } },
      weightLogs: { orderBy: { date: "asc" } },
    },
  });

  if (!client) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  return NextResponse.json(client);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (role !== "ADMIN" && role !== "FM") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    select: { id: true, branchId: true, fullName: true },
  });
  if (!client) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  if (role === "FM") {
    const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
    if (!managedBranchIds.includes(client.branchId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.client.delete({ where: { id: params.id } });
  });

  return NextResponse.json({ success: true });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const client = await prisma.client.update({
    where: { id: params.id },
    data: {
      ...body,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
      targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
      initialWeight: body.initialWeight ? parseFloat(body.initialWeight) : undefined,
      currentWeight: body.currentWeight ? parseFloat(body.currentWeight) : undefined,
      targetWeight: body.targetWeight ? parseFloat(body.targetWeight) : undefined,
      height: body.height ? parseFloat(body.height) : undefined,
      initialWaist: body.initialWaist ? parseFloat(body.initialWaist) : undefined,
      initialHip: body.initialHip ? parseFloat(body.initialHip) : undefined,
    },
  });

  return NextResponse.json(client);
}
