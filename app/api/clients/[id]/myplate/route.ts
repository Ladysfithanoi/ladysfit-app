import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const allowed = role === "ADMIN" || role === "FM" || role === "FREE" || role === "RESTRICTED";
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { imageUrl, note } = body as { imageUrl?: string | null; note?: string | null };

  const client = await prisma.client.update({
    where: { id: params.id },
    data: {
      myPlateImageUrl: imageUrl ?? null,
      myPlateNote: note ?? null,
    },
    select: { id: true, myPlateImageUrl: true, myPlateNote: true },
  });

  return NextResponse.json(client);
}
