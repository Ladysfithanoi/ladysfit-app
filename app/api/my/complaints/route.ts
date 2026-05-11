import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const complaints = await prisma.complaint.findMany({
    where: { clientId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    complaints.map((c) => ({
      id: c.id,
      category: c.category,
      content: c.content,
      status: c.status,
      fmNote: c.fmNote,
      createdAt: c.createdAt.toISOString(),
    }))
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { category, content } = await req.json() as { category: string; content: string };
  if (!category || !content || content.trim().length < 20) {
    return NextResponse.json({ error: "Vui lòng nhập đầy đủ nội dung (tối thiểu 20 ký tự)" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id: session.user.id },
    select: { branchId: true, fullName: true },
  });
  if (!client) return NextResponse.json({ error: "Không tìm thấy khách hàng" }, { status: 404 });

  // Find FM managing this branch
  const fm = await prisma.user.findFirst({
    where: {
      role: "FM",
      deletedAt: null,
      managedBranches: { some: { branchId: client.branchId } },
    },
    select: { id: true },
  });

  // Fallback to any ADMIN
  const assignedFMId = fm?.id ?? (
    await prisma.user.findFirst({ where: { role: "ADMIN", deletedAt: null }, select: { id: true } })
  )?.id ?? null;

  const complaint = await prisma.complaint.create({
    data: {
      clientId: session.user.id,
      branchId: client.branchId,
      assignedFMId,
      category,
      content: content.trim(),
    },
  });

  return NextResponse.json({ id: complaint.id });
}
