import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { celebrationsFor, parseGender } from "@/lib/celebrations";

export const dynamic = "force-dynamic";

/**
 * Lời chúc hôm nay của chính người đang đăng nhập: sinh nhật, và với nhân sự nữ
 * là các ngày của phụ nữ (lib/celebrations). Admin đang giả lập FM/PT thì không
 * hiện — lời chúc là của người kia, không phải của Admin.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.impersonator) return NextResponse.json({ celebrations: [] });

  const me = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { name: true, gender: true, dateOfBirth: true },
  });
  if (!me) return NextResponse.json({ celebrations: [] });

  return NextResponse.json({
    celebrations: celebrationsFor({ ...me, gender: parseGender(me.gender) }),
  });
}
