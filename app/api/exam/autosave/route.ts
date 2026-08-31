import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Tự lưu bài đang làm dở.
 *
 * Trang làm bài gọi vào đây mỗi khi người thi chọn thêm đáp án (có gom lại vài
 * giây một lần cho đỡ ồn), và gọi thêm một lần lúc rời trang.
 *
 * Có cái này thì hết giờ nộp không kịp, mất mạng, sập trình duyệt hay hết pin
 * cũng không mất bài: phần đã lưu vẫn chấm lại được — xem lib/exam-grading.
 *
 * Luôn trả 200 kèm trạng thái. Tự lưu hỏng là chuyện của hậu trường, không được
 * phép hiện lỗi chắn ngang mặt người đang thi.
 */

const VALID_OPTIONS = new Set(["A", "B", "C", "D", ""]);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const raw = (body as { answers?: unknown }).answers;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ saved: false });
  }

  const config = await prisma.examConfig.findFirst({ select: { examDate: true } });
  const examKey = config?.examDate ?? null;
  if (!examKey) return NextResponse.json({ saved: false });

  const examSession = await prisma.examSession.findUnique({
    where: { userId_examKey: { userId: session.user.id, examKey } },
    select: { id: true, submittedAt: true, questionIds: true },
  });
  // Chưa mở đề, hoặc đã nộp bài rồi thì không ghi đè lên gì cả.
  if (!examSession || examSession.submittedAt) {
    return NextResponse.json({ saved: false });
  }

  // Chỉ nhận đáp án của đúng những câu trong đề đã bốc, và chỉ nhận A/B/C/D.
  // Không lọc thì client gửi lên id lạ là bài chấm ra số câu khác đề.
  let allowed: Set<string>;
  try {
    const ids = JSON.parse(examSession.questionIds);
    allowed = new Set(Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : []);
  } catch {
    allowed = new Set();
  }

  const clean: Record<string, string> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.has(id)) continue;
    if (typeof value !== "string" || !VALID_OPTIONS.has(value)) continue;
    if (value) clean[id] = value;
  }

  await prisma.examSession.update({
    where: { id: examSession.id },
    data: { answers: JSON.stringify(clean) },
  });

  return NextResponse.json({ saved: true, count: Object.keys(clean).length });
}
