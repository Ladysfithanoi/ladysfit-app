import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteUploadedImage } from "@/lib/storage";

/** Chỉ FM quản cơ sở của ảnh mới được sửa/xoá. */
async function loadEditable(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const proof = await prisma.googleReviewProof.findUnique({ where: { id } });
  if (!proof) return { error: NextResponse.json({ error: "Không tìm thấy ảnh" }, { status: 404 }) };
  const managed: string[] = session.user.managedBranchIds ?? [];
  if (session.user.role !== "FM" || !managed.includes(proof.branchId)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { proof };
}

// Thay ảnh / sửa tên khách, ghi chú.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const r = await loadEditable(params.id);
  if (r.error) return r.error;

  const body = await req.json().catch(() => ({})) as {
    imageUrl?: string; customerName?: string | null; note?: string | null;
  };
  if (body.imageUrl !== undefined && !body.imageUrl.trim()) {
    return NextResponse.json({ error: "Chưa có ảnh" }, { status: 400 });
  }

  const newUrl = body.imageUrl?.trim();
  const updated = await prisma.googleReviewProof.update({
    where: { id: params.id },
    data: {
      ...(newUrl !== undefined && { imageUrl: newUrl }),
      ...(body.customerName !== undefined && { customerName: body.customerName?.trim() || null }),
      ...(body.note !== undefined && { note: body.note?.trim() || null }),
    },
  });
  // Ảnh cũ bị thay thì dọn khỏi storage.
  if (newUrl && newUrl !== r.proof.imageUrl) await deleteUploadedImage(r.proof.imageUrl);
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const r = await loadEditable(params.id);
  if (r.error) return r.error;
  await prisma.googleReviewProof.delete({ where: { id: params.id } });
  await deleteUploadedImage(r.proof.imageUrl);
  return NextResponse.json({ ok: true });
}
