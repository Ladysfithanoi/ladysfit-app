import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Bật/tắt "Khách hàng chuyển giao" cho một khách đã có lộ trình.
 *
 * Đơn giá buổi dạy đọc từ contractType của gói ngay lúc tính lương (xem
 * lib/session-pay.bucketOf), nên đổi hết gói thường của khách sang TRANSFER là
 * MỌI buổi đã dạy trước đó tự tính lại 50.000đ/buổi — không phải sửa bảng lương.
 * Tắt thì trả các gói TRANSFER về NORMAL. KOC/KOL giữ nguyên: hai loại đó có
 * cách tính hoa hồng riêng.
 *
 * Khách chưa có lộ trình không đi qua đây — ô tích chỉ áp vào gói sắp tạo.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Đổi đơn giá buổi dạy là đổi lương — chỉ Admin/FM.
  if (!["ADMIN", "FM"].includes(session.user.role)) {
    return NextResponse.json({ error: "Chỉ Admin/FM đổi được khách chuyển giao" }, { status: 403 });
  }

  const { transfer } = await req.json();
  if (typeof transfer !== "boolean") {
    return NextResponse.json({ error: "Thiếu trạng thái chuyển giao" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [from, to] = transfer ? ["NORMAL", "TRANSFER"] : ["TRANSFER", "NORMAL"];
  const updated = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `UPDATE package_enrollments
        SET "contractType" = $3::"ContractType"
      WHERE "clientId" = $1 AND "contractType" = $2::"ContractType"
      RETURNING id`,
    params.id, from, to,
  );

  return NextResponse.json({ updatedIds: updated.map((r) => r.id), contractType: to });
}
