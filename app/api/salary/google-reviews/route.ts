import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Ảnh đánh giá Google Business của một cơ sở trong một tháng — nguồn của thưởng
// Google cho FM (lib/google-review-bonus). FM quản cơ sở được thêm/sửa/xoá,
// COO chỉ xem.

async function access(branchId: string) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = session.user.role;
  const managed: string[] = session.user.managedBranchIds ?? [];
  const canEdit = role === "FM" && managed.includes(branchId);
  if (!canEdit && role !== "COO") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session, canEdit };
}

function validPeriod(month: number, year: number) {
  return Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(year) && year >= 2000;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId") ?? "";
  const month = Number(searchParams.get("month"));
  const year  = Number(searchParams.get("year"));
  if (!branchId || !validPeriod(month, year)) {
    return NextResponse.json({ error: "Thiếu cơ sở hoặc kỳ" }, { status: 400 });
  }
  const a = await access(branchId);
  if (a.error) return a.error;

  const proofs = await prisma.googleReviewProof.findMany({
    where:   { branchId, month, year },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(proofs);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as {
    branchId?: string; month?: number; year?: number;
    imageUrl?: string; customerName?: string | null; note?: string | null;
  } | null;
  if (!body?.branchId || !validPeriod(Number(body.month), Number(body.year))) {
    return NextResponse.json({ error: "Thiếu cơ sở hoặc kỳ" }, { status: 400 });
  }
  if (!body.imageUrl?.trim()) return NextResponse.json({ error: "Chưa có ảnh" }, { status: 400 });

  const a = await access(body.branchId);
  if (a.error) return a.error;
  if (!a.canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const proof = await prisma.googleReviewProof.create({
    data: {
      branchId:     body.branchId,
      month:        Number(body.month),
      year:         Number(body.year),
      imageUrl:     body.imageUrl.trim(),
      customerName: body.customerName?.trim() || null,
      note:         body.note?.trim() || null,
      createdById:  a.session.user.id,
    },
  });
  return NextResponse.json(proof, { status: 201 });
}
