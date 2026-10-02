import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { moveLogToPackage } from "@/lib/workout-session";

// POST /api/clients/[id]/workout-logs/[logId]/move — CHỈ ADMIN.
//
// Chuyển một buổi đã ghi (kể cả buổi có chữ ký khách) sang lộ trình khác của cùng
// khách. Body: { toEnrollmentId, refundSource? } — refundSource (mặc định true)
// hoàn lại 1 buổi cho lộ trình cũ. Xem moveLogToPackage ở lib/workout-session.
export async function POST(
  req: Request,
  { params }: { params: { id: string; sessionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ Admin được chuyển buổi tập sang gói khác" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { toEnrollmentId?: string; refundSource?: boolean };
  if (!body.toEnrollmentId) return NextResponse.json({ error: "Chưa chọn lộ trình đích" }, { status: 400 });

  try {
    const result = await moveLogToPackage(params.id, params.sessionId, body.toEnrollmentId, body.refundSource !== false);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const e = error as { message?: string };
    return NextResponse.json({ error: e.message ?? "Không chuyển được buổi tập" }, { status: 400 });
  }
}
