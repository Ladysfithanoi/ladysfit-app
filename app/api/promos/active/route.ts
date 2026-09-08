import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActivePromos } from "@/lib/package-promos-server";
import { vnStartOfDay } from "@/lib/package-promos";

// GET /api/promos/active?branchId=...&at=YYYY-MM-DD
// Các đợt trợ giá đang chạy ở một cơ sở tại một ngày.
//
// Khác /api/admin/promos (chỉ Admin, để thêm/sửa đợt): cái này chỉ ĐỌC và mọi
// nhân sự đều gọi được, vì màn Setup doanh số phải biết giá đúng của hợp đồng
// mới khoá/mở được nút Cập nhật. Không lộ gì thêm — giá trợ giá vốn là con số
// tư vấn viên báo thẳng cho khách.
//
// `at` là NGÀY KÝ của lead chứ không phải hôm nay: sửa lại một hợp đồng ký hồi
// đợt presale thì vẫn phải đối chiếu theo giá của đợt đó, dù đợt đã hết hạn.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const at = searchParams.get("at");

  if (!branchId) return NextResponse.json([]);

  const when = at && /^\d{4}-\d{2}-\d{2}$/.test(at) ? vnStartOfDay(at) : new Date();
  return NextResponse.json(await getActivePromos(branchId, when));
}
