import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH — FM confirms start/end weight, updates notes/status
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (role !== "FM" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    startWeightConfirmed?: boolean;
    endWeight?: number;
    endWeightConfirmed?: boolean;
    notes?: string;
    status?: string;
  };

  const setClauses: string[] = [];
  const vals: unknown[] = [];
  let paramIdx = 1;

  if (body.startWeightConfirmed !== undefined) {
    setClauses.push(`start_weight_confirmed = $${paramIdx++}`);
    vals.push(body.startWeightConfirmed);
  }
  if (body.endWeight !== undefined) {
    setClauses.push(`end_weight = $${paramIdx++}`);
    vals.push(body.endWeight);
  }
  if (body.endWeightConfirmed !== undefined) {
    setClauses.push(`end_weight_confirmed = $${paramIdx++}`);
    vals.push(body.endWeightConfirmed);
    // Auto-complete when FM confirms end weight
    if (body.endWeightConfirmed) {
      setClauses.push(`status = 'COMPLETED'`);
    }
  }
  if (body.notes !== undefined) {
    setClauses.push(`notes = $${paramIdx++}`);
    vals.push(body.notes);
  }
  if (body.status !== undefined) {
    setClauses.push(`status = $${paramIdx++}`);
    vals.push(body.status);
  }
  setClauses.push(`updated_at = NOW()`);

  if (setClauses.length === 1) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  vals.push(params.id);
  await prisma.$executeRawUnsafe(
    `UPDATE koc_contracts SET ${setClauses.join(", ")} WHERE id = $${paramIdx}`,
    ...vals
  );

  const rows = await prisma.$queryRawUnsafe<{
    id: string;
    enrollment_id: string;
    client_id: string;
    pt_id: string;
    start_weight: number;
    end_weight: number | null;
    start_weight_confirmed: boolean;
    end_weight_confirmed: boolean;
    contract_date: Date;
    end_date: Date;
    status: string;
    total_sessions: number;
    notes: string | null;
  }[]>(
    `SELECT * FROM koc_contracts WHERE id = $1`,
    params.id
  );

  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = rows[0];
  return NextResponse.json({
    id: r.id,
    enrollmentId: r.enrollment_id,
    clientId: r.client_id,
    ptId: r.pt_id,
    startWeight: Number(r.start_weight),
    endWeight: r.end_weight != null ? Number(r.end_weight) : null,
    startWeightConfirmed: r.start_weight_confirmed,
    endWeightConfirmed: r.end_weight_confirmed,
    contractDate: r.contract_date,
    endDate: r.end_date,
    status: r.status,
    totalSessions: Number(r.total_sessions),
    notes: r.notes,
  });
}
