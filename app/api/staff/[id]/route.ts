import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerRole = session.user.role;
  const isFM = callerRole === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  if (callerRole !== "ADMIN" && !isFM) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: { _count: { select: { clients: true } } },
  });

  if (!user) return NextResponse.json({ error: "Không tìm thấy nhân sự" }, { status: 404 });

  if (user.role === "ADMIN") {
    return NextResponse.json({ error: "Không thể xóa tài khoản Admin" }, { status: 400 });
  }

  // FM cannot delete ADMIN or FM accounts, and can only delete staff in managed branches
  if (isFM) {
    if (user.role === "FM") {
      return NextResponse.json({ error: "FM không thể xóa tài khoản FM khác" }, { status: 403 });
    }
    if (!user.branchId || !managedBranchIds.includes(user.branchId)) {
      return NextResponse.json({ error: "Không có quyền xóa nhân sự này" }, { status: 403 });
    }
  }

  if (user._count.clients > 0) {
    return NextResponse.json(
      {
        error: `PT này đang phụ trách ${user._count.clients} khách hàng. Vui lòng chuyển khách hàng sang PT khác trước khi xóa.`,
      },
      { status: 400 }
    );
  }

  try {
    await prisma.user.update({
      where: { id: params.id },
      data: {
        deletedAt: new Date(),
        // Obfuscate email so the address can be reused in future
        email: `deleted_${Date.now()}_${user.email}`,
      },
    });
  } catch (err) {
    console.error("Delete staff error:", err);
    return NextResponse.json({ error: "Không thể xóa nhân sự. Vui lòng thử lại." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerRole = session.user.role;
  const isFM = callerRole === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  if (callerRole !== "ADMIN" && !isFM) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, password, branchId, role, managedBranchIds: newManagedIds, ptLevelId } = body;

  // FM cannot assign ADMIN or FM roles
  if (isFM && role && (role === "ADMIN" || role === "FM")) {
    return NextResponse.json({ error: "FM không thể gán quyền Admin hoặc FM" }, { status: 403 });
  }

  // FM can only edit staff in their managed branches
  if (isFM) {
    const target = await prisma.user.findUnique({ where: { id: params.id }, select: { branchId: true, role: true } });
    if (!target) return NextResponse.json({ error: "Không tìm thấy nhân sự" }, { status: 404 });
    if (target.role === "FM" || target.role === "ADMIN") {
      return NextResponse.json({ error: "Không có quyền chỉnh sửa tài khoản này" }, { status: 403 });
    }
    if (!target.branchId || !managedBranchIds.includes(target.branchId)) {
      return NextResponse.json({ error: "Không có quyền chỉnh sửa nhân sự này" }, { status: 403 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (name) updateData.name = name;
  if (email) updateData.email = email;
  if (password) updateData.password = await bcrypt.hash(password, 12);
  if (ptLevelId !== undefined) updateData.ptLevelId = ptLevelId || null;

  if (role === "FM") {
    updateData.role = role;
    updateData.branchId = null;
  } else {
    if (role) updateData.role = role;
    if (branchId) updateData.branchId = branchId;
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
    select: {
      id: true, name: true, email: true, role: true, branchId: true,
      ptLevelId: true,
      ptLevel: { select: { id: true, name: true, color: true } },
      branch: { select: { id: true, name: true } },
      managedBranches: { include: { branch: { select: { id: true, name: true } } } },
      _count: { select: { clients: true } },
    },
  });

  // Handle FM branch assignments update
  if (newManagedIds !== undefined) {
    await prisma.fMBranchAssignment.deleteMany({ where: { userId: params.id } });
    if (Array.isArray(newManagedIds) && newManagedIds.length > 0) {
      await prisma.fMBranchAssignment.createMany({
        data: (newManagedIds as string[]).map((bid) => ({ userId: params.id, branchId: bid })),
      });
    }
  } else if (role && role !== "FM") {
    // Changing FROM FM to another role — remove assignments
    await prisma.fMBranchAssignment.deleteMany({ where: { userId: params.id } });
  }

  return NextResponse.json(user);
}
