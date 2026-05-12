import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isFM = role === "FM";
  const isCEO = role === "CEO_FITPARTNER" || role === "COO";
  if (!isFM && !isCEO) {
    return NextResponse.json({ error: "Chỉ FM hoặc CEO mới có thể chuyển lead" }, { status: 403 });
  }

  const { branchId, month, year } = await req.json() as { branchId: string; month: number; year: number };

  if (isFM) {
    const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
    if (!managedBranchIds.includes(branchId)) {
      return NextResponse.json({ error: "Không có quyền quản lý chi nhánh này" }, { status: 403 });
    }
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const leads = await prisma.salesLead.findMany({
    where: {
      branchId,
      month,
      year,
      status: { in: ["TAKECARE", "DE"] },
    },
  });

  let carried = 0;
  let skipped = 0;

  for (const lead of leads) {
    // Dedup by phone + assignedPTId if phone is available
    if (lead.phone) {
      const exists = await prisma.salesLead.findFirst({
        where: {
          phone: lead.phone,
          assignedPTId: lead.assignedPTId,
          branchId: lead.branchId,
          month: nextMonth,
          year: nextYear,
        },
      });
      if (exists) {
        skipped++;
        continue;
      }
    }

    const carryNote = `[Chuyển từ tháng ${month}/${year}]`;
    const newNotes = lead.notes
      ? `${lead.notes}\n${carryNote}`
      : carryNote;

    await prisma.salesLead.create({
      data: {
        branchId: lead.branchId,
        assignedPTId: lead.assignedPTId,
        createdById: session.user.id,
        customerName: lead.customerName,
        yearOfBirth: lead.yearOfBirth,
        phone: lead.phone,
        source: lead.source,
        notes: newNotes,
        forecast: lead.forecast,
        status: lead.status,
        month: nextMonth,
        year: nextYear,
      },
    });
    carried++;
  }

  return NextResponse.json({ carried, skipped, nextMonth, nextYear });
}
