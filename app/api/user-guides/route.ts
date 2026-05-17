import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guides = await prisma.userGuide.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(guides);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    title: string;
    category: string;
    youtubeUrl: string;
    order?: number;
  };

  if (!body.title?.trim() || !body.category?.trim() || !body.youtubeUrl?.trim()) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }

  const guide = await prisma.userGuide.create({
    data: {
      title: body.title.trim(),
      category: body.category.trim(),
      youtubeUrl: body.youtubeUrl.trim(),
      order: body.order ?? 0,
    },
  });

  return NextResponse.json(guide, { status: 201 });
}
