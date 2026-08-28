import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseQuestionMedia } from "@/lib/exam-media";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const questions = await prisma.examQuestion.findMany({
    orderBy: { order: "asc" },
  });
  return NextResponse.json(questions);
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
    },
  });

  return NextResponse.json(created, { status: 201 });
}
