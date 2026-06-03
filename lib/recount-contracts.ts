import { prisma } from "@/lib/prisma";

/**
 * Recompute and persist `clients.contractCount` from the authoritative source —
 * the number of rows in package_enrollments for the client (i.e. exactly what the
 * "Lộ trình đăng ký" section on the profile shows). Call this after any enrollment
 * is created or deleted so the stored count never drifts.
 */
export async function recountClientContracts(clientId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "clients"
     SET "contractCount" = (SELECT COUNT(*) FROM "package_enrollments" WHERE "clientId" = $1)
     WHERE id = $1`,
    clientId
  );
}
