import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isPT = role === "FREE" || role === "RESTRICTED";

  // Only PT can edit/delete leads
  if (!isPT) return NextResponse.json({ error: "Chỉ PT mới có thể sửa lead" }, { status: 403 });

  const lead = await prisma.salesLead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  if (lead.assignedPTId !== session.user.id) {
    return NextResponse.json({ error: "Bạn chỉ có thể sửa lead của mình" }, { status: 403 });
  }

  const body = await req.json();
  const updated = await prisma.salesLead.update({
    where: { id: params.id },
    data: {
      customerName: body.customerName,
      yearOfBirth: body.yearOfBirth ? parseInt(body.yearOfBirth) : null,
      phone: body.phone || null,
      source: body.source || null,
      notes: body.notes || null,
      forecast: body.forecast || null,
      status: body.status,
      packageRegistered: body.packageRegistered || null,
      actualRevenue: body.actualRevenue != null ? parseFloat(body.actualRevenue) : null,
      remainingPayment: body.remainingPayment != null ? parseFloat(body.remainingPayment) : null,
      fitpartnerRevenue: body.fitpartnerRevenue != null ? parseFloat(body.fitpartnerRevenue) : null,
      signDate: body.signDate ? new Date(body.signDate) : null,
      remark: body.remark || null,
    },
    include: {
      assignedPT: { select: { id: true, name: true, email: true, role: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isPT = role === "FREE" || role === "RESTRICTED";

  if (!isPT) return NextResponse.json({ error: "Chỉ PT mới có thể xóa lead" }, { status: 403 });

  const lead = await prisma.salesLead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  if (lead.assignedPTId !== session.user.id) {
    return NextResponse.json({ error: "Bạn chỉ có thể xóa lead của mình" }, { status: 403 });
  }

  await prisma.salesLead.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
