import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncLeadToTransaction } from "@/lib/sync-finance";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "FM") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { branchId } = await req.json() as { branchId: string };
  if (!branchId) return NextResponse.json({ error: "Missing branchId" }, { status: 400 });

  const managed: string[] = session.user.managedBranchIds ?? [];
  if (!managed.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const leads = await prisma.salesLead.findMany({
    where: {
      branchId,
      status:        { in: ["PIF", "DE", "PB"] },
      actualRevenue: { gt: 0 },
    },
    include: { assignedPT: { select: { name: true } } },
  });

  let synced = 0;
  for (const lead of leads) {
    const before = await prisma.transaction.findFirst({ where: { referenceId: lead.id } });
    await syncLeadToTransaction(lead);
    const after = await prisma.transaction.findFirst({ where: { referenceId: lead.id } });
    if (after && (!before || before.id !== after.id || before.amount !== after.amount)) {
      synced++;
    }
  }

  return NextResponse.json({ synced, total: leads.length });
}
