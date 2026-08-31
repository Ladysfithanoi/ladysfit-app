import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidExamDate, isValidExamTime, vnInstant } from "@/lib/exam-schedule";
import { isValidWeights, WEIGHT_TOTAL } from "@/lib/ranking-config";

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
    durationMinutes,
    focusPenaltyMinutes,
    rankWeightExam,
    rankWeightRevenue,
    rankWeightTransform,
  } = body;

  const config = await getOrCreateConfig();

  // ── Trọng số xếp hạng ─────────────────────────────────────────────────────
  const weights = {
    exam: rankWeightExam ?? config.rankWeightExam,
    revenue: rankWeightRevenue ?? config.rankWeightRevenue,
    transform: rankWeightTransform ?? config.rankWeightTransform,
  };
  const weightsTouched =
    rankWeightExam !== undefined ||
    rankWeightRevenue !== undefined ||
    rankWeightTransform !== undefined;
  if (weightsTouched && !isValidWeights(weights)) {
    return NextResponse.json(
      { error: `Tổng 3 trọng số phải bằng ${WEIGHT_TOTAL}%` },
      { status: 400 }
    );
  }

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

  // Thời lượng làm bài (phút). 0 = không giới hạn. Trần 600 phút để một lần gõ
  // nhầm không biến kỳ thi thành vô hạn.
  let nextDuration = config.durationMinutes;
  if (durationMinutes !== undefined) {
    const n = Number(durationMinutes);
    if (!Number.isInteger(n) || n < 0 || n > 600) {
      return NextResponse.json(
        { error: "Thời lượng thi phải là số phút từ 0 đến 600 (0 = không giới hạn)" },
        { status: 400 }
      );
    }
    nextDuration = n;
  }

  // Phạt rời khỏi trang thi (phút mỗi lần). 0 = chỉ ghi nhận số lần, không trừ
  // giờ. Trần 180 phút cho khỏi gõ nhầm thành con số vô nghĩa.
  let nextFocusPenalty = config.focusPenaltyMinutes;
  if (focusPenaltyMinutes !== undefined) {
    const n = Number(focusPenaltyMinutes);
    if (!Number.isInteger(n) || n < 0 || n > 180) {
      return NextResponse.json(
        { error: "Phạt rời trang phải là số phút từ 0 đến 180 (0 = không trừ giờ)" },
        { status: 400 }
      );
    }
    nextFocusPenalty = n;
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
      durationMinutes: nextDuration,
      focusPenaltyMinutes: nextFocusPenalty,
      rankWeightExam: weights.exam,
      rankWeightRevenue: weights.revenue,
      rankWeightTransform: weights.transform,
    },
  });

  return NextResponse.json(updated);
}
