import { NextResponse }     from "next/server";
import { getServerSession }  from "next-auth";
import { authOptions }       from "@/lib/auth";
import { prisma }            from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "FM") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const record = await prisma.salaryRecord.findUnique({ where: { id: params.id } });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
  if (!managedBranchIds.includes(record.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { images } = await req.json() as { images: string[] };

  const updated = await prisma.salaryRecord.update({
    where: { id: params.id },
    data:  { sessionImages: images.length > 0 ? JSON.stringify(images) : null },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  return NextResponse.json(updated);
}
