import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.$queryRawUnsafe<{
    id: string; client_id: string; contract_code: string | null;
    package_name: string; package_stage: string; sessions: number; sessions_used: number;
    start_date: string | null; end_date: string | null; duration_days: number;
    reserved_days: number; extension_days: number; price: number;
    contract_type: string; status: string; notes: string | null; created_at: string;
  }[]>(
    `SELECT id, client_id, contract_code, package_name, package_stage, sessions, sessions_used,
            start_date, end_date, duration_days, reserved_days, extension_days, price,
            contract_type, status, notes, created_at
     FROM package_enrollments WHERE client_id = $1 ORDER BY created_at ASC`,
    params.id
  );

  return NextResponse.json(rows.map(r => ({
    id: r.id, clientId: r.client_id, contractCode: r.contract_code,
    packageName: r.package_name, packageStage: r.package_stage,
    sessions: Number(r.sessions), sessionsUsed: Number(r.sessions_used),
    startDate: r.start_date, endDate: r.end_date, durationDays: Number(r.duration_days),
    reservedDays: Number(r.reserved_days), extensionDays: Number(r.extension_days),
    price: Number(r.price), contractType: r.contract_type,
    status: r.status, notes: r.notes, createdAt: r.created_at,
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
      (id, client_id, contract_code, package_name, package_stage, sessions, sessions_used,
       duration_days, reserved_days, extension_days, price, contract_type, status, notes, created_at)
    VALUES
      (gen_random_uuid()::text, $1, $2, $3, $4, $5, 0, $6, 0, 0, $7, $8::\"ContractType\", 'ACTIVE', $9, NOW())
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
        (id, enrollment_id, client_id, pt_id, start_weight, start_weight_confirmed,
         contract_date, end_date, status, total_sessions, created_at, updated_at)
      VALUES
        (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), $6, 'ACTIVE', 0, NOW(), NOW())
      `,
      enrollmentId, params.id, ptId, startWeight, startWeightConfirmed === true, endDate
    );
  }

  const pkg = await prisma.packageEnrollment.findUnique({ where: { id: enrollmentId } });
  return NextResponse.json({ ...pkg, contractType: resolvedContractType }, { status: 201 });
}
