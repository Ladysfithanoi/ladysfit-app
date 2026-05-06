import { prisma } from "@/lib/prisma";

type LeadForSync = {
  id: string;
  branchId: string;
  customerName: string;
  packageRegistered: string | null;
  actualRevenue: number | null;
  signDate: Date | null;
  status: string;
  createdById: string;
  remark: string | null;
  assignedPT?: { name: string | null } | null;
};

const SUCCESS_STATUSES = ["PIF", "DE", "PB"];

export async function syncLeadToTransaction(lead: LeadForSync): Promise<void> {
  const isSuccess = SUCCESS_STATUSES.includes(lead.status);

  if (isSuccess && lead.actualRevenue && lead.actualRevenue > 0) {
    const ptName         = lead.assignedPT?.name ?? "PT";
    const transactionDate = lead.signDate ?? new Date();

    const parts = [lead.customerName];
    if (lead.packageRegistered) parts.push(lead.packageRegistered);
    parts.push(`PT: ${ptName}`);
    if (lead.remark) parts.push(`HĐ: ${lead.remark}`);
    const desc = parts.join(" | ");

    const existing = await prisma.transaction.findFirst({
      where: { referenceId: lead.id },
    });

    if (existing) {
      await prisma.transaction.update({
        where: { id: existing.id },
        data: {
          amount:          lead.actualRevenue * 1_000_000,
          description:     desc,
          transactionDate,
        },
      });
    } else {
      await prisma.transaction.create({
        data: {
          branchId:        lead.branchId,
          type:            "INCOME",
          category:        "Hợp đồng KH",
          amount:          lead.actualRevenue * 1_000_000,
          description:     desc,
          transactionDate,
          referenceId:     lead.id,
          createdById:     lead.createdById,
        },
      });
    }
  } else {
    await prisma.transaction.deleteMany({ where: { referenceId: lead.id } });
  }
}
