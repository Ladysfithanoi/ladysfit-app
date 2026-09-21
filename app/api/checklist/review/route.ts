import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dayRange, isValidRating } from "@/lib/checklist-review";

/**
 * PUT /api/checklist/review — FM chấm đánh giá cho check-list một ngày của một
 * nhân sự, sau khi đọc tự luận cuối ngày của họ.
 *
 * Chỉ FM phụ trách cơ sở của người đó (và Admin) mới chấm được, và chỉ chấm cho
 * NGƯỜI KHÁC: tự chấm cho mình thì con số trên màn Tổng kết đánh giá không còn
 * nghĩa lý gì.
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

  const checklist = await prisma.dailyChecklist.findFirst({
    where:  { userId: body.userId, reportDate: dayRange(body.date) },
    select: { id: true },
  });
  if (!checklist) {
    return NextResponse.json(
      { error: "Nhân sự chưa có check-list cho ngày này" },
      { status: 404 },
    );
  }

  // Xoá trắng cả điểm lẫn nhận xét thì coi như gỡ đánh giá, để ngày đó không bị
  // đếm vào số lần đã chấm của kỳ.
  const cleared = rating === null && comment === null;

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
