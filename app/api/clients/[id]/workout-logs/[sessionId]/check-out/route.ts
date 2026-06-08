import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { incrementPackageAndNotify, serializeWorkoutLog } from "@/lib/workout-session";

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
// PT ends the session. Validates anti-cheat rules, then either:
//   - method "client_app": moves to AWAITING_CONFIRMATION (client must confirm on their app) — NOT counted yet
//   - method "signature":  completes now via the client's signature (fallback) — counted
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
    });
    if (!log) return NextResponse.json({ error: "Không tìm thấy bản ghi" }, { status: 404 });
    // Allow finishing an in-progress session, or falling back to a signature on a
    // session already waiting for the client's app confirmation.
    if (log.status !== "IN_PROGRESS" && log.status !== "AWAITING_CONFIRMATION") {
      return NextResponse.json({ error: "Buổi tập này đã được kết thúc" }, { status: 400 });
    }
    if (!log.checkInAt) {
      return NextResponse.json({ error: "Buổi tập thiếu thời điểm check-in" }, { status: 400 });
    }

    const body = (await req.json()) as {
      method?: "client_app" | "signature";
      signatureUrl?: string | null;
      notes?: string | null;
      setLogs?: SetLogInput[];
    };
    const method = body.method ?? (body.signatureUrl ? "signature" : "client_app");
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

    // Stamp the time of first data entry (metadata only — no longer voids the session).
    let firstInteractionAt = log.firstInteractionAt;
    if (!firstInteractionAt && setLogs.some(hasData)) firstInteractionAt = now;

    // ── Rule: minimum duration ──
    const config = await prisma.systemConfig.findUnique({ where: { id: "main" } });
    const minMinutes = config?.minSessionMinutes ?? 30;
    const elapsedMin = (now.getTime() - log.checkInAt.getTime()) / 60000;

    // ── Rule: maximum duration (2 hours) ──
    // A session left running past the cap is auto-cancelled and never counted —
    // delete it here so a stale check-out can't sneak it through.
    const MAX_SESSION_MINUTES = 120;
    if (elapsedMin > MAX_SESSION_MINUTES) {
      await prisma.workoutLog.delete({ where: { id: logId } });
      return NextResponse.json(
        { error: `Buổi tập đã vượt quá ${MAX_SESSION_MINUTES} phút (2 tiếng) nên đã tự động hủy và không được tính. Vui lòng check-in lại.` },
        { status: 400 }
      );
    }

    if (elapsedMin < minMinutes) {
      if (firstInteractionAt && firstInteractionAt !== log.firstInteractionAt) {
        await prisma.workoutLog.update({ where: { id: logId }, data: { firstInteractionAt } });
      }
      return NextResponse.json(
        { error: `Buổi tập mới được ${Math.floor(elapsedMin)} phút, cần tối thiểu ${minMinutes} phút mới có thể xác nhận.` },
        { status: 400 }
      );
    }

    // ── Path A: client confirms on their own app (anti-forgery) ──
    if (method === "client_app") {
      const pending = await prisma.workoutLog.update({
        where: { id: logId },
        data: {
          status: "AWAITING_CONFIRMATION",
          checkOutAt: now,
          firstInteractionAt,
          notes: body.notes ?? log.notes,
        },
        include: INCLUDE,
      });
      return NextResponse.json({ ...serializeWorkoutLog(pending), valid: true, awaitingConfirmation: true, packageUpdate: null });
    }

    // ── Path B: signature fallback (completes now, flagged as SIGNATURE) ──
    const sig = (body.signatureUrl ?? "").trim();
    if (!sig) {
      if (firstInteractionAt && firstInteractionAt !== log.firstInteractionAt) {
        await prisma.workoutLog.update({ where: { id: logId }, data: { firstInteractionAt } });
      }
      return NextResponse.json({ error: "Cần chữ ký xác nhận của khách hàng" }, { status: 400 });
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
        notes: body.notes ?? log.notes,
      },
      include: INCLUDE,
    });

    const packageUpdate = await incrementPackageAndNotify(params.id, completed);

    return NextResponse.json({ ...serializeWorkoutLog(completed), valid: true, packageUpdate });
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[workout-logs check-out]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}
