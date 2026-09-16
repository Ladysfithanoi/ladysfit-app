import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Mục tiêu phát sinh ──────────────────────────────────────────────────────
//
// Một đường duy nhất để ghi mục tiêu phát sinh, dùng cho cả ba màn:
//   • Đặt mục tiêu THÁNG  → gửi danh sách hạng mục kèm `monthTarget`.
//   • Đặt mục tiêu TUẦN   → gửi `weekNumber` + `weekTarget` của từng hạng mục.
//   • Nhập thực đạt tuần  → gửi `weekNumber` + `weekTarget`/`weekActual`.
//
// Số liệu tuần đi KÈM TRONG từng hạng mục chứ không tách thành mảng riêng: hạng
// mục vừa thêm ở tab Tuần chưa có id, tách ra thì phải gọi hai lượt rồi dò lại
// id theo tên — sai một cái là số rơi vào nhầm hạng mục.
//
// `goals` luôn là DANH SÁCH ĐẦY ĐỦ sau khi sửa: hạng mục cũ không còn trong
// mảng sẽ bị xoá (kèm số liệu tuần của nó). Mọi màn đều gửi đủ danh sách.
//
// Phân quyền giống /api/setup/weekly-actual: FM (cơ sở mình quản lý hoặc dòng
// của chính mình), Admin, COO, hoặc chính chủ. CEO_FitPartner chỉ được xem.

type GoalInput = {
  /** Có id = sửa hạng mục cũ; bỏ trống = thêm mới. */
  id?: string;
  name: string;
  unit?: string | null;
  isFloat?: boolean;
  monthTarget?: number;
  /** Chỉ dùng khi body có `weekNumber`. */
  weekTarget?: number;
  weekActual?: number;
};

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    monthlyTargetId: string;
    /** Có mặt = các số `weekTarget`/`weekActual` thuộc về tuần này. */
    weekNumber?: number;
    goals: GoalInput[];
  };

  const { monthlyTargetId, weekNumber } = body;
  if (!monthlyTargetId) {
    return NextResponse.json({ error: "Thiếu mục tiêu tháng" }, { status: 400 });
  }
  if (!Array.isArray(body.goals)) {
    return NextResponse.json({ error: "Thiếu danh sách mục tiêu phát sinh" }, { status: 400 });
  }

  const target = await prisma.monthlyTarget.findUnique({
    where: { id: monthlyTargetId },
    select: { id: true, userId: true, branchId: true },
  });
  if (!target) return NextResponse.json({ error: "Không tìm thấy mục tiêu" }, { status: 404 });

  const role = session.user.role;
  const isFM = role === "FM";
  const isAdmin = role === "ADMIN";
  const isCOO = role === "COO";
  const isOwner = target.userId === session.user.id;
  const managedBranchIds = session.user.managedBranchIds ?? [];

  if (isFM && !isOwner && !managedBranchIds.includes(target.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isFM && !isAdmin && !isCOO && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.extraTarget.findMany({
    where: { monthlyTargetId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((g) => g.id));

  // Hạng mục chưa đặt tên thì bỏ qua — dòng trống người dùng thêm rồi để đó.
  const incoming = body.goals.filter((g) => (g.name ?? "").trim() !== "");
  const keptIds = new Set(
    incoming.map((g) => g.id).filter((id): id is string => !!id && existingIds.has(id))
  );

  const removed = existing.filter((g) => !keptIds.has(g.id)).map((g) => g.id);
  if (removed.length > 0) {
    await prisma.extraTarget.deleteMany({ where: { id: { in: removed }, monthlyTargetId } });
  }

  const hasWeek = Number.isInteger(weekNumber) && (weekNumber as number) > 0;

  for (let i = 0; i < incoming.length; i++) {
    const g = incoming[i];
    const base = {
      name: g.name.trim(),
      unit: (g.unit ?? "").trim() || null,
      isFloat: g.isFloat === true,
      order: i,
    };

    let goalId: string;
    if (g.id && existingIds.has(g.id)) {
      // Ở tab Tuần không gửi monthTarget — đừng ghi đè mục tiêu tháng thành 0.
      const saved = await prisma.extraTarget.update({
        where: { id: g.id },
        data: {
          ...base,
          ...(g.monthTarget !== undefined ? { monthTarget: Number(g.monthTarget) || 0 } : {}),
        },
      });
      goalId = saved.id;
    } else {
      const saved = await prisma.extraTarget.create({
        data: { monthlyTargetId, ...base, monthTarget: Number(g.monthTarget) || 0 },
      });
      goalId = saved.id;
    }

    if (hasWeek && (g.weekTarget !== undefined || g.weekActual !== undefined)) {
      const patch: Record<string, number> = {};
      if (g.weekTarget !== undefined) patch.target = Number(g.weekTarget) || 0;
      if (g.weekActual !== undefined) patch.actual = Number(g.weekActual) || 0;
      await prisma.extraTargetWeek.upsert({
        where: { extraTargetId_weekNumber: { extraTargetId: goalId, weekNumber: weekNumber as number } },
        update: patch,
        create: {
          extraTargetId: goalId,
          weekNumber: weekNumber as number,
          target: patch.target ?? 0,
          actual: patch.actual ?? 0,
        },
      });
    }
  }

  const goals = await prisma.extraTarget.findMany({
    where: { monthlyTargetId },
    include: { weeks: { orderBy: { weekNumber: "asc" } } },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(goals);
}
