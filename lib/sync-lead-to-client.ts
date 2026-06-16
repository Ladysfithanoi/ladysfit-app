import { prisma } from "@/lib/prisma";
import { recountClientContracts } from "@/lib/recount-contracts";
import { PACKAGES } from "@/lib/packages";

type LeadForSync = {
  id: string;
  phone: string | null;
  packageRegistered: string | null;
  actualRevenue: number | null;
  signDate: Date | null;
  assignedPTId: string;
};

// A lead's registered-package field can hold several packages ("L1+L3",
// "L1, L4", "L3/L5"). Split it into the individual package keys.
function parsePackageKeys(pkg: string | null): string[] {
  if (!pkg?.trim()) return [];
  return pkg.split(/[,+/]/).map((s) => s.trim()).filter(Boolean);
}

export async function syncLeadToClient(lead: LeadForSync): Promise<string | null> {
  if (!lead.phone) return null;

  const client = await prisma.client.findFirst({
    where: { phone: lead.phone },
  });
  if (!client) return null;

  // Idempotency: skip if this lead has already been synced (either the legacy
  // single code or any of the per-package codes).
  const baseCode = `SYNC-${lead.id}`;
  const already = await prisma.packageEnrollment.findFirst({
    where: { OR: [{ contractCode: baseCode }, { contractCode: { startsWith: `${baseCode}-` } }] },
    select: { id: true },
  });
  if (already) return client.id;

  const price = lead.actualRevenue ?? 0;
  const startDate = lead.signDate ?? null;

  // One enrollment per registered package, with the session count + duration +
  // stage taken from the canonical Ladysfit lộ trình (lib/packages) instead of a
  // hard-coded default. Unknown/empty labels fall back to a single generic gói.
  const keys = parsePackageKeys(lead.packageRegistered);
  const entries = keys.length > 0 ? keys : [lead.packageRegistered || "Unknown"];

  const data = entries.map((key, idx) => {
    const def = PACKAGES[key];
    return {
      clientId: client.id,
      // Unique code per enrollment when several packages are synced for one lead.
      contractCode: entries.length > 1 ? `${baseCode}-${key}` : baseCode,
      packageName: def?.name ?? key,
      packageStage: def?.stage ?? "",
      sessions: def?.sessions ?? 30,
      sessionsUsed: 0,
      startDate,
      durationDays: def?.durationDays ?? 90,
      reservedDays: 0,
      extensionDays: 0,
      // actualRevenue is the whole-deal price; put it on the first enrollment so
      // the client's total package price isn't multiplied across packages.
      price: idx === 0 ? price : 0,
      contractType: "NORMAL" as const,
      status: "ACTIVE" as const,
      notes: null,
    };
  });

  await prisma.packageEnrollment.createMany({ data });

  await recountClientContracts(client.id);

  return client.id;
}
