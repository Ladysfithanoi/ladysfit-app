import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canBypassPhaseGate,
  ensureClientPhaseProgression,
  phaseOrderOf,
} from "@/lib/phase-progression";

/**
 * Mở khoá SỚM một giai đoạn cho khách (bỏ qua rào "phải đủ số tuần ở giai đoạn
 * trước"), hoặc hoàn tác việc mở sớm đó — body: { unlock: boolean }.
 *
 * Chỉ FM (với khách thuộc cơ sở mình quản lý: khách của chính FM và của PT dưới
 * quyền) và Admin được dùng. PT gọi vào sẽ nhận 403.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string; programId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = await canBypassPhaseGate(session.user, params.id);
  if (!allowed) {
    return NextResponse.json(
      { error: "Chỉ Quản lý (FM) phụ trách cơ sở hoặc Admin mới được mở khóa sớm giai đoạn." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { unlock?: boolean };
  const unlock = body.unlock !== false;

  const program = await prisma.workoutProgram.findUnique({
    where: { id: params.programId, clientId: params.id },
    select: { id: true, phase: true },
  });
  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (phaseOrderOf(program.phase) < 1) {
    return NextResponse.json(
      { error: "Chương trình này không gắn với giai đoạn nào nên không cần mở khóa." },
      { status: 400 }
    );
  }

  // Engine tiến trình coi cờ manualPhaseOverride là "sàn" giai đoạn: bật lên thì
  // CT này thành ACTIVE và các giai đoạn trước chuyển ARCHIVED, kể cả khi chưa đủ
  // số tuần. Tắt đi thì engine tính lại thuần theo số tuần đã hoàn thành.
  await prisma.workoutProgram.update({
    where: { id: program.id },
    data: { manualPhaseOverride: unlock },
  });
  await ensureClientPhaseProgression(params.id);

  const programs = await prisma.workoutProgram.findMany({
    where: { clientId: params.id },
    select: { id: true, status: true, manualPhaseOverride: true },
  });

  return NextResponse.json({ ok: true, programs });
}
