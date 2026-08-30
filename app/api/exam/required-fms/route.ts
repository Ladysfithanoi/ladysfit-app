import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Danh sách FM bắt buộc thi — xem lib/exam-required-fm.ts cho ý nghĩa.
// Chỉ Admin đọc và sửa được.

async function listFMs() {
  const [fms, required] = await Promise.all([
    prisma.user.findMany({
      where: { role: "FM", deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        branch: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.examRequiredFM.findMany({ select: { userId: true } }),
  ]);

  const requiredIds = new Set(required.map((r) => r.userId));

  return fms.map((fm) => ({
    id: fm.id,
    name: fm.name,
    email: fm.email,
    branchName: fm.branch?.name ?? null,
    required: requiredIds.has(fm.id),
  }));
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(await listFMs());
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { userIds } = body as { userIds?: unknown };

  if (!Array.isArray(userIds) || userIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "Danh sách FM không hợp lệ" }, { status: 400 });
  }

  const wanted = Array.from(new Set(userIds as string[]));

  // Chỉ nhận đúng FM đang hoạt động — chặn việc gán nhầm HLV/Admin vào danh sách
  // này (HLV vốn đã phải thi, còn Admin thì có bài thi thử riêng).
  if (wanted.length > 0) {
    const valid = await prisma.user.findMany({
      where: { id: { in: wanted }, role: "FM", deletedAt: null },
      select: { id: true },
    });
    if (valid.length !== wanted.length) {
      return NextResponse.json(
        { error: "Danh sách chứa người không phải FM đang hoạt động" },
        { status: 400 }
      );
    }
  }

  // Thay nguyên danh sách: bỏ tên ai không còn được chọn, thêm tên mới. Bài thi
  // đã nộp vẫn giữ nguyên — bỏ khỏi danh sách chỉ nghĩa là kỳ sau không phải thi.
  await prisma.$transaction([
    prisma.examRequiredFM.deleteMany({ where: { userId: { notIn: wanted } } }),
    prisma.examRequiredFM.createMany({
      data: wanted.map((userId) => ({ userId })),
      skipDuplicates: true,
    }),
  ]);

  return NextResponse.json(await listFMs());
}
