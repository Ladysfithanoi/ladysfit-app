import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_ROLE_GROUPS = ["CEO", "COO", "FM", "PT"];

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    title?: string;
    roleGroup?: string;
    category?: string;
    youtubeUrl?: string;
    order?: number;
    isActive?: boolean;
  };

  if (body.roleGroup !== undefined && !VALID_ROLE_GROUPS.includes(body.roleGroup)) {
    return NextResponse.json({ error: "Phân loại không hợp lệ" }, { status: 400 });
  }

  const guide = await prisma.userGuide.update({
    where: { id: params.id },
    data: {
      ...(body.title     !== undefined && { title:     body.title.trim()     }),
      ...(body.roleGroup !== undefined && { roleGroup: body.roleGroup        }),
      ...(body.category  !== undefined && { category:  body.category.trim()  }),
      ...(body.youtubeUrl !== undefined && { youtubeUrl: body.youtubeUrl.trim() }),
      ...(body.order     !== undefined && { order:     body.order            }),
      ...(body.isActive  !== undefined && { isActive:  body.isActive         }),
    },
  });

  return NextResponse.json(guide);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.userGuide.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
