import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientStatus, PackageEnrollmentStatus } from "@prisma/client";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") as ClientStatus | "ALL" | null;

  const role = session.user.role;
  const isFM = role === "FM";
  const isPT = role === "FREE" || role === "RESTRICTED" || role === "PT";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  // For PT: find substitute client IDs they can currently view
  let substituteClientIds: string[] = [];
  if (isPT) {
    const activeSubs = await prisma.substituteRequest.findMany({
      where: {
        substituteId: session.user.id,
        status: "ACTIVE",
        OR: [{ type: "LONG_TERM" }, { endDate: { gt: new Date() } }],
      },
      select: { clientId: true },
    });
    substituteClientIds = activeSubs.map((s) => s.clientId);
  }

  const searchFilter = search
    ? {
        OR: [
          { fullName: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search } },
        ],
      }
    : {};
  const statusFilter =
    status && status !== "ALL" ? { status: status as ClientStatus } : {};

  // Build ownership filter
  const ownershipFilter = isPT
    ? {
        OR: [
          { assignedPTId: session.user.id },
          ...(substituteClientIds.length > 0
            ? [{ id: { in: substituteClientIds } }]
            : []),
        ],
      }
    : isFM
    ? { branchId: { in: managedBranchIds } }
    : {};

  const clientSelect = {
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
      where: { status: PackageEnrollmentStatus.ACTIVE },
      orderBy: { createdAt: "asc" as const },
      take: 1,
      select: {
        packageName: true,
        sessions: true,
        sessionsUsed: true,
        startDate: true,
        endDate: true,
      },
    },
  };

  const clients = await prisma.client.findMany({
    where: { AND: [searchFilter, statusFilter, ownershipFilter] },
    select: clientSelect,
    orderBy: { createdAt: "desc" },
  });

  // Attach substitute metadata for PT view
  if (isPT && substituteClientIds.length > 0) {
    const subMap = new Map<string, { endDate: Date | null; type: string }>();
    const activeSubs = await prisma.substituteRequest.findMany({
      where: {
        substituteId: session.user.id,
        status: "ACTIVE",
        clientId: { in: substituteClientIds },
      },
      select: { clientId: true, endDate: true, type: true },
    });
    for (const s of activeSubs) subMap.set(s.clientId, { endDate: s.endDate, type: s.type });

    const enriched = clients.map((c) => {
      const sub = subMap.get(c.id);
      if (!sub) return c;
      const daysLeft =
        sub.type === "SHORT_TERM" && sub.endDate
          ? Math.max(0, Math.ceil((sub.endDate.getTime() - Date.now()) / 86400000))
          : null;
      return { ...c, substituteInfo: { type: sub.type, daysLeft } };
    });
    return NextResponse.json(enriched);
  }

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
