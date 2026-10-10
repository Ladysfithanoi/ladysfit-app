import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSalaryLocked, recalcSalary, salaryUpdateData } from "@/lib/salary-live";
import { latestSalaryConfig } from "@/lib/salary-config";

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

  // Lao công / Marketing làm nhiều cơ sở (lib/work-branches) có một bảng lương ở
  // mỗi cơ sở — trả kèm danh sách để tự chọn xem từng cơ sở.
  const all = await prisma.salaryRecord.findMany({
    where:   { userId: session.user.id, month, year },
    include: { branch: { select: { id: true, name: true } } },
    orderBy: { branch: { name: "asc" } },
  });
  const wanted = searchParams.get("branchId");
  const picked = all.find((r) => r.branchId === wanted) ?? all[0] ?? null;
  const branches = all.map((r) => r.branch);
  let record: Omit<NonNullable<typeof picked>, "branch"> | null = null;
  if (picked) {
    const { branch, ...rest } = picked;
    void branch;
    record = rest;
  }
  const config = await latestSalaryConfig(session.user.id, record?.branchId);

  // Bảng lương chỉ được tính lại khi FM mở trang Quỹ lương, nên PT tự tích lịch
  // nghỉ, vừa dạy xong một buổi, hay vừa chốt thêm hợp đồng, sẽ không thấy gì
  // đổi cho tới khi FM mở trang. Chạy đúng công thức tính lại của màn Quỹ lương
  // (lib/salary-live) ngay tại đây nên PT thấy cùng con số với FM, thời gian
  // thực: doanh số và hoa hồng theo bậc %, tiền buổi dạy, thưởng KOC/KOL và
  // ngày công theo lịch nghỉ.
  // Dòng đã Xác nhận là số chốt — không tính lại nữa (isSalaryLocked).
  if (record && !isSalaryLocked(record.status)) {
    const { patch, changed } = await recalcSalary({ record, role, month, year });
    if (changed) {
      const synced = await prisma.salaryRecord.update({
        where: { id: record.id },
        data:  salaryUpdateData(patch),
      });
      return NextResponse.json({ record: synced, config, branches });
    }
  }

  return NextResponse.json({ record, config, branches });
}
