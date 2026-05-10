import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { texts } = (await req.json()) as { texts: string[] };
    if (!Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ duplicates: [] });
    }

    const textsLower = new Set(texts.map((t) => t.toLowerCase()));
    const existing = await prisma.examQuestion.findMany({ select: { question: true } });
    const duplicates = existing
      .filter((e) => textsLower.has(e.question.toLowerCase()))
      .map((e) => e.question);

    return NextResponse.json({ duplicates });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Lỗi server";
    console.error("Exam import check error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
