import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseQuestionMedia } from "@/lib/exam-media";
import { validLevelIds, NO_LEVEL_SELECTED } from "@/lib/exam-level";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ?levelId=... — chỉ lấy đề của một cấp. Bỏ trống thì trả cả ngân hàng, mỗi
  // câu kèm danh sách cấp đang dùng nó.
  const levelId = new URL(req.url).searchParams.get("levelId");

  const questions = await prisma.examQuestion.findMany({
    where: levelId ? { levels: { some: { levelId } } } : undefined,
    orderBy: { order: "asc" },
    include: { levels: { select: { levelId: true } } },
  });

  return NextResponse.json(
    questions.map(({ levels, ...q }) => ({ ...q, levelIds: levels.map((l) => l.levelId) }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { question, optionA, optionB, optionC, optionD, correct } = body;

  if (!question || !optionA || !optionB || !optionC || !optionD || !correct) {
    return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
  }

  const media = parseQuestionMedia(body);
  if (!media.ok) return NextResponse.json({ error: media.error }, { status: 400 });

  // Câu hỏi không thuộc cấp nào thì không bao giờ được bốc ra thi — chặn ngay
  // thay vì để nó nằm im trong ngân hàng mà chẳng ai hiểu vì sao đề thiếu câu.
  const levelIds = await validLevelIds(body.levelIds);
  if (levelIds.length === 0) {
    return NextResponse.json({ error: NO_LEVEL_SELECTED }, { status: 400 });
  }

  const count = await prisma.examQuestion.count();
  const created = await prisma.examQuestion.create({
    data: {
      question,
      optionA,
      optionB,
      optionC,
      optionD,
      correct,
      order: count,
      imageUrl: media.imageUrl,
      videoUrl: media.videoUrl,
      levels: { create: levelIds.map((levelId) => ({ levelId })) },
    },
    include: { levels: { select: { levelId: true } } },
  });

  const { levels, ...rest } = created;
  return NextResponse.json(
    { ...rest, levelIds: levels.map((l) => l.levelId) },
    { status: 201 }
  );
}
