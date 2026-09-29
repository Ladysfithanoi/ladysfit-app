import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { vnStartOfDay, vnEndOfDay, parseRenewDiscountPct } from "@/lib/package-promos";
import { ROADMAP_PACKAGES } from "@/lib/roadmap-phases";

type PatchBody = {
  name?: string;
  shortLabel?: string;
  branchId?: string;
  startDay?: string;
  endDay?: string;
  isActive?: boolean;
  items?: { packageName: string; price: number }[];
  /** undefined = không đổi; null/"" = về mặc định 10%. */
  renewDiscountPct?: number | string | null;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.packagePromo.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy đợt trợ giá" }, { status: 404 });

  const body = (await req.json()) as PatchBody;

  // Ngày: chỉ đổi khi được gửi lên, và luôn kiểm cặp bắt đầu/kết thúc sau khi ghép
  // với giá trị cũ — sửa mỗi một đầu vẫn không tạo được khoảng ngày ngược.
  const startsAt = body.startDay !== undefined
    ? (DAY_RE.test(body.startDay) ? vnStartOfDay(body.startDay) : null)
    : existing.startsAt;
  const endsAt = body.endDay !== undefined
    ? (DAY_RE.test(body.endDay) ? vnEndOfDay(body.endDay) : null)
    : existing.endsAt;

  if (!startsAt || !endsAt) {
    return NextResponse.json({ error: "Ngày không hợp lệ." }, { status: 400 });
  }
  if (endsAt.getTime() < startsAt.getTime()) {
    return NextResponse.json({ error: "Ngày kết thúc phải từ ngày bắt đầu trở đi." }, { status: 400 });
  }

  let renewDiscountPct = existing.renewDiscountPct;
  if (body.renewDiscountPct !== undefined) {
    const parsed = parseRenewDiscountPct(body.renewDiscountPct);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    renewDiscountPct = parsed.value;
    // Bỏ % tái ký mà không gửi danh sách gói: đợt phải còn ít nhất một gói.
    if (renewDiscountPct == null && !body.items) {
      const n = await prisma.packagePromoItem.count({ where: { promoId: params.id } });
      if (n === 0) {
        return NextResponse.json(
          { error: "Đợt này không trợ giá gói nào — bỏ % tái ký thì đợt không còn gì để áp." },
          { status: 400 }
        );
      }
    }
  }

  if (body.items) {
    // Đợt chỉ đổi % tái ký mà không trợ giá gói nào cũng là một đợt hợp lệ.
    if (body.items.length === 0 && renewDiscountPct == null) {
      return NextResponse.json(
        { error: "Cần ít nhất một gói được trợ giá, hoặc đặt % trợ giá tái ký." },
        { status: 400 }
      );
    }
    const seen = new Set<string>();
    for (const it of body.items) {
      if (!ROADMAP_PACKAGES.includes(it.packageName)) {
        return NextResponse.json({ error: `Gói "${it.packageName}" không hợp lệ.` }, { status: 400 });
      }
      if (seen.has(it.packageName)) {
        return NextResponse.json({ error: `Gói ${it.packageName} bị khai hai lần.` }, { status: 400 });
      }
      seen.add(it.packageName);
      if (!(it.price > 0)) {
        return NextResponse.json({ error: `Giá của gói ${it.packageName} phải lớn hơn 0.` }, { status: 400 });
      }
    }
  }

  // Danh sách gói thay bằng bản mới nguyên khối: xoá hết rồi tạo lại trong CÙNG
  // một giao dịch, để không bao giờ có khoảnh khắc đợt trợ giá không còn gói nào
  // mà vẫn đang bật.
  await prisma.$transaction(async (tx) => {
    if (body.items) {
      await tx.packagePromoItem.deleteMany({ where: { promoId: params.id } });
      await tx.packagePromoItem.createMany({
        data: body.items.map((it) => ({
          promoId: params.id,
          packageName: it.packageName,
          price: it.price,
        })),
      });
    }
    await tx.packagePromo.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.shortLabel !== undefined ? { shortLabel: body.shortLabel.trim() } : {}),
        ...(body.branchId !== undefined ? { branchId: body.branchId } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        renewDiscountPct,
        startsAt,
        endsAt,
      },
    });
  });

  const fresh = await prisma.packagePromo.findUnique({
    where: { id: params.id },
    include: {
      branch: { select: { id: true, name: true } },
      items: { orderBy: { packageName: "asc" } },
    },
  });
  return NextResponse.json(fresh);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Xoá đợt KHÔNG đụng tới hợp đồng đã ký: giá đã ghi vào package_enrollments từ
  // lúc chốt, nên hợp đồng cũ giữ nguyên con số khách đã đồng ý.
  await prisma.packagePromo.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
