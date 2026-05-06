import { NextResponse }    from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "@/lib/auth";
import { prisma }           from "@/lib/prisma";
import path                 from "path";
import fs                   from "fs";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") ?? "";
  let weightBefore: number, weightAfter: number, durationMonths: number;
  let order = 0, isActive = true;
  let newImageUrl: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    weightBefore   = parseFloat(fd.get("weightBefore")   as string);
    weightAfter    = parseFloat(fd.get("weightAfter")    as string);
    durationMonths = parseInt(fd.get("durationMonths")   as string);
    order          = parseInt((fd.get("order") as string) ?? "0") || 0;
    isActive       = fd.get("isActive") !== "false";

    const file = fd.get("image") as File | null;
    if (file && file.size > 0) {
      const ext      = (file.name.split(".").pop()?.toLowerCase() ?? "jpg").replace(/[^a-z0-9]/g, "");
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const dir      = path.join(process.cwd(), "public", "images", "transform");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
      newImageUrl = `/images/transform/${filename}`;
    }
  } else {
    const body     = await req.json();
    weightBefore   = parseFloat(body.weightBefore);
    weightAfter    = parseFloat(body.weightAfter);
    durationMonths = parseInt(body.durationMonths);
    order          = parseInt(body.order ?? "0") || 0;
    isActive       = body.isActive !== false;
  }

  if (isNaN(weightBefore!) || isNaN(weightAfter!) || isNaN(durationMonths!)) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const photo = await prisma.transformPhoto.update({
    where: { id: params.id },
    data: {
      weightBefore,
      weightAfter,
      durationMonths,
      order,
      isActive,
      ...(newImageUrl && { imageUrl: newImageUrl }),
    },
  });

  return NextResponse.json(photo);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const photo = await prisma.transformPhoto.findUnique({ where: { id: params.id }, select: { imageUrl: true } });
  if (!photo) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  // Remove file from disk if it exists under our managed path
  if (photo.imageUrl.startsWith("/images/transform/")) {
    const filePath = path.join(process.cwd(), "public", photo.imageUrl);
    try { fs.unlinkSync(filePath); } catch { /* ignore if missing */ }
  }

  await prisma.transformPhoto.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
