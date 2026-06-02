import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role    = session.user.role;
  const isAdmin = role === "ADMIN";
  const isFM    = role === "FM";
  const isPT    = role === "PT";

  if (!isAdmin && !isFM && !isPT) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // PT: can only manage their own assigned clients
  if (isPT) {
    const client = await prisma.client.findUnique({
      where:  { id: params.id },
      select: { assignedPTId: true },
    });
    if (!client || client.assignedPTId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // FM: can only manage clients in their managed branches
  if (isFM) {
    const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
    const client = await prisma.client.findUnique({
      where:  { id: params.id },
      select: { branchId: true },
    });
    if (!client || !managedBranchIds.includes(client.branchId ?? "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email: rawEmail, password } = body as Record<string, unknown>;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  if (!email) {
    return NextResponse.json({ error: "Email không được để trống" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });
  }
  if (password !== undefined && password !== "" && (typeof password !== "string" || password.length < 6)) {
    return NextResponse.json({ error: "Mật khẩu phải có ít nhất 6 ký tự" }, { status: 400 });
  }

  const hashed = typeof password === "string" && password.length >= 6
    ? await bcrypt.hash(password, 10)
    : undefined;

  let client;
  try {
    client = await prisma.client.update({
      where: { id: params.id },
      data: {
        email,
        ...(hashed ? { password: hashed, passwordSetAt: new Date() } : {}),
      },
      select: { id: true, email: true, passwordSetAt: true },
    });
  } catch (err) {
    // Email is unique — a duplicate triggers a P2002 unique constraint error.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Email này đã được dùng cho một tài khoản khác" },
        { status: 409 },
      );
    }
    throw err;
  }

  return NextResponse.json(client);
}
