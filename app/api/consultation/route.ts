import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  const consultations = await prisma.consultation.findMany({
    where: {
      ...(status ? { status: status as "DRAFT" | "COMPLETED" } : {}),
      ...(isAdmin ? {} : isFM
        ? { branchId: { in: managedBranchIds } }
        : { createdById: session.user.id }),
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      branch: { select: { id: true, name: true } },
      info: { select: { fullName: true, phone: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(consultations);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { branchId } = await req.json();
  const effectiveBranchId = branchId || session.user.branchId;
  if (!effectiveBranchId) {
    return NextResponse.json({ error: "Cần chọn cơ sở" }, { status: 400 });
  }

  const consultation = await prisma.consultation.create({
    data: {
      createdById: session.user.id,
      branchId: effectiveBranchId,
      currentStep: 1,
    },
  });

  return NextResponse.json(consultation, { status: 201 });
}
