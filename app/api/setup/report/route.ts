import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enrichTargetsWithDynamicActuals } from "@/lib/compute-actuals";
import type { Role } from "@prisma/client";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!["ADMIN", "FM", "CEO_FITPARTNER", "COO"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const month = parseInt(searchParams.get("month") ?? "0");
  const year = parseInt(searchParams.get("year") ?? "0");

  if (!branchId || !month || !year) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];
  if (isFM && !managedBranchIds.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targets = await prisma.monthlyTarget.findMany({
    // CEO_FITPARTNER/COO are management, not gym staff — never list them as a row.
    where: { branchId, month, year, user: { deletedAt: null, role: { notIn: ["CEO_FITPARTNER", "COO"] as Role[] } } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      weeklyActuals: { orderBy: { weekNumber: "asc" } },
    },
  });

  const enriched = await enrichTargetsWithDynamicActuals(targets, month, year);
  return NextResponse.json(enriched);
}
