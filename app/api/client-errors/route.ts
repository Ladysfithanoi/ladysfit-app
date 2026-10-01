import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Màn "Đã xảy ra lỗi" (app/dashboard/error.tsx) gửi lỗi thật về đây. Chỉ nhận
// từ người đã đăng nhập, cắt độ dài để một vòng lặp lỗi không làm phình bảng.
const cut = (v: unknown, n: number) => (typeof v === "string" && v ? v.slice(0, n) : null);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const message = cut(body?.message, 2000);
  if (!message) return NextResponse.json({ error: "Thiếu nội dung lỗi" }, { status: 400 });

  await prisma.clientErrorLog.create({
    data: {
      userId:    session.user.id,
      message,
      stack:     cut(body?.stack, 8000),
      digest:    cut(body?.digest, 200),
      url:       cut(body?.url, 1000),
      userAgent: cut(req.headers.get("user-agent"), 500),
    },
  });
  return NextResponse.json({ ok: true });
}
