import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const session = await getServerSession(clientAuthOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const { currentPassword, newPassword } = body as Record<string, unknown>;

  if (typeof currentPassword !== "string" || !currentPassword.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập mật khẩu hiện tại" }, { status: 400 });
  }
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    return NextResponse.json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id: session.user.id },
    select: { id: true, password: true },
  });

  if (!client?.password) {
    return NextResponse.json({ error: "Tài khoản không hợp lệ" }, { status: 400 });
  }

  const isValid = await bcrypt.compare(currentPassword, client.password);
  if (!isValid) {
    return NextResponse.json({ error: "Mật khẩu hiện tại không chính xác!" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.client.update({
    where: { id: client.id },
    data: { password: hashed, passwordSetAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
