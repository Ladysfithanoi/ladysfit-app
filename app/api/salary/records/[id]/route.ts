import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SalaryStatus } from "@prisma/client";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "FM") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const record = await prisma.salaryRecord.findUnique({
    where:   { id: params.id },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
  if (!managedBranchIds.includes(record.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { status?: SalaryStatus; advancePaid?: number; notes?: string };

  const oldStatus    = record.status;
  const newStatus    = body.status ?? oldStatus;
  const advancePaid  = body.advancePaid !== undefined ? body.advancePaid : record.advancePaid;
  const remainingPayment = record.totalSalary - advancePaid;

  const updated = await prisma.salaryRecord.update({
    where: { id: params.id },
    data: {
      ...(body.status && { status: body.status }),
      advancePaid,
      remainingPayment,
      ...(body.notes !== undefined && { notes: body.notes }),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  // ── Auto-create expense transaction when marking PAID ────────────────────
  if (newStatus === "PAID" && oldStatus !== "PAID") {
    const existing = await prisma.transaction.findFirst({ where: { referenceId: record.id } });
    if (!existing) {
      // record.month is 1-based (April = 4); JS Date months are 0-based,
      // so passing record.month as-is maps April(4) → index 4 = May → 5th of next month ✓
      const paymentDate = new Date(record.year, record.month, 5);
      await prisma.transaction.create({
        data: {
          branchId:        record.branchId,
          type:            "EXPENSE",
          category:        "Quỹ lương",
          amount:          record.totalSalary,
          description:     `Lương tháng ${record.month}/${record.year} - ${record.user.name ?? ""}`,
          transactionDate: paymentDate,
          referenceId:     record.id,
          createdById:     session.user.id,
        },
      });
    }
  }

  // ── Auto-delete expense transaction when reverting from PAID ─────────────
  if (oldStatus === "PAID" && newStatus !== "PAID") {
    await prisma.transaction.deleteMany({ where: { referenceId: record.id } });
  }

  return NextResponse.json(updated);
}
