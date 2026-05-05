import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientStatus } from "@prisma/client";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") as ClientStatus | "ALL" | null;

  const isFM = session.user.role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  const clients = await prisma.client.findMany({
    where: {
      AND: [
        search
          ? {
              OR: [
                { fullName: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
              ],
            }
          : {},
        status && status !== "ALL" ? { status: status as ClientStatus } : {},
        isFM ? { branchId: { in: managedBranchIds } } : {},
      ],
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      height: true,
      currentWeight: true,
      targetWeight: true,
      initialWeight: true,
      status: true,
      createdAt: true,
      assignedPT: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      packageEnrollments: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          packageName: true,
          sessions: true,
          sessionsUsed: true,
          startDate: true,
          endDate: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(clients);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    fullName, phone, dateOfBirth, initialWeight, targetWeight, height,
    initialWaist, initialHip, healthConditions, injuries, targetDate,
    goalNote, assignedPTId, branchId, status,
  } = body;

  if (!fullName || !phone || !initialWeight || !targetWeight || !height || !assignedPTId || !branchId) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }

  const count = await prisma.client.count();
  const clientCode = `LDF${String(count + 1).padStart(4, "0")}`;

  const client = await prisma.client.create({
    data: {
      clientCode,
      fullName,
      phone,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      initialWeight: parseFloat(initialWeight),
      currentWeight: parseFloat(initialWeight),
      targetWeight: parseFloat(targetWeight),
      height: parseFloat(height),
      initialWaist: initialWaist ? parseFloat(initialWaist) : null,
      initialHip: initialHip ? parseFloat(initialHip) : null,
      healthConditions: healthConditions || null,
      injuries: injuries || null,
      targetDate: targetDate ? new Date(targetDate) : null,
      goalNote: goalNote || null,
      assignedPTId,
      branchId,
      status: status ?? ClientStatus.ACTIVE,
    },
  });

  return NextResponse.json(client, { status: 201 });
}
