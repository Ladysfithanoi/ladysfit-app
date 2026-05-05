import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "FM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { status, fmNote } = await req.json() as {
    status?: "PENDING" | "PROCESSING" | "RESOLVED";
    fmNote?: string;
  };

  const updated = await prisma.complaint.update({
    where: { id: params.id },
    data: {
      ...(status ? { status } : {}),
      ...(fmNote !== undefined ? { fmNote: fmNote || null } : {}),
      isReadByFM: true,
    },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
