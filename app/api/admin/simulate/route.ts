import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTestEmail, seedSimulationData } from "@/lib/simulate";

/**
 * Cài đặt → Giả lập (xem lib/simulate.ts).
 * GET  — danh sách tài khoản Admin đóng vai được (tài khoản test xếp đầu).
 * POST — tạo / làm mới bộ dữ liệu test.
 * Chỉ Admin thật — khi đang giả lập thì session là FM/PT nên tự bị chặn.
 */

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN" || session.user.impersonator) return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    where:   { deletedAt: null, role: { not: "ADMIN" } },
    select:  {
      id: true, name: true, email: true, role: true,
      branch:          { select: { name: true } },
      managedBranches: { select: { branch: { select: { name: true } } } },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const rows = users.map((u) => ({
    id:       u.id,
    name:     u.name,
    email:    u.email,
    role:     u.role,
    branches: u.role === "FM"
      ? u.managedBranches.map((m) => m.branch.name)
      : u.branch ? [u.branch.name] : [],
    isTest:   isTestEmail(u.email),
  }));
  rows.sort((a, b) => Number(b.isTest) - Number(a.isTest));
  return NextResponse.json(rows);
}

export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const result = await seedSimulationData();
    return NextResponse.json(result);
  } catch (e) {
    console.error("[simulate] seed failed", e);
    return NextResponse.json({ error: "Không tạo được dữ liệu test" }, { status: 500 });
  }
}
