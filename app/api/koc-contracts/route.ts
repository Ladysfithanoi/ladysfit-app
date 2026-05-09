import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — FM fetches all KOC contracts in their managed branches
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (role !== "FM" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const ptId = searchParams.get("ptId");

  const rows = await prisma.$queryRawUnsafe<{
    id: string;
    enrollment_id: string;
    contract_code: string | null;
    client_id: string;
    client_name: string;
    pt_id: string;
    pt_name: string | null;
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
    `
    SELECT
      k.id,
      k.enrollment_id,
      pe.contract_code,
      k.client_id,
      c.full_name AS client_name,
      k.pt_id,
      u.name AS pt_name,
      k.start_weight,
      k.end_weight,
      k.start_weight_confirmed,
      k.end_weight_confirmed,
      k.contract_date,
      k.end_date,
      k.status,
      k.total_sessions,
      k.notes
    FROM koc_contracts k
    JOIN clients c ON c.id = k.client_id
    JOIN users u ON u.id = k.pt_id
    JOIN package_enrollments pe ON pe.id = k.enrollment_id
    ${ptId ? "WHERE k.pt_id = $1" : ""}
    ORDER BY k.contract_date DESC
    `,
    ...(ptId ? [ptId] : [])
  );

  return NextResponse.json(
    rows.map(r => ({
      id: r.id,
      enrollmentId: r.enrollment_id,
      contractCode: r.contract_code,
      clientId: r.client_id,
      clientName: r.client_name,
      ptId: r.pt_id,
      ptName: r.pt_name,
      startWeight: Number(r.start_weight),
      endWeight: r.end_weight != null ? Number(r.end_weight) : null,
      startWeightConfirmed: r.start_weight_confirmed,
      endWeightConfirmed: r.end_weight_confirmed,
      contractDate: r.contract_date,
      endDate: r.end_date,
      status: r.status,
      totalSessions: Number(r.total_sessions),
      notes: r.notes,
    }))
  );
}
