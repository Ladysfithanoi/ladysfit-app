import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExamWindow } from "@/lib/exam-schedule";
import { isRequiredExamFM } from "@/lib/exam-required-fm";
import { hasTakenExam } from "@/lib/exam-session";
import { resolveExamLevel, emptyBankMessage } from "@/lib/exam-level";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const [user, lastAttempt, config, sysConfig, defaultLevel, allLevels, requiredFM] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, ptLevel: { select: { id: true, name: true, color: true, retestIntervalDays: true, order: true } } },
    }),
    // Lần thi gần nhất ĐỀ CỦA CẤP HIỆN TẠI — bài của cấp cũ không còn nói lên
    // điều gì về việc họ có qua được cửa hiện tại hay không.
    prisma.user.findUnique({ where: { id: userId }, select: { ptLevelId: true } }).then(u =>
      u?.ptLevelId
        ? prisma.examAttempt.findFirst({
            where: { userId, levelId: u.ptLevelId },
            orderBy: { createdAt: "desc" },
          })
        : null
    ),
    prisma.examConfig.findFirst(),
    prisma.systemConfig.findUnique({ where: { id: "main" } }),
    prisma.pTLevel.findFirst({ where: { isDefault: true, isActive: true }, select: { id: true, name: true, color: true, order: true } }),
    prisma.pTLevel.findMany({ where: { isActive: true }, select: { id: true, name: true, color: true, order: true }, orderBy: { order: "asc" } }),
    // FM được Admin chỉ định bắt buộc thi — xem lib/exam-required-fm.ts.
    session.user.role === "FM" ? isRequiredExamFM(userId) : Promise.resolve(false),
  ]);

  // Số câu / điểm đạt hiện lên thẻ mời thi phải là của ĐỀ người này sẽ làm:
  // HLV theo cấp của mình, FM theo đề Admin chỉ định ở tab Lịch thi.
  const examLevel = await resolveExamLevel({ userId, role: user?.role ?? "PT", config });
  const passingScore = examLevel.ok ? examLevel.settings.passingScore : config?.passingScore ?? 80;
  const numQuestions = examLevel.ok ? examLevel.settings.numQuestions : config?.numQuestions ?? 10;
  const examLevelName = examLevel.ok ? examLevel.settings.levelName : null;
  // Cấp chưa được soạn đề thì nói thẳng, đừng để người ta bấm vào rồi mới báo lỗi.
  const bankCount = examLevel.ok && examLevel.settings.levelId
    ? await prisma.examQuestionLevel.count({ where: { levelId: examLevel.settings.levelId } })
    : 0;
  const examUnavailableReason = !examLevel.ok
    ? examLevel.message
    : bankCount === 0
      ? emptyBankMessage(examLevelName)
      : null;
  const enableLevelSystem = sysConfig?.enableLevelSystem ?? true;

  const retestIntervalDays = user?.ptLevel?.retestIntervalDays ?? 30;

  const examWindow = getExamWindow({
    scheduleEnabled: config?.scheduleEnabled ?? false,
    examDate: config?.examDate ?? null,
    examStartTime: config?.examStartTime ?? "00:00",
    examEndTime: config?.examEndTime ?? "23:59",
  });

  // Mỗi người chỉ thi một lần một kỳ — thi rồi thì thẻ mời thi đổi thành lời
  // nhắn "đã hoàn thành" thay vì nút Thi lại. Xem lib/exam-session.ts.
  const alreadyTaken = await hasTakenExam(userId, config?.examDate ?? null, examWindow);

  // Next level above the PT's current level
  const nextLevel = user?.ptLevel
    ? allLevels.find((l) => l.order > user.ptLevel!.order) ?? null
    : allLevels.length > 0 ? allLevels[0] : null;

  // PT is "at default level" when their level is the default (or they have no level yet)
  const isAtDefaultLevel =
    !user?.ptLevel || !defaultLevel || user.ptLevel.order <= defaultLevel.order;

  return NextResponse.json({
    role: user?.role,
    retestIntervalDays,
    ptLevelName: user?.ptLevel?.name ?? null,
    ptLevelColor: user?.ptLevel?.color ?? null,
    defaultLevelName: defaultLevel?.name ?? null,
    defaultLevelColor: defaultLevel?.color ?? null,
    nextLevelName: nextLevel?.name ?? null,
    nextLevelColor: nextLevel?.color ?? null,
    isAtDefaultLevel: isAtDefaultLevel ?? false,
    lastAttempt: lastAttempt
      ? {
          id: lastAttempt.id,
          score: lastAttempt.score,
          total: lastAttempt.total,
          passed: lastAttempt.passed,
          createdAt: lastAttempt.createdAt.toISOString(),
        }
      : null,
    passingScore,
    numQuestions,
    // Tên cấp của ĐỀ sẽ làm, và lý do chưa thi được (chưa xếp cấp / cấp chưa có đề).
    examLevelName,
    examUnavailableReason,
    enableLevelSystem,
    // Đã thi kỳ này rồi, không vào thi lại được nữa.
    alreadyTaken,
    // FM bắt buộc thi: làm cùng đề với HLV nhưng điểm chỉ để Admin nắm trình
    // độ — trượt không bị phạt, không ảnh hưởng cấp bậc.
    isRequiredFM: requiredFM,
    exam: {
      state: examWindow.state,
      open: examWindow.open,
      message: examWindow.message,
      examDate: config?.examDate ?? null,
      examStartTime: config?.examStartTime ?? "00:00",
      examEndTime: config?.examEndTime ?? "23:59",
      durationMinutes: config?.durationMinutes ?? 0,
      focusPenaltyMinutes: config?.focusPenaltyMinutes ?? 0,
    },
  });
}
