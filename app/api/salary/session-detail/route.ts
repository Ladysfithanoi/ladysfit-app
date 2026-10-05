import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessSessionDetail } from "@/lib/salary-access";
import { buildSessionDetailRows } from "@/lib/salary-session-detail";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const ptId  = searchParams.get("ptId");
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
    const year  = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()));

    if (!ptId) return NextResponse.json({ error: "ptId required" }, { status: 400 });

    const role = session.user.role;
    if (!canAccessSessionDetail(role, session.user.id, ptId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ rows: await buildSessionDetailRows(ptId, month, year) });
  } catch (error: unknown) {
    const e = error as { message?: string; code?: string; stack?: string };
    console.error("Session detail error:", e.message);
    console.error("Code:", e.code);
    console.error("Stack:", e.stack);
    return NextResponse.json({ error: e.message, code: e.code }, { status: 500 });
  }
}
