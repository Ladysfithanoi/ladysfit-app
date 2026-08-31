import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Lịch sử thi CỦA CHÍNH NGƯỜI ĐANG ĐĂNG NHẬP.
 *
 * Khác /api/exam/attempts (chỉ Admin, xem được bài của tất cả mọi người): ở đây
 * ai cũng gọi được nhưng chỉ thấy bài của mình — where luôn khoá theo userId
 * của phiên đăng nhập, không nhận userId từ tham số.
 *
 * Số bài của một người rất ít (mỗi kỳ thi một bài) nên lọc và phân trang ngay
 * trong bộ nhớ cho gọn, khỏi phải đếm bằng hai truy vấn.
 */

const PAGE_SIZE = 5;

/** Năm theo giờ VN — bài thi lúc 23h ngày 31/12 vẫn thuộc về năm cũ. */
function vnYear(d: Date): number {
  return new Date(d.getTime() + 7 * 60 * 60 * 1000).getUTCFullYear();
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const result = url.searchParams.get("result") ?? "all";
  const year = url.searchParams.get("year") ?? "";

  const [all, config] = await Promise.all([
    prisma.examAttempt.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        score: true,
        total: true,
        passed: true,
        createdAt: true,
        violations: true,
      },
    }),
    prisma.examConfig.findFirst({ select: { passingScore: true } }),
  ]);

  // Danh sách năm cho bộ lọc lấy từ TOÀN BỘ bài, không phải từ trang đang xem.
  const years = Array.from(new Set(all.map((a) => vnYear(a.createdAt)))).sort((a, b) => b - a);

  let rows = all;
  if (result === "passed") rows = rows.filter((a) => a.passed);
  else if (result === "failed") rows = rows.filter((a) => !a.passed);
  if (/^\d{4}$/.test(year)) rows = rows.filter((a) => vnYear(a.createdAt) === Number(year));

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // Đổi bộ lọc lúc đang ở trang 3 mà kết quả chỉ còn 1 trang thì kéo về trang cuối.
  const safePage = Math.min(page, totalPages);
  const slice = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return NextResponse.json({
    attempts: slice.map((a) => ({
      id: a.id,
      score: a.score,
      total: a.total,
      scorePct: a.total > 0 ? Math.round((a.score / a.total) * 100) : 0,
      passed: a.passed,
      createdAt: a.createdAt.toISOString(),
      violations: a.violations,
    })),
    page: safePage,
    totalPages,
    total: rows.length,
    grandTotal: all.length,
    years,
    passingScore: config?.passingScore ?? 80,
  });
}
