import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const branches = await prisma.branch.findMany({
    include: { _count: { select: { users: true, clients: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(branches);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, address } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Tên cơ sở không được để trống" }, { status: 400 });

  const branch = await prisma.branch.create({
    data: { name: name.trim(), address: address?.trim() || null },
  });

  return NextResponse.json(branch, { status: 201 });
}
