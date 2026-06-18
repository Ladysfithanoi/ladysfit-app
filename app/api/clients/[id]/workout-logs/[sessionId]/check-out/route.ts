import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  countPackageSession,
  notifyNextSession,
  serializeWorkoutLog,
  MAX_SESSION_MINUTES,
  OVER_CAP_VOID_REASON,
} from "@/lib/workout-session";

type SetLogInput = {
  id: string;
  set1Load?: string | null; set1Reps?: string | null;
  set2Load?: string | null; set2Reps?: string | null;
  set3Load?: string | null; set3Reps?: string | null;
  set4Load?: string | null; set4Reps?: string | null;
  set5Load?: string | null; set5Reps?: string | null;
  set6Load?: string | null; set6Reps?: string | null;
  exerciseNotes?: string | null;
};

function hasData(sl: SetLogInput): boolean {
  return [
    sl.set1Load, sl.set1Reps, sl.set2Load, sl.set2Reps, sl.set3Load, sl.set3Reps,
    sl.set4Load, sl.set4Reps, sl.set5Load, sl.set5Reps, sl.set6Load, sl.set6Reps,
  ].some((v) => v != null && String(v).trim() !== "");
}

const INCLUDE = {
  setLogs: { orderBy: { id: "asc" } },
  createdBy: { select: { id: true, name: true } },
} as const;

// POST /api/clients/[id]/workout-logs/[logId]/check-out
// PT ends the session. The client signs on the PT's device to confirm the PT
// taught this session → it becomes COMPLETED and counts toward the PT's salary.
// The package was already deducted at check-in, so it is NOT touched here.
export async function POST(
  req: Request,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const logId = params.sessionId; // dynamic segment reused as logId
    const log = await prisma.workoutLog.findFirst({
      where: { id: logId, clientId: params.id },
      include: { session: { select: { sessionName: true } } },
    });
    if (!log) return NextResponse.json({ error: "Không tìm thấy bản ghi" }, { status: 404 });
    // Accept a still-running session (IN_PROGRESS) or a legacy orphan left in
    // AWAITING_CONFIRMATION by the old "client confirms on their app" flow (since
    // removed). For an orphan the PT already finished teaching, so this check-out
    // signature is just the fallback confirmation that completes it.
    if (log.status !== "IN_PROGRESS" && log.status !== "AWAITING_CONFIRMATION") {
      return NextResponse.json({ error: "Buổi tập này đã được kết thúc" }, { status: 400 });
    }
    const isAwaiting = log.status === "AWAITING_CONFIRMATION";
    if (!log.checkInAt) {
      return NextResponse.json({ error: "Buổi tập thiếu thời điểm check-in" }, { status: 400 });
    }

    const body = (await req.json()) as {
      signatureUrl?: string | null;
      notes?: string | null;
      setLogs?: SetLogInput[];
    };
    const setLogs = body.setLogs ?? [];

    // Persist latest set data.
    if (setLogs.length > 0) {
      await Promise.all(
        setLogs.map((sl) =>
          prisma.workoutSetLog.update({
            where: { id: sl.id },
            data: {
              set1Load: sl.set1Load != null ? String(sl.set1Load) : null,
              set1Reps: sl.set1Reps != null ? String(sl.set1Reps) : null,
              set2Load: sl.set2Load != null ? String(sl.set2Load) : null,
              set2Reps: sl.set2Reps != null ? String(sl.set2Reps) : null,
              set3Load: sl.set3Load != null ? String(sl.set3Load) : null,
              set3Reps: sl.set3Reps != null ? String(sl.set3Reps) : null,
              set4Load: sl.set4Load != null ? String(sl.set4Load) : null,
              set4Reps: sl.set4Reps != null ? String(sl.set4Reps) : null,
              set5Load: sl.set5Load != null ? String(sl.set5Load) : null,
              set5Reps: sl.set5Reps != null ? String(sl.set5Reps) : null,
              set6Load: sl.set6Load != null ? String(sl.set6Load) : null,
              set6Reps: sl.set6Reps != null ? String(sl.set6Reps) : null,
              exerciseNotes: sl.exerciseNotes ?? null,
            },
          })
        )
      );
    }

    const now = new Date();

    // Client approved ending this session early (khách có việc, vẫn đồng ý tính
    // buổi). When so, skip the min-duration and 6-exercise gates — the PT can
    // still get the check-out signature and the teaching session counts.
    // Skip the min-duration / 6-exercise gates when the client approved an early
    // end, or when this is a legacy AWAITING orphan (session already finished —
    // the gates only make sense while a session is genuinely in progress).
    const earlyEndApproved = log.earlyEndApprovedAt != null;
    const skipGates = earlyEndApproved || isAwaiting;

    // Stamp the time of first data entry (metadata only — no longer voids the session).
    let firstInteractionAt = log.firstInteractionAt;
    if (!firstInteractionAt && setLogs.some(hasData)) firstInteractionAt = now;

    // ── Rule: minimum duration ──
    const config = await prisma.systemConfig.findUnique({ where: { id: "main" } });
    const minMinutes = config?.minSessionMinutes ?? 30;
    const elapsedMin = (now.getTime() - log.checkInAt.getTime()) / 60000;

    // ── Rule: maximum duration (2-hour cap) ──
    // Past the cap the session is abandoned: the PT can no longer get a
    // legitimate check-out signature, so it must NOT count toward their salary.
    // Void it (keep the record + check-in signature). The package buổi is NOT
    // refunded — the client already signed the check-in, so the deduction stands.
    if (!isAwaiting && elapsedMin >= MAX_SESSION_MINUTES) {
      const voided = await prisma.workoutLog.update({
        where: { id: logId },
        data: { status: "VOID", voidReason: OVER_CAP_VOID_REASON },
        include: INCLUDE,
      });
      return NextResponse.json({ ...serializeWorkoutLog(voided), valid: false, autoCancelled: true });
    }

    if (!skipGates && elapsedMin < minMinutes) {
      if (firstInteractionAt && firstInteractionAt !== log.firstInteractionAt) {
        await prisma.workoutLog.update({ where: { id: logId }, data: { firstInteractionAt } });
      }
      return NextResponse.json(
        { error: `Buổi tập mới được ${Math.floor(elapsedMin)} phút, cần tối thiểu ${minMinutes} phút mới có thể xác nhận.` },
        { status: 400 }
      );
    }

    // ── Rule: at least 5 exercises must each have weight (load) + reps filled
    // for 3 sets ── Data-quality gate so a thin/empty session can't be signed
    // off. Applies to EVERY session (cardio included). Threshold is 5 (not 6)
    // because some session types only have 5 movements (e.g. "Skinny Fat|Mông"),
    // so requiring 6 made those sessions impossible to sign off.
    const MIN_SETS_PER_EXERCISE = 3;
    const MIN_COMPLETE_EXERCISES = 5;
    const completeExercises = setLogs.reduce((n, sl) => {
      const pairs: Array<[unknown, unknown]> = [
        [sl.set1Load, sl.set1Reps], [sl.set2Load, sl.set2Reps], [sl.set3Load, sl.set3Reps],
        [sl.set4Load, sl.set4Reps], [sl.set5Load, sl.set5Reps], [sl.set6Load, sl.set6Reps],
      ];
      const filledSets = pairs.filter(
        ([l, r]) =>
          l != null && String(l).trim() !== "" && r != null && String(r).trim() !== ""
      ).length;
      return n + (filledSets >= MIN_SETS_PER_EXERCISE ? 1 : 0);
    }, 0);
    if (!skipGates && completeExercises < MIN_COMPLETE_EXERCISES) {
      if (firstInteractionAt && firstInteractionAt !== log.firstInteractionAt) {
        await prisma.workoutLog.update({ where: { id: logId }, data: { firstInteractionAt } });
      }
      return NextResponse.json(
        { error: `Cần điền cân nặng và số reps cho ${MIN_SETS_PER_EXERCISE} set ở tối thiểu ${MIN_COMPLETE_EXERCISES} bài tập mới có thể hoàn thành buổi tập.` },
        { status: 400 }
      );
    }

    // ── Complete via the client's check-out signature (proof PT taught) ──
    // This is what credits the PT for the teaching session (salary). The
    // package was already advanced at check-in, so it is not touched here.
    const sig = (body.signatureUrl ?? "").trim();
    if (!sig) {
      if (firstInteractionAt && firstInteractionAt !== log.firstInteractionAt) {
        await prisma.workoutLog.update({ where: { id: logId }, data: { firstInteractionAt } });
      }
      return NextResponse.json({ error: "Cần chữ ký xác nhận của khách hàng" }, { status: 400 });
    }

    // Safety net for legacy/in-flight sessions checked in before the package was
    // deducted at check-in: if this log was never counted, count it now so the
    // client's package still advances. New sessions are already counted at
    // check-in (packageCounted = true), so this is a no-op for them.
    let packageUpdate = null;
    if (!log.packageCounted) {
      packageUpdate = await countPackageSession(params.id);
    }

    const completed = await prisma.workoutLog.update({
      where: { id: logId },
      data: {
        status: "COMPLETED",
        checkOutAt: now,
        confirmedAt: now,
        confirmationMethod: "SIGNATURE",
        firstInteractionAt,
        signatureUrl: sig,
        packageCounted: true,
        // If we just counted a legacy uncounted log, remember which lộ trình it
        // charged so a later delete/void refunds the exact same package.
        ...(packageUpdate ? { packageEnrollmentId: packageUpdate.id } : {}),
        notes: body.notes ?? log.notes,
      },
      include: INCLUDE,
    });

    // Notify the client of completion / next session (best-effort, no counting).
    await notifyNextSession(params.id, completed);

    return NextResponse.json({ ...serializeWorkoutLog(completed), valid: true, packageUpdate });
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[workout-logs check-out]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}
