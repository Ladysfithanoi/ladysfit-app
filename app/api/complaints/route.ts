import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "FM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const managedBranchIds = session.user.managedBranchIds ?? [];

  const complaints = await prisma.complaint.findMany({
    where: { branchId: { in: managedBranchIds } },
    include: {
      client: { select: { id: true, fullName: true, phone: true } },
      branch: { select: { id: true, name: true } },
      assignedFM: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    complaints.map((c) => ({
      id: c.id,
      category: c.category,
      content: c.content,
      status: c.status,
      fmNote: c.fmNote,
      isReadByFM: c.isReadByFM,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      client: c.client,
      branch: c.branch,
      assignedFM: c.assignedFM,
    }))
  );
}
