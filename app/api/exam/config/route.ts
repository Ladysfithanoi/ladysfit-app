import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidExamDate, isValidExamTime, vnInstant } from "@/lib/exam-schedule";

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
  const {
    numQuestions,
    passingScore,
    shuffleQuestions,
    scheduleEnabled,
    examDate,
    examStartTime,
    examEndTime,
  } = body;

  const config = await getOrCreateConfig();

  // ── Lịch thi ──────────────────────────────────────────────────────────────
  const nextEnabled = scheduleEnabled ?? config.scheduleEnabled;

  let nextDate = config.examDate;
  if (examDate !== undefined) {
    if (examDate === null || examDate === "") {
      nextDate = null;
    } else if (isValidExamDate(examDate)) {
      nextDate = examDate;
    } else {
      return NextResponse.json({ error: "Ngày thi không hợp lệ" }, { status: 400 });
    }
  }

  let nextStart = config.examStartTime;
  if (examStartTime !== undefined) {
    if (!isValidExamTime(examStartTime)) {
      return NextResponse.json({ error: "Giờ bắt đầu không hợp lệ" }, { status: 400 });
    }
    nextStart = examStartTime;
  }

  let nextEnd = config.examEndTime;
  if (examEndTime !== undefined) {
    if (!isValidExamTime(examEndTime)) {
      return NextResponse.json({ error: "Giờ kết thúc không hợp lệ" }, { status: 400 });
    }
    nextEnd = examEndTime;
  }

  const refDate = nextDate ?? "2000-01-01";
  if (vnInstant(refDate, nextEnd, true) <= vnInstant(refDate, nextStart)) {
    return NextResponse.json({ error: "Giờ kết thúc phải sau giờ bắt đầu" }, { status: 400 });
  }

  if (nextEnabled && !nextDate) {
    return NextResponse.json({ error: "Cần chọn ngày thi khi bật lịch thi" }, { status: 400 });
  }

  const updated = await prisma.examConfig.update({
    where: { id: config.id },
    data: {
      numQuestions: numQuestions ?? config.numQuestions,
      passingScore: passingScore ?? config.passingScore,
      ...(shuffleQuestions !== undefined && { shuffleQuestions }),
      scheduleEnabled: nextEnabled,
      examDate: nextDate,
      examStartTime: nextStart,
      examEndTime: nextEnd,
    },
  });

  return NextResponse.json(updated);
}
