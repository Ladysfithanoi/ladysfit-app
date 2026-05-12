import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const report = await prisma.monthlyBranchReport.findUnique({
    where: { branchId_month_year: { branchId, month, year } },
  });

  return NextResponse.json(report);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!["FM", "CEO_FITPARTNER", "COO"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    branchId: string;
    month: number;
    year: number;
    incompleteWork: string | null;
  };

  const { branchId, month, year, incompleteWork } = body;
  if (!branchId || !month || !year) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];
  if (isFM && !managedBranchIds.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const report = await prisma.monthlyBranchReport.upsert({
    where: { branchId_month_year: { branchId, month, year } },
    update: { incompleteWork: incompleteWork ?? null },
    create: {
      branchId,
      month,
      year,
      incompleteWork: incompleteWork ?? null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(report);
}
