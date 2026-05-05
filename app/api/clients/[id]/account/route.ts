import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const email = (body.email as string)?.trim().toLowerCase();
  const password = body.password as string | undefined;
  if (!email) return NextResponse.json({ error: "Email không được để trống" }, { status: 400 });

  const hashed = password ? await bcrypt.hash(password, 10) : undefined;
  console.log("[account/PUT] clientId:", params.id, "email:", email, "updatingPassword:", !!hashed);

  const client = await prisma.client.update({
    where: { id: params.id },
    data: {
      email,
      ...(hashed ? { password: hashed, passwordSetAt: new Date() } : {}),
    },
    select: { id: true, email: true, passwordSetAt: true },
  });

  console.log("[account/PUT] saved OK, passwordSetAt:", client.passwordSetAt);
  return NextResponse.json(client);
}
