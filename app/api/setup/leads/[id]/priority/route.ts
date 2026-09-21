import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findLeadForCare } from "@/lib/lead-care";

/**
 * PUT /api/setup/leads/[id]/priority — bật / tắt ưu tiên cho một khách.
 *
 * Bật thì đóng dấu thời điểm bấm; danh sách xếp theo mốc đó nên ai được chọn
 * trước sẽ đứng trước. Bấm lại là tắt, và những khách còn lại KHÔNG phải đánh
 * số lại — đó là lý do cột lưu mốc thời gian chứ không lưu số thứ tự.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lead = await findLeadForCare(params.id, session.user);
  if (!lead) {
    return NextResponse.json({ error: "Không tìm thấy hoặc không có quyền" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({})) as { priority?: boolean };
  const prioritizedAt = body.priority ? new Date() : null;

  const updated = await prisma.salesLead.update({
    where:  { id: lead.id },
    data:   { prioritizedAt },
    select: { id: true, prioritizedAt: true },
  });

  return NextResponse.json({
    id:            updated.id,
    prioritizedAt: updated.prioritizedAt?.toISOString() ?? null,
  });
}
