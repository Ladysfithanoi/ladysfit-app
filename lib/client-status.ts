import { prisma } from "@/lib/prisma";

// A package still keeps a client "đang tập". Mirrors the churn definition used on the
// admin dashboard (app/dashboard/page.tsx): an ACTIVE package counts until its end date
// passes; a PAUSED (bảo lưu) package always counts; COMPLETED / EXPIRED do not.
export function isPackageOngoing(
  p: { status: string; endDate: Date | null },
  now: Date = new Date()
): boolean {
  if (p.status === "ACTIVE") return p.endDate == null || p.endDate >= now;
  if (p.status === "PAUSED") return true;
  return false; // COMPLETED, EXPIRED
}

// When a client finishes a lộ trình — out of sessions (COMPLETED) or past its end date
// (hết hạn) — and has no other ongoing lộ trình, flip their status to PAUSED ("Nghỉ tập").
// One-directional: only ACTIVE → PAUSED. Never touches RESERVED (bảo lưu), an already
// paused client, or a client who has never bought a lộ trình.
export async function refreshClientChurnStatus(clientId: string): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      status: true,
      packageEnrollments: { select: { status: true, endDate: true } },
    },
  });
  if (!client || client.status !== "ACTIVE") return;
  if (client.packageEnrollments.length === 0) return;

  const now = new Date();
  const hasOngoing = client.packageEnrollments.some((p) => isPackageOngoing(p, now));
  if (!hasOngoing) {
    await prisma.client.update({ where: { id: clientId }, data: { status: "PAUSED" } });
  }
}

// When a "Nghỉ tập" client buys a new lộ trình, bring them back to "Đang tập" (ACTIVE).
// Leaves RESERVED (bảo lưu) clients alone.
export async function reactivateClientOnNewPackage(clientId: string): Promise<void> {
  await prisma.client.updateMany({
    where: { id: clientId, status: "PAUSED" },
    data: { status: "ACTIVE" },
  });
}
