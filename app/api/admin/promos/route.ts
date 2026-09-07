import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { vnStartOfDay, vnEndOfDay } from "@/lib/package-promos";
import { ROADMAP_PACKAGES } from "@/lib/roadmap-phases";

/**
 * Quản lý các đợt trợ giá theo cơ sở — chỉ Admin.
 *
 * Giá gửi lên là GIÁ CUỐI khách trả cho gói đó, không phải phần trăm giảm; xem
 * lý do ở lib/package-promos.
 */

export type PromoBody = {
  name: string;
  shortLabel: string;
  branchId: string;
  /** "YYYY-MM-DD" theo giờ Việt Nam. */
  startDay: string;
  /** "YYYY-MM-DD" theo giờ Việt Nam — tính CẢ ngày này. */
  endDay: string;
  isActive?: boolean;
  items: { packageName: string; price: number }[];
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Kiểm dữ liệu gửi lên; trả câu lỗi tiếng Việt hoặc null nếu hợp lệ. */
function validate(body: PromoBody): string | null {
  if (!body.name?.trim()) return "Cần tên đợt trợ giá.";
  if (!body.shortLabel?.trim()) return "Cần nhãn ngắn hiện cạnh giá.";
  if (!body.branchId) return "Cần chọn cơ sở áp dụng.";
  if (!DAY_RE.test(body.startDay ?? "")) return "Ngày bắt đầu không hợp lệ.";
  if (!DAY_RE.test(body.endDay ?? "")) return "Ngày kết thúc không hợp lệ.";
  if (vnEndOfDay(body.endDay).getTime() < vnStartOfDay(body.startDay).getTime()) {
    return "Ngày kết thúc phải từ ngày bắt đầu trở đi.";
  }

  const items = body.items ?? [];
  if (items.length === 0) return "Cần ít nhất một gói được trợ giá.";

  const seen = new Set<string>();
  for (const it of items) {
    if (!ROADMAP_PACKAGES.includes(it.packageName)) {
      return `Gói "${it.packageName}" không có trong danh sách lộ trình.`;
    }
    if (seen.has(it.packageName)) return `Gói ${it.packageName} bị khai hai lần.`;
    seen.add(it.packageName);
    if (!(it.price > 0)) return `Giá của gói ${it.packageName} phải lớn hơn 0.`;
  }
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const promos = await prisma.packagePromo.findMany({
    include: {
      branch: { select: { id: true, name: true } },
      items: { orderBy: { packageName: "asc" } },
    },
    orderBy: [{ startsAt: "desc" }],
  });

  return NextResponse.json(promos);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as PromoBody;
  const err = validate(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const promo = await prisma.packagePromo.create({
    data: {
      name: body.name.trim(),
      shortLabel: body.shortLabel.trim(),
      branchId: body.branchId,
      startsAt: vnStartOfDay(body.startDay),
      endsAt: vnEndOfDay(body.endDay),
      isActive: body.isActive ?? true,
      items: {
        create: body.items.map((it) => ({ packageName: it.packageName, price: it.price })),
      },
    },
    include: {
      branch: { select: { id: true, name: true } },
      items: { orderBy: { packageName: "asc" } },
    },
  });

  return NextResponse.json(promo);
}
