import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseQuestionMedia } from "@/lib/exam-media";
import { validLevelIds, NO_LEVEL_SELECTED } from "@/lib/exam-level";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { question, optionA, optionB, optionC, optionD, correct } = body;

  const media = parseQuestionMedia(body);
  if (!media.ok) return NextResponse.json({ error: media.error }, { status: 400 });

  // Chỉ đụng tới danh sách cấp khi request có gửi lên — người sửa mỗi chữ trong
  // câu hỏi không vô tình gỡ câu đó khỏi đề của các cấp.
  let levelUpdate = undefined;
  if ("levelIds" in body) {
    const levelIds = await validLevelIds(body.levelIds);
    if (levelIds.length === 0) {
      return NextResponse.json({ error: NO_LEVEL_SELECTED }, { status: 400 });
    }
    levelUpdate = {
      deleteMany: { levelId: { notIn: levelIds } },
      upsert: levelIds.map((levelId) => ({
        where: { questionId_levelId: { questionId: params.id, levelId } },
        create: { levelId },
        update: {},
      })),
    };
  }

  const updated = await prisma.examQuestion.update({
    where: { id: params.id },
    data: {
      question,
      optionA,
      optionB,
      optionC,
      optionD,
      correct,
      // Xoá ảnh/video khỏi câu hỏi = gửi lên chuỗi rỗng → null.
      imageUrl: media.imageUrl,
      videoUrl: media.videoUrl,
      ...(levelUpdate ? { levels: levelUpdate } : {}),
    },
    include: { levels: { select: { levelId: true } } },
  });

  const { levels, ...rest } = updated;
  return NextResponse.json({ ...rest, levelIds: levels.map((l) => l.levelId) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.examQuestion.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
