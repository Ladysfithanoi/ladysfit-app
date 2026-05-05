import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const packages = await prisma.packageEnrollment.findMany({
    where: { clientId: params.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(packages);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { packageName, packageStage, sessions, durationDays, price, notes, contractCode: providedCode } = body;

  if (!packageName || !sessions || !durationDays || !price) {
    return NextResponse.json({ error: "Thiếu thông tin gói tập" }, { status: 400 });
  }

  let contractCode = providedCode || null;
  if (!contractCode) {
    const year = new Date().getFullYear();
    const yearStart = new Date(`${year}-01-01`);
    const yearCount = await prisma.packageEnrollment.count({ where: { createdAt: { gte: yearStart } } });
    contractCode = `HDLDF${year}${String(yearCount + 1).padStart(4, "0")}`;
  }

  const pkg = await prisma.packageEnrollment.create({
    data: {
      clientId: params.id,
      packageName,
      packageStage: packageStage ?? "",
      sessions,
      sessionsUsed: 0,
      durationDays,
      price,
      contractCode,
      status: "ACTIVE",
      notes: notes || null,
    },
  });

  return NextResponse.json(pkg, { status: 201 });
}
