import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEnrollmentTaughtCounts } from "@/lib/pt-session-count";

// PUT /api/clients/[id]/packages/[packageId]/pt-sessions
//
// Admin/FM sửa "Số buổi PT" của một lộ trình. Số nhập là TỔNG số buổi PT của cả
// lộ trình; phần chênh so với số đếm tự động (buổi đã check-out có chữ ký kèm
// nhật ký buổi tập) được ghi vào THÁNG HIỆN TẠI và cộng vào lương tháng đó.
//
// Ghi theo (lộ trình · tháng) nên sửa nhiều lần trong cùng tháng chỉ đè lên bản
// ghi của tháng đó, còn sửa ở tháng sau thì tạo bản ghi mới — tiền không bị dời
// khỏi tháng đã chốt.
export async function PUT(
  req: Request,
  { params }: { params: { id: string; packageId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "FM") {
    return NextResponse.json({ error: "Chỉ Admin và FM được sửa số buổi PT" }, { status: 403 });
  }

  const { ptSessions } = (await req.json()) as { ptSessions?: number };
  const desired = Number(ptSessions);
  if (!Number.isInteger(desired) || desired < 0) {
    return NextResponse.json({ error: "Số buổi PT không hợp lệ" }, { status: 400 });
  }

  const enrollment = await prisma.packageEnrollment.findUnique({
    where:  { id: params.packageId },
    select: { id: true, clientId: true, sessions: true, client: { select: { assignedPTId: true, branchId: true } } },
  });
  if (!enrollment || enrollment.clientId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (desired > enrollment.sessions) {
    return NextResponse.json(
      { error: `Số buổi PT không thể vượt quá ${enrollment.sessions} buổi của gói` },
      { status: 400 }
    );
  }

  // FM chỉ sửa được khách thuộc cơ sở mình quản lý.
  if (role === "FM") {
    const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
    if (!managedBranchIds.includes(enrollment.client.branchId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  // Số đang hiển thị = đếm tự động cả lộ trình + mọi lần chỉnh tay trước đó.
  const autoCount = (await getEnrollmentTaughtCounts(params.id))[params.packageId] ?? 0;
  const existing  = await prisma.pTSessionAdjustment.findMany({
    where:  { enrollmentId: params.packageId },
    select: { month: true, year: true, delta: true },
  });
  const priorTotal   = existing.reduce((s, a) => s + a.delta, 0);
  const thisMonthOld = existing.find(a => a.month === month && a.year === year)?.delta ?? 0;

  // Chênh cần bù, cộng vào phần đã ghi cho tháng này.
  const newThisMonth = thisMonthOld + (desired - (autoCount + priorTotal));

  if (newThisMonth === 0) {
    await prisma.pTSessionAdjustment.deleteMany({
      where: { enrollmentId: params.packageId, month, year },
    });
  } else {
    await prisma.pTSessionAdjustment.upsert({
      where:  { enrollmentId_month_year: { enrollmentId: params.packageId, month, year } },
      create: {
        enrollmentId: params.packageId,
        ptId:         enrollment.client.assignedPTId,
        month, year,
        delta:        newThisMonth,
        createdById:  session.user.id,
      },
      update: { delta: newThisMonth, ptId: enrollment.client.assignedPTId, createdById: session.user.id },
    });
  }

  return NextResponse.json({
    ptSessions:   desired,
    autoCount,
    adjustment:   priorTotal - thisMonthOld + newThisMonth,
    appliedMonth: month,
    appliedYear:  year,
  });
}
