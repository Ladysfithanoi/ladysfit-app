import { NextResponse }    from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "@/lib/auth";
import { prisma }           from "@/lib/prisma";
import path                 from "path";
import fs                   from "fs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const weightMin    = searchParams.get("weightMin")   ? parseFloat(searchParams.get("weightMin")!)   : null;
  const weightMax    = searchParams.get("weightMax")   ? parseFloat(searchParams.get("weightMax")!)   : null;
  const durationMin  = searchParams.get("durationMin") ? parseInt(searchParams.get("durationMin")!)   : null;
  const durationMax  = searchParams.get("durationMax") ? parseInt(searchParams.get("durationMax")!)   : null;
  const includeAll   = searchParams.get("all") === "1"; // admin view: include inactive

  const session = includeAll ? await getServerSession(authOptions) : null;
  const isAdmin = session?.user?.role === "ADMIN";

  const photos = await prisma.transformPhoto.findMany({
    where: {
      ...((!includeAll || !isAdmin) && { isActive: true }),
      ...(weightMin   !== null && { weightBefore:   { gte: weightMin   } }),
      ...(weightMax   !== null && { weightBefore:   { lt:  weightMax   } }),
      ...(durationMin !== null && { durationMonths: { gte: durationMin } }),
      ...(durationMax !== null && { durationMonths: { lte: durationMax } }),
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(photos);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData     = await req.formData();
  const file         = formData.get("image") as File | null;
  const weightBefore = parseFloat(formData.get("weightBefore") as string);
  const weightAfter  = parseFloat(formData.get("weightAfter")  as string);
  const durationMonths = parseInt(formData.get("durationMonths") as string);
  const order        = parseInt((formData.get("order") as string) ?? "0") || 0;
  const isActive     = formData.get("isActive") !== "false";

  if (isNaN(weightBefore) || isNaN(weightAfter) || isNaN(durationMonths)) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Vui lòng chọn ảnh" }, { status: 400 });
  }

  const ext      = (file.name.split(".").pop()?.toLowerCase() ?? "jpg").replace(/[^a-z0-9]/g, "");
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const dir      = path.join(process.cwd(), "public", "images", "transform");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

  const photo = await prisma.transformPhoto.create({
    data: { weightBefore, weightAfter, durationMonths, imageUrl: `/images/transform/${filename}`, isActive, order },
  });

  return NextResponse.json(photo, { status: 201 });
}
