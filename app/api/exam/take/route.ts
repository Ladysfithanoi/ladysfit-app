import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "RESTRICTED" && role !== "FREE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await prisma.examConfig.findFirst();
  const numQuestions = config?.numQuestions ?? 10;
  const passingScore = config?.passingScore ?? 80;

  const allQuestions = await prisma.examQuestion.findMany({ orderBy: { order: "asc" } });

  if (allQuestions.length === 0) {
    return NextResponse.json({ error: "Chưa có câu hỏi trong ngân hàng" }, { status: 400 });
  }

  // Shuffle and pick numQuestions
  const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.min(numQuestions, shuffled.length));

  // Strip correct answer before sending to client
  const questions = picked.map(({ id, question, optionA, optionB, optionC, optionD }) => ({
    id,
    question,
    optionA,
    optionB,
    optionC,
    optionD,
  }));

  return NextResponse.json({ questions, passingScore });
}
