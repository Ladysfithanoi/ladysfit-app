import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getOrCreateConfig() {
  const existing = await prisma.examConfig.findFirst();
  if (existing) return existing;
  return prisma.examConfig.create({ data: {} });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await getOrCreateConfig();
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { numQuestions, passingScore, shuffleQuestions } = body;

  const config = await getOrCreateConfig();
  const updated = await prisma.examConfig.update({
    where: { id: config.id },
    data: {
      numQuestions: numQuestions ?? config.numQuestions,
      passingScore: passingScore ?? config.passingScore,
      ...(shuffleQuestions !== undefined && { shuffleQuestions }),
    },
  });

  return NextResponse.json(updated);
}
