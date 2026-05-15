import { prisma } from "@/lib/prisma";

type LeadForSync = {
  id: string;
  phone: string | null;
  packageRegistered: string | null;
  actualRevenue: number | null;
  signDate: Date | null;
  assignedPTId: string;
};

export async function syncLeadToClient(lead: LeadForSync): Promise<string | null> {
  if (!lead.phone) return null;

  const client = await prisma.client.findFirst({
    where: { phone: lead.phone },
  });
  if (!client) return null;

  const contractCode = `SYNC-${lead.id}`;

  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM package_enrollments WHERE "contractCode" = $1 LIMIT 1`,
    contractCode
  );
  if (existing.length > 0) return client.id;

  const packageName = lead.packageRegistered || "Unknown";
  const price = lead.actualRevenue ?? 0;
  const startDate = lead.signDate ? lead.signDate.toISOString() : null;

  await prisma.$queryRawUnsafe(
    `INSERT INTO package_enrollments
      (id, "clientId", "contractCode", "packageName", "packageStage", sessions, "sessionsUsed",
       "startDate", "durationDays", "reservedDays", "extensionDays", price,
       "contractType", status, notes, "createdAt")
     VALUES
      (gen_random_uuid()::text, $1, $2, $3, '', 30, 0, $4, 90, 0, 0, $5,
       'NORMAL'::"ContractType", 'ACTIVE', NULL, NOW())`,
    client.id,
    contractCode,
    packageName,
    startDate,
    price
  );

  return client.id;
}
