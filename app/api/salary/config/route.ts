import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const role = session.user.role;
  const isFM = role === "FM";
  const isPT = role === "FREE" || role === "RESTRICTED";

  if (isPT && userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isFM && !isPT) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await prisma.salaryConfig.findFirst({
    where: { userId },
    orderBy: { effectiveFrom: "desc" },
  });

  return NextResponse.json(config);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "FM") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    userId:            string;
    branchId:          string;
    baseSalary:        number;
    seniorityYears:    number;
    startDate?:        string | null;
    lunchAllowance?:   number;
    phoneAllowance?:   number;
    transportAllowance?: number;
    effectiveFrom:     string;
  };

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
  if (!managedBranchIds.includes(body.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!body.userId || !body.branchId || !body.effectiveFrom) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }
  if (body.baseSalary < 0 || (body.lunchAllowance ?? 0) < 0 || (body.phoneAllowance ?? 0) < 0 || (body.transportAllowance ?? 0) < 0) {
    return NextResponse.json({ error: "Giá trị lương không được âm" }, { status: 400 });
  }
  if (body.seniorityYears < 0 || body.seniorityYears > 50) {
    return NextResponse.json({ error: "Số năm thâm niên không hợp lệ" }, { status: 400 });
  }

  const existing = await prisma.salaryConfig.findFirst({
    where: { userId: body.userId, branchId: body.branchId },
    orderBy: { effectiveFrom: "desc" },
  });

  const data = {
    baseSalary:        body.baseSalary,
    seniorityYears:    body.seniorityYears,
    startDate:         body.startDate ? new Date(body.startDate) : null,
    lunchAllowance:    body.lunchAllowance     ?? 2_600_000,
    phoneAllowance:    body.phoneAllowance     ?? 900_000,
    transportAllowance: body.transportAllowance ?? 500_000,
    effectiveFrom:     new Date(body.effectiveFrom),
  };

  const config = existing
    ? await prisma.salaryConfig.update({ where: { id: existing.id }, data })
    : await prisma.salaryConfig.create({
        data: { userId: body.userId, branchId: body.branchId, ...data },
      });

  return NextResponse.json(config);
}
