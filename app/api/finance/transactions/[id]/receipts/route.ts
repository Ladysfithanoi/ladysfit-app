import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_IMAGES      = 5;
const MAX_BASE64_LEN  = Math.ceil(5 * 1024 * 1024 * (4 / 3)) + 256; // ~5 MB binary → base64

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "FM") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tx = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const managed: string[] = session.user.managedBranchIds ?? [];
  if (!managed.includes(tx.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { images } = await req.json() as { images: string[] };

  if (!Array.isArray(images) || images.length > MAX_IMAGES) {
    return NextResponse.json({ error: `Tối đa ${MAX_IMAGES} ảnh` }, { status: 400 });
  }
  for (const img of images) {
    if (typeof img !== "string") {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }
    if (img.length > MAX_BASE64_LEN) {
      return NextResponse.json({ error: "Ảnh quá lớn (tối đa 5MB/ảnh)" }, { status: 400 });
    }
  }

  await prisma.transaction.update({
    where: { id: params.id },
    data: { receiptImages: images.length > 0 ? JSON.stringify(images) : null },
  });

  return NextResponse.json({ ok: true });
}
