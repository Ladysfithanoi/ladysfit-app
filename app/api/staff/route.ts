import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");

  const role = session.user.role;
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  let staffWhere: Record<string, unknown> = { deletedAt: null };
  if (isFM) {
    const targetBranchId = (branchId && managedBranchIds.includes(branchId)) ? branchId : null;
    const branchCondition = targetBranchId ?? { in: managedBranchIds };
    staffWhere = {
      deletedAt: null,
      role: { in: ["PT", "FM", "ADMIN"] },
      OR: [
        { branchId: branchCondition },
        { role: "FM", managedBranches: { some: { branchId: branchCondition } } },
      ],
    };
  } else if (branchId) {
    staffWhere = {
      deletedAt: null,
      OR: [
        { branchId },
        { role: "FM", managedBranches: { some: { branchId } } },
        { role: "ADMIN", branchId },
      ],
    };
  }

  const staff = await prisma.user.findMany({
    where: staffWhere,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      branchId: true,
      ptLevelId: true,
      ptLevel: { select: { id: true, name: true, color: true } },
      branch: { select: { id: true, name: true } },
      managedBranches: { include: { branch: { select: { id: true, name: true } } } },
      _count: { select: { clients: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(staff);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerRole = session.user.role;
  const isFM = callerRole === "FM";

  if (callerRole !== "ADMIN" && !isFM) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, password, branchId, role, managedBranchIds, ptLevelId, dateOfBirth } = body;

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }

  // FM cannot create ADMIN or FM accounts
  if (isFM && (role === "ADMIN" || role === "FM")) {
    return NextResponse.json({ error: "FM không thể tạo tài khoản Admin hoặc FM" }, { status: 403 });
  }

  // ADMIN can optionally have a branchId (their home branch); CEO/COO/FM have no single branchId
  const noBranchRole = role === "FM" || role === "CEO_FITPARTNER" || role === "COO";

  if (role === "FM") {
    if (!managedBranchIds || managedBranchIds.length === 0 || managedBranchIds.length > 5) {
      return NextResponse.json({ error: "FM phải có từ 1 đến 5 cơ sở quản lý" }, { status: 400 });
    }
  } else if (!noBranchRole && role !== "ADMIN" && !branchId) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !existing.deletedAt) {
    return NextResponse.json({ error: "Email đã tồn tại" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 12);

  try {
    const parsedDOB = dateOfBirth ? new Date(dateOfBirth) : undefined;

    // Use upsert so that a previously soft-deleted account with the same email
    // is reactivated instead of triggering a P2002 unique constraint error.
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        password: hashed,
        branchId: noBranchRole ? null : (branchId || null),
        role,
        deletedAt: null,
        ptLevelId: ptLevelId || null,
        ...(parsedDOB && !isNaN(parsedDOB.getTime()) ? { dateOfBirth: parsedDOB } : {}),
      },
      create: {
        name,
        email,
        password: hashed,
        branchId: noBranchRole ? null : (branchId || null),
        role,
        ...(ptLevelId && { ptLevelId }),
        ...(parsedDOB && !isNaN(parsedDOB.getTime()) && { dateOfBirth: parsedDOB }),
      },
      select: {
        id: true, name: true, email: true, role: true, branchId: true,
        ptLevelId: true,
        ptLevel: { select: { id: true, name: true, color: true } },
        branch: { select: { id: true, name: true } },
        managedBranches: { include: { branch: { select: { id: true, name: true } } } },
        _count: { select: { clients: true } },
      },
    });

    // Sync FM branch assignments — clear stale ones before recreating
    await prisma.fMBranchAssignment.deleteMany({ where: { userId: user.id } });
    if (role === "FM" && managedBranchIds?.length) {
      await prisma.fMBranchAssignment.createMany({
        data: (managedBranchIds as string[]).map((bid) => ({ userId: user.id, branchId: bid })),
      });
    }

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error("Create staff error:", err);
    return NextResponse.json({ error: "Không thể tạo nhân sự. Vui lòng thử lại." }, { status: 500 });
  }
}
