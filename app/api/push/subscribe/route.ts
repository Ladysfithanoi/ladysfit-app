import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SubBody = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

// POST — lưu (hoặc chuyển chủ) đăng ký push của thiết bị đang dùng.
// Một máy có thể đổi người đăng nhập, nên endpoint trùng thì gán lại cho user hiện tại.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Admin đang giả lập: máy này vẫn là máy của Admin, không chuyển chủ sang FM/PT.
  if (session.user.impersonator) return NextResponse.json({ ok: true });

  const body = (await req.json().catch(() => ({}))) as SubBody;
  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;
  if (!endpoint || !p256dh || !auth || !endpoint.startsWith("https://")) {
    return NextResponse.json({ error: "Đăng ký không hợp lệ" }, { status: 400 });
  }
  const userAgent = req.headers.get("user-agent");

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh, auth, userAgent, userId: session.user.id },
    update: { p256dh, auth, userAgent, userId: session.user.id },
  });
  return NextResponse.json({ ok: true });
}

// DELETE — tắt thông báo trên thiết bị này.
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.impersonator) return NextResponse.json({ ok: true });
  const body = (await req.json().catch(() => ({}))) as SubBody;
  if (body.endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId: session.user.id } });
  }
  return NextResponse.json({ ok: true });
}
