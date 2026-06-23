import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!["ADMIN", "FM", "CEO_FITPARTNER", "COO", "PT"].includes(role)) {
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

  // Reports are per-user: return the logged-in user's own monthly note.
  const report = await prisma.monthlyBranchReport.findUnique({
    where: {
      branchId_month_year_userId: { branchId, month, year, userId: session.user.id },
    },
  });

  // FM/CEO/COO/ADMIN can additionally read the PT reports of the branch they manage
  // (the managedBranchIds guard above already limits FM to their own branches).
  const canViewOthers = role === "FM" || role === "CEO_FITPARTNER" || role === "COO" || role === "ADMIN";
  let userReports: { userId: string; userName: string; incompleteWork: string | null }[] = [];
  if (canViewOthers) {
    const rows = await prisma.monthlyBranchReport.findMany({
      where: { branchId, month, year, user: { role: "PT", deletedAt: null } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    userReports = rows
      .map((r) => ({
        userId: r.userId,
        userName: r.user.name ?? r.user.email,
        incompleteWork: r.incompleteWork,
      }))
      .sort((a, b) => a.userName.localeCompare(b.userName, "vi"));
  }

  return NextResponse.json({ report, userReports });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  // CEO_FitPartner chỉ được XEM báo cáo tháng — không ghi. (COO ngang quyền Admin)
  if (!["FM", "COO", "PT"].includes(role)) {
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

  // Each staff member edits only their own monthly note.
  const report = await prisma.monthlyBranchReport.upsert({
    where: {
      branchId_month_year_userId: { branchId, month, year, userId: session.user.id },
    },
    update: { incompleteWork: incompleteWork ?? null },
    create: {
      branchId,
      userId: session.user.id,
      month,
      year,
      incompleteWork: incompleteWork ?? null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(report);
}
