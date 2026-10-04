import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dayRange, isValidRating, toDateOnly } from "@/lib/checklist-review";
import { todayVN } from "@/lib/week";

/**
 * PUT /api/checklist/review — FM chấm đánh giá cho check-list một ngày của một
 * nhân sự, sau khi đọc tự luận cuối ngày của họ.
 *
 * Chỉ FM phụ trách cơ sở của người đó (và Admin) mới chấm được, và chỉ chấm cho
 * NGƯỜI KHÁC: tự chấm cho mình thì con số trên màn Tổng kết đánh giá không còn
 * nghĩa lý gì.
 *
 * Ngày nhân sự bỏ trống cũng chấm được (thường là 1 sao vì không làm gì): khi đó
 * tạo một check-list rỗng chỉ để giữ điểm. Trước đây chỗ này trả 404, điểm không
 * lưu, nên người bỏ trống check-list lại được điểm trung bình cao hơn người làm.
 * Dòng rỗng đó không tính là "đã điền" (xem isChecklistFilled).
 */

/** Cơ sở của nhân sự có nằm trong số cơ sở FM này phụ trách không. */
async function canReview(
  actor: { id: string; role?: string | null; managedBranchIds?: string[] },
  targetUserId: string,
): Promise<boolean> {
  if (targetUserId === actor.id) return false;
  if (actor.role === "ADMIN") return true;
  if (actor.role !== "FM") return false;

  const managed = actor.managedBranchIds ?? [];
  if (managed.length === 0) return false;

  const target = await prisma.user.findUnique({
    where:  { id: targetUserId },
    select: { branchId: true },
  });
  return !!target?.branchId && managed.includes(target.branchId);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    date?:    string;
    userId?:  string;
    rating?:  number | null;
    comment?: string | null;
  };

  if (!body.date || !body.userId) {
    return NextResponse.json({ error: "Thiếu ngày hoặc nhân sự" }, { status: 400 });
  }
  if (!(await canReview(session.user, body.userId))) {
    return NextResponse.json({ error: "Không có quyền đánh giá nhân sự này" }, { status: 403 });
  }

  // Điểm để trống được (FM chỉ muốn ghi nhận xét), nhưng đã chấm thì phải trong
  // thang 1–5 — con số ngoài thang sẽ làm hỏng điểm trung bình của cả kỳ.
  const rating = body.rating == null ? null : Number(body.rating);
  if (rating !== null && !isValidRating(rating)) {
    return NextResponse.json({ error: "Điểm đánh giá phải từ 1 đến 5" }, { status: 400 });
  }

  const comment = body.comment?.trim() ? body.comment.trim() : null;

  // Xoá trắng cả điểm lẫn nhận xét thì coi như gỡ đánh giá, để ngày đó không bị
  // đếm vào số lần đã chấm của kỳ.
  const cleared = rating === null && comment === null;

  let checklist = await prisma.dailyChecklist.findFirst({
    where:  { userId: body.userId, reportDate: dayRange(body.date) },
    select: { id: true },
  });
  if (!checklist) {
    if (cleared) {
      return NextResponse.json({
        fmRating: null, fmComment: null, fmReviewedAt: null, fmReviewerName: null,
      });
    }
    // Ngày chưa tới thì chưa có gì để chấm.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date) || body.date > todayVN()) {
      return NextResponse.json({ error: "Chưa thể đánh giá ngày chưa tới" }, { status: 400 });
    }
    checklist = await prisma.dailyChecklist.create({
      data:   { userId: body.userId, reportDate: toDateOnly(body.date) },
      select: { id: true },
    });
  }

  const updated = await prisma.dailyChecklist.update({
    where: { id: checklist.id },
    data: {
      fmRating:     rating,
      fmComment:    comment,
      fmReviewedAt: cleared ? null : new Date(),
      fmReviewerId: cleared ? null : session.user.id,
    },
    select: {
      fmRating: true, fmComment: true, fmReviewedAt: true,
      fmReviewer: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({
    fmRating:     updated.fmRating,
    fmComment:    updated.fmComment,
    fmReviewedAt: updated.fmReviewedAt?.toISOString() ?? null,
    fmReviewerName: updated.fmReviewer?.name ?? updated.fmReviewer?.email ?? null,
  });
}
