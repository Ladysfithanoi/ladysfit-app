import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// One-time fix: SalesLeads auto-created from consultations were assigned to the
// FM (session.user) instead of the selected PT (consultation.createdById).
// POST /api/admin/fix-lead-assignments → dry-run=false to apply
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") !== "false";

  // Find all auto-linked leads (consultationId not null)
  const leads = await prisma.salesLead.findMany({
    where: { consultationId: { not: null } },
    select: { id: true, assignedPTId: true, consultationId: true },
  });

  // Fetch corresponding consultations
  const consultationIds = leads.map((l) => l.consultationId!);
  const consultations = await prisma.consultation.findMany({
    where: { id: { in: consultationIds } },
    select: { id: true, createdById: true, branchId: true },
  });

  const consultationMap = new Map(consultations.map((c) => [c.id, c]));

  const toFix = leads.filter((l) => {
    const c = consultationMap.get(l.consultationId!);
    return c && c.createdById !== l.assignedPTId;
  });

  if (!dryRun) {
    await Promise.all(
      toFix.map((l) => {
        const c = consultationMap.get(l.consultationId!)!;
        return prisma.salesLead.update({
          where: { id: l.id },
          data: { assignedPTId: c.createdById, branchId: c.branchId },
        });
      })
    );
  }

  return NextResponse.json({
    dryRun,
    totalLinked: leads.length,
    wrongAssignments: toFix.length,
    fixed: dryRun ? 0 : toFix.length,
    records: toFix.map((l) => ({
      leadId: l.id,
      consultationId: l.consultationId,
      wrongPTId: l.assignedPTId,
      correctPTId: consultationMap.get(l.consultationId!)?.createdById,
    })),
  });
}
