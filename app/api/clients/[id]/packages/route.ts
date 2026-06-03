import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recountClientContracts } from "@/lib/recount-contracts";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.$queryRawUnsafe<{
    id: string; clientId: string; contractCode: string | null;
    packageName: string; packageStage: string; sessions: number; sessionsUsed: number;
    startDate: string | null; endDate: string | null; durationDays: number;
    reservedDays: number; extensionDays: number; price: number;
    contractType: string; status: string; notes: string | null; createdAt: string;
  }[]>(
    `SELECT id, "clientId", "contractCode", "packageName", "packageStage", sessions, "sessionsUsed",
            "startDate", "endDate", "durationDays", "reservedDays", "extensionDays", price,
            "contractType", status, notes, "createdAt"
     FROM package_enrollments WHERE "clientId" = $1 ORDER BY "createdAt" ASC`,
    params.id
  );

  return NextResponse.json(rows.map(r => ({
    id: r.id, clientId: r.clientId, contractCode: r.contractCode,
    packageName: r.packageName, packageStage: r.packageStage,
    sessions: Number(r.sessions), sessionsUsed: Number(r.sessionsUsed),
    startDate: r.startDate, endDate: r.endDate, durationDays: Number(r.durationDays),
    reservedDays: Number(r.reservedDays), extensionDays: Number(r.extensionDays),
    price: Number(r.price), contractType: r.contractType,
    status: r.status, notes: r.notes, createdAt: r.createdAt,
  })));
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    packageName, packageStage, sessions, durationDays, price, notes,
    contractCode: providedCode, contractType, startWeight, startWeightConfirmed,
  } = body;

  // KOC and KOL packages have price = 0 which is falsy, so only require price for NORMAL
  const isKOC = contractType === "KOC" || packageName === "KOC";
  const isKOL = contractType === "KOL";
  if (!packageName || !sessions || !durationDays || (!isKOC && !isKOL && !price)) {
    return NextResponse.json({ error: "Thiếu thông tin gói tập" }, { status: 400 });
  }

  const resolvedContractType: string = contractType === "KOC" || packageName === "KOC" ? "KOC"
    : contractType === "KOL" ? "KOL"
    : "NORMAL";

  if (resolvedContractType === "KOC" && !startWeight) {
    return NextResponse.json({ error: "KOC contract requires startWeight" }, { status: 400 });
  }

  let contractCode = providedCode || null;
  if (!contractCode) {
    const year = new Date().getFullYear();
    const yearStart = new Date(`${year}-01-01`);
    const yearCount = await prisma.packageEnrollment.count({ where: { createdAt: { gte: yearStart } } });
    contractCode = `HDLDF${year}${String(yearCount + 1).padStart(4, "0")}`;
  }

  // Use raw SQL to include contractType enum which may not be in stale Prisma client
  const pkgId = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `
    INSERT INTO package_enrollments
      (id, "clientId", "contractCode", "packageName", "packageStage", sessions, "sessionsUsed",
       "durationDays", "reservedDays", "extensionDays", price, "contractType", status, notes, "createdAt")
    VALUES
      (gen_random_uuid()::text, $1, $2, $3, $4, $5, 0, $6, 0, 0, $7, $8::"ContractType", 'ACTIVE', $9, NOW())
    RETURNING id
    `,
    params.id, contractCode, packageName, packageStage ?? "", sessions,
    durationDays, price, resolvedContractType, notes || null
  );

  const enrollmentId = pkgId[0].id;

  if (resolvedContractType === "KOC") {
    const client = await prisma.client.findUnique({
      where: { id: params.id },
      select: { assignedPTId: true },
    });
    const ptId = client?.assignedPTId ?? session.user.id;
    const contractDate = new Date();
    const endDate = new Date(contractDate);
    endDate.setDate(endDate.getDate() + 60);

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO koc_contracts
        (id, "enrollmentId", "clientId", "ptId", "startWeight", "startWeightConfirmed",
         "contractDate", "endDate", status, "totalSessions", "createdAt", "updatedAt")
      VALUES
        (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), $6, 'ACTIVE', 0, NOW(), NOW())
      `,
      enrollmentId, params.id, ptId, startWeight, startWeightConfirmed === true, endDate
    );
  }

  await recountClientContracts(params.id);

  const pkg = await prisma.packageEnrollment.findUnique({ where: { id: enrollmentId } });
  return NextResponse.json({ ...pkg, contractType: resolvedContractType }, { status: 201 });
}
