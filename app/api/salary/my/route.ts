import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalcSalary, salaryUpdateData } from "@/lib/salary-live";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isPT = role === "PT";
  // STAFF (lao công, marketing…) cũng tự xem lương của mình như PT.
  if (!isPT && role !== "STAFF") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  const [record, config] = await Promise.all([
    prisma.salaryRecord.findFirst({ where: { userId: session.user.id, month, year } }),
    prisma.salaryConfig.findFirst({
      where: { userId: session.user.id },
      orderBy: { effectiveFrom: "desc" },
    }),
  ]);

  // Bảng lương chỉ được tính lại khi FM mở trang Quỹ lương, nên PT tự tích lịch
  // nghỉ, vừa dạy xong một buổi, hay vừa chốt thêm hợp đồng, sẽ không thấy gì
  // đổi cho tới khi FM mở trang. Chạy đúng công thức tính lại của màn Quỹ lương
  // (lib/salary-live) ngay tại đây nên PT thấy cùng con số với FM, thời gian
  // thực: doanh số và hoa hồng theo bậc %, tiền buổi dạy, thưởng KOC/KOL và
  // ngày công theo lịch nghỉ.
  if (record) {
    const { patch, changed } = await recalcSalary({ record, role, month, year });
    if (changed) {
      const synced = await prisma.salaryRecord.update({
        where: { id: record.id },
        data:  salaryUpdateData(patch),
      });
      return NextResponse.json({ record: synced, config });
    }
  }

  return NextResponse.json({ record, config });
}
