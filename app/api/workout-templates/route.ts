import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Lịch tập mẫu (bài tập mặc định theo giai đoạn / loại buổi / chuyển động).
// GET: dùng cho cả trang cài đặt (load theo phaseKey) và nút "Copy từ lịch mẫu"
//      của PT (lọc thêm sessionType).
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const phaseKey = searchParams.get("phaseKey");
  const sessionType = searchParams.get("sessionType");

  const rows = await prisma.workoutScheduleTemplate.findMany({
    where: {
      ...(phaseKey ? { phaseKey } : {}),
      ...(sessionType ? { sessionType } : {}),
    },
    orderBy: [{ phaseKey: "asc" }, { sessionType: "asc" }, { movement: "asc" }],
  });

  return NextResponse.json(rows);
}

// PUT (ADMIN): lưu một chuyển động của lịch mẫu. exercise rỗng → xoá.
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    phaseKey?: string;
    sessionType?: string;
    movement?: string;
    exercise?: string;
  };
  const phaseKey = body.phaseKey?.trim();
  const sessionType = body.sessionType?.trim();
  const movement = body.movement?.trim();
  const exercise = (body.exercise ?? "").trim();

  if (!phaseKey || !sessionType || !movement) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!exercise) {
    await prisma.workoutScheduleTemplate.deleteMany({
      where: { phaseKey, sessionType, movement },
    });
    return NextResponse.json({ ok: true, deleted: true });
  }

  const row = await prisma.workoutScheduleTemplate.upsert({
    where: { phaseKey_sessionType_movement: { phaseKey, sessionType, movement } },
    create: { phaseKey, sessionType, movement, exercise },
    update: { exercise },
  });

  return NextResponse.json(row);
}
