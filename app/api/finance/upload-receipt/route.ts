import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const MAX_SIZE  = 5 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED   = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "FM") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const branchId = formData.get("branchId") as string;
  const year     = formData.get("year")     as string;
  const month    = formData.get("month")    as string;
  const files    = formData.getAll("files") as File[];

  if (!branchId || !year || !month) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const managed: string[] = session.user.managedBranchIds ?? [];
  if (!managed.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Tối đa ${MAX_FILES} tệp` }, { status: 400 });
  }

  const dir = join(process.cwd(), "public", "uploads", "receipts", branchId, year, month);
  await mkdir(dir, { recursive: true });

  const urls: string[] = [];
  for (const file of files) {
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: `Loại tệp không hợp lệ: ${file.name}` }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `Tệp quá lớn: ${file.name}` }, { status: 400 });
    }
    const ext      = file.name.split(".").pop() ?? "bin";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer   = Buffer.from(await file.arrayBuffer());
    await writeFile(join(dir, filename), buffer);
    urls.push(`/uploads/receipts/${branchId}/${year}/${month}/${filename}`);
  }

  return NextResponse.json({ urls });
}
