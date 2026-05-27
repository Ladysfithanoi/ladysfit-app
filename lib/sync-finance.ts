import { prisma } from "@/lib/prisma";
import { PACKAGES } from "@/lib/packages";

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

/** Parse "L1+L3" or "L1,L3" or "L1/L3" → ["L1", "L3"] */
function splitPackages(packageRegistered: string | null): string[] {
  if (!packageRegistered?.trim()) return [];
  return packageRegistered.split(/[,+/]/).map(s => s.trim()).filter(Boolean);
}

/** Build human-readable description for a transaction row. */
function buildDesc(customerName: string, pkg: string | null, ptName: string, remark: string | null): string {
  const parts = [customerName];
  if (pkg) parts.push(pkg);
  parts.push(`PT: ${ptName}`);
  if (remark) parts.push(`HĐ: ${remark}`);
  return parts.join(" | ");
}

export async function syncLeadToTransaction(lead: LeadForSync): Promise<void> {
  const isSuccess = SUCCESS_STATUSES.includes(lead.status);

  // ── Non-success or zero revenue: wipe any existing rows and bail ────────────
  if (!isSuccess || !lead.actualRevenue || lead.actualRevenue <= 0) {
    await prisma.transaction.deleteMany({ where: { referenceId: lead.id } });
    return;
  }

  const ptName         = lead.assignedPT?.name ?? "PT";
  const transactionDate = lead.signDate ?? new Date();
  const packages        = splitPackages(lead.packageRegistered);

  // ── Single package (or no package): preserve existing row if already created ─
  if (packages.length <= 1) {
    const desc = buildDesc(lead.customerName, lead.packageRegistered, ptName, lead.remark);

    const existing = await prisma.transaction.findFirst({
      where: { referenceId: lead.id },
    });

    if (existing) {
      // Update the primary row
      await prisma.transaction.update({
        where: { id: existing.id },
        data: {
          amount:          lead.actualRevenue * 1_000_000,
          description:     desc,
          transactionDate,
        },
      });
      // If there were previously multiple split rows, delete the extras
      const all = await prisma.transaction.findMany({
        where: { referenceId: lead.id },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      if (all.length > 1) {
        await prisma.transaction.deleteMany({
          where: { id: { in: all.slice(1).map(r => r.id) } },
        });
      }
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
    return;
  }

  // ── Multiple packages: delete all existing rows, recreate one per package ───
  await prisma.transaction.deleteMany({ where: { referenceId: lead.id } });

  // Distribute actualRevenue proportionally by each package's list price.
  // Unknown packages (not in PACKAGES map) get equal share.
  const priceMap = packages.map(pkg => ({
    pkg,
    price: PACKAGES[pkg]?.price ?? 0,
  }));
  const totalListPrice = priceMap.reduce((s, p) => s + p.price, 0);

  let remaining = lead.actualRevenue;

  for (let i = 0; i < priceMap.length; i++) {
    const { pkg, price } = priceMap[i];
    let rowAmount: number;

    if (i === priceMap.length - 1) {
      // Last package absorbs rounding remainder so the total stays exact
      rowAmount = Math.round(remaining * 100) / 100;
    } else if (totalListPrice > 0) {
      rowAmount = Math.round(lead.actualRevenue * (price / totalListPrice) * 100) / 100;
      remaining -= rowAmount;
    } else {
      // All prices unknown — split evenly
      rowAmount = Math.round((lead.actualRevenue / priceMap.length) * 100) / 100;
      remaining -= rowAmount;
    }

    await prisma.transaction.create({
      data: {
        branchId:        lead.branchId,
        type:            "INCOME",
        category:        "Hợp đồng KH",
        amount:          rowAmount * 1_000_000,
        description:     buildDesc(lead.customerName, pkg, ptName, lead.remark),
        transactionDate,
        referenceId:     lead.id,
        createdById:     lead.createdById,
      },
    });
  }
}
