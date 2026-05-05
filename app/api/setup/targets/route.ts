import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const month = parseInt(searchParams.get("month") ?? "0");
  const year = parseInt(searchParams.get("year") ?? "0");

  if (!branchId || !month || !year) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const role = session.user.role;
  const isPT = role === "FREE" || role === "RESTRICTED";
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  if (isFM && !managedBranchIds.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where: Record<string, unknown> = { branchId, month, year };
  if (isPT) where.userId = session.user.id;

  const targets = await prisma.monthlyTarget.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      weeklyActuals: { orderBy: { weekNumber: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(targets);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isPT = role === "FREE" || role === "RESTRICTED";
  const isFM = role === "FM";
  const isCEO = role === "CEO_FITPARTNER";
  if (!isPT && !isFM && !isCEO) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as Array<{
    branchId: string; userId: string; month: number; year: number;
    revenueTarget: number; fitpartnerRevenueTarget: number;
    fitTarget: number; cooperationTarget: number;
    transformTarget: number; googleReviewTarget: number; cvTarget: number;
  }>;

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const managedBranchIds = session.user.managedBranchIds ?? [];

  const results = await Promise.all(
    body.map(async (t) => {
      if (isFM && !managedBranchIds.includes(t.branchId)) return null;
      // PT can only save their own target
      if (isPT && t.userId !== session.user.id) return null;
      return prisma.monthlyTarget.upsert({
        where: { branchId_userId_month_year: { branchId: t.branchId, userId: t.userId, month: t.month, year: t.year } },
        update: {
          revenueTarget: t.revenueTarget ?? 0,
          fitpartnerRevenueTarget: t.fitpartnerRevenueTarget ?? 0,
          fitTarget: t.fitTarget ?? 0,
          cooperationTarget: t.cooperationTarget ?? 0,
          transformTarget: t.transformTarget ?? 0,
          googleReviewTarget: t.googleReviewTarget ?? 0,
          cvTarget: t.cvTarget ?? 0,
        },
        create: {
          branchId: t.branchId, userId: t.userId, month: t.month, year: t.year,
          revenueTarget: t.revenueTarget ?? 0,
          fitpartnerRevenueTarget: t.fitpartnerRevenueTarget ?? 0,
          fitTarget: t.fitTarget ?? 0,
          cooperationTarget: t.cooperationTarget ?? 0, transformTarget: t.transformTarget ?? 0,
          googleReviewTarget: t.googleReviewTarget ?? 0, cvTarget: t.cvTarget ?? 0,
        },
      });
    })
  );

  return NextResponse.json(results.filter(Boolean));
}
