/**
 * One-time script: normalize all User.role values to uppercase enum values.
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/fix-roles-uppercase.ts
 * Or add to package.json scripts and run: npx tsx prisma/fix-roles-uppercase.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Show current distinct role values in DB
  const snapshot = await prisma.$queryRaw<{ role: string; cnt: bigint }[]>`
    SELECT role::text AS role, COUNT(*) AS cnt
    FROM users
    GROUP BY role::text
    ORDER BY role::text
  `;

  console.log("=== Current role distribution ===");
  for (const row of snapshot) {
    console.log(`  ${row.role}: ${row.cnt} users`);
  }

  // 2. Update all non-uppercase / old values to the current enum values.
  //    FREE and RESTRICTED both collapse to PT.
  const updated = await prisma.$executeRaw`
    UPDATE users
    SET role = CASE role::text
      WHEN 'admin'            THEN 'ADMIN'
      WHEN 'Admin'            THEN 'ADMIN'
      WHEN 'fm'               THEN 'FM'
      WHEN 'Fm'               THEN 'FM'
      WHEN 'pt'               THEN 'PT'
      WHEN 'Pt'               THEN 'PT'
      WHEN 'free'             THEN 'PT'
      WHEN 'FREE'             THEN 'PT'
      WHEN 'Free'             THEN 'PT'
      WHEN 'restricted'       THEN 'PT'
      WHEN 'RESTRICTED'       THEN 'PT'
      WHEN 'Restricted'       THEN 'PT'
      WHEN 'ceo_fitpartner'   THEN 'CEO_FITPARTNER'
      WHEN 'coo'              THEN 'COO'
      ELSE role::text
    END::"Role"
    WHERE role::text NOT IN ('ADMIN', 'FM', 'PT', 'CEO_FITPARTNER', 'COO')
  `;

  console.log(`\n✓ Updated ${updated} row(s)`);

  // 3. Show result
  const after = await prisma.$queryRaw<{ role: string; cnt: bigint }[]>`
    SELECT role::text AS role, COUNT(*) AS cnt
    FROM users
    GROUP BY role::text
    ORDER BY role::text
  `;

  console.log("\n=== Role distribution after fix ===");
  for (const row of after) {
    console.log(`  ${row.role}: ${row.cnt} users`);
  }

  console.log("\n✅ Done! All roles normalized to uppercase.");
  console.log("   → Users must re-login for JWT tokens to reflect updated roles.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
