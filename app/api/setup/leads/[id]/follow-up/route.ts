import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findLeadForCare } from "@/lib/lead-care";

/**
 * PUT /api/setup/leads/[id]/follow-up — đặt, sửa, tắt hoặc chốt xong một cái hẹn
 * chăm sóc lại.
 *
 *   { at: "2026-09-25T14:30:00.000Z", note?: "Gọi chốt gói L3" } → đặt hẹn
 *   { at: null }                                                → gỡ hẹn
 *   { done: true }                                              → đã chăm xong,
 *       giữ lại mốc hẹn để còn xem lịch sử nhưng thôi không nhắc nữa.
 *
 * Giờ hẹn do trình duyệt của người đặt quy ra ISO, nên máy chủ chỉ việc nhận một
 * mốc tuyệt đối — không phải đoán múi giờ.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lead = await findLeadForCare(params.id, session.user);
  if (!lead) {
    return NextResponse.json({ error: "Không tìm thấy hoặc không có quyền" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({})) as {
    at?:   string | null;
    note?: string | null;
    done?: boolean;
  };

  // ── Chốt xong: tắt nhắc, giữ nguyên mốc hẹn ──
  if (body.done) {
    const updated = await prisma.salesLead.update({
      where:  { id: lead.id },
      data:   { followUpDoneAt: new Date() },
      select: { id: true, followUpAt: true, followUpNote: true, followUpDoneAt: true },
    });
    return NextResponse.json(serialize(updated));
  }

  // ── Gỡ hẹn ──
  if (body.at === null) {
    const updated = await prisma.salesLead.update({
      where: { id: lead.id },
      data: {
        followUpAt:     null,
        followUpNote:   null,
        followUpById:   null,
        followUpDoneAt: null,
      },
      select: { id: true, followUpAt: true, followUpNote: true, followUpDoneAt: true },
    });
    return NextResponse.json(serialize(updated));
  }

  // ── Đặt / sửa hẹn ──
  const at = body.at ? new Date(body.at) : null;
  if (!at || isNaN(at.getTime())) {
    return NextResponse.json({ error: "Thời điểm hẹn không hợp lệ" }, { status: 400 });
  }

  const updated = await prisma.salesLead.update({
    where: { id: lead.id },
    data: {
      followUpAt:     at,
      followUpNote:   body.note?.trim() ? body.note.trim() : null,
      followUpById:   session.user.id,
      // Đặt lại hẹn là mở lại lời nhắc — hẹn cũ đã chốt xong không được kéo theo
      // làm cái hẹn mới im lặng ngay từ lúc sinh ra.
      followUpDoneAt: null,
    },
    select: { id: true, followUpAt: true, followUpNote: true, followUpDoneAt: true },
  });

  return NextResponse.json(serialize(updated));
}

function serialize(l: {
  id: string;
  followUpAt: Date | null;
  followUpNote: string | null;
  followUpDoneAt: Date | null;
}) {
  return {
    id:             l.id,
    followUpAt:     l.followUpAt?.toISOString() ?? null,
    followUpNote:   l.followUpNote,
    followUpDoneAt: l.followUpDoneAt?.toISOString() ?? null,
  };
}
