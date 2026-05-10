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

    const { names, phase = "", movement = "" } = (await req.json()) as { names: string[]; phase?: string; movement?: string };
    if (!Array.isArray(names) || names.length === 0) {
      return NextResponse.json({ error: "Không có bài tập nào" }, { status: 400 });
    }

    const toCreate = names.filter((n) => n.trim());

    await prisma.workoutExercise.createMany({
      data: toCreate.map((name) => ({ name: name.trim(), phase, type: "", movement })),
      skipDuplicates: false,
    });

    return NextResponse.json({ imported: toCreate.length, skipped: 0 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Lỗi server";
    console.error("Import exercises error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
