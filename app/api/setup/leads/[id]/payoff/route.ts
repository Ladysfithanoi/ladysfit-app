import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/setup/leads/[id]/payoff — tạo đợt "Thanh toán nốt" từ một lead Đặt cọc.
 *
 * Khách đặt cọc xong, phần còn nợ được thu ở một đợt sau. Đợt đó là một dòng
 * riêng trong Setup doanh số của chính nhân sự đang phụ trách: sao lại toàn bộ
 * thông tin khách, chỉ khác ba chỗ —
 *
 *   • Tình trạng = PB (Thanh toán nốt) và KHOÁ CỨNG nhờ cột payoffOfId. Dòng
 *     này sinh ra để thu nốt, đổi sang tình trạng khác là sai bản chất.
 *   • Doanh thu / Còn thiếu / Ngày ký để TRỐNG — tiền chưa thu thì chưa có gì
 *     để ghi. Chừng nào chưa điền Doanh thu thì luật tiền (lib/lead-pricing)
 *     chặn nút Cập nhật, đúng như mọi dòng PB khác.
 *   • Ghi chú chăm sóc không mang sang: đó là nhật ký của đợt tư vấn ban đầu.
 *
 * Dòng mới được tạo thẳng bằng prisma chứ không đi qua POST /api/setup/leads:
 * route kia soát luật tiền trước khi ghi, mà PB chưa có tiền thì không lọt qua
 * được. Đây là dòng "chờ thu", chưa phải doanh thu — nó chỉ đóng góp số 0 vào
 * mọi bảng tổng hợp cho tới khi có người điền tiền vào.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isPT = role === "PT";
  const isFM = role === "FM";
  const isAdmin = role === "ADMIN";
  const isCOO = role === "COO";

  // CEO_FitPartner chỉ được XEM Setup doanh số.
  if (!isPT && !isFM && !isAdmin && !isCOO) {
    return NextResponse.json({ error: "Không có quyền tạo đợt thanh toán nốt" }, { status: 403 });
  }

  const lead = await prisma.salesLead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Không tìm thấy lead" }, { status: 404 });

  if (isPT && lead.assignedPTId !== session.user.id) {
    return NextResponse.json({ error: "Bạn chỉ thao tác được trên lead của mình" }, { status: 403 });
  }
  const managedBranchIds = session.user.managedBranchIds ?? [];
  if (isFM && !managedBranchIds.includes(lead.branchId)) {
    return NextResponse.json({ error: "Không có quyền quản lý chi nhánh này" }, { status: 403 });
  }

  // Chỉ lead ĐÃ CỌC và ĐÃ CÓ TIỀN vào mới sinh được đợt thu nốt — chưa có khoản
  // cọc nào thì cũng chưa có phần còn nợ để thu.
  if (lead.status !== "DE") {
    return NextResponse.json(
      { error: "Chỉ lead ở tình trạng Đặt cọc mới tạo được đợt Thanh toán nốt" },
      { status: 400 },
    );
  }
  if (!lead.actualRevenue) {
    return NextResponse.json(
      { error: "Lead chưa có số tiền cọc — hãy điền Doanh thu rồi bấm Cập nhật trước" },
      { status: 400 },
    );
  }

  // Một khoản cọc chỉ có một đợt thu nốt. Bấm nhầm hai lần không được đẻ ra hai
  // dòng trùng nhau trong bảng.
  const existing = await prisma.salesLead.findFirst({
    where: { payoffOfId: lead.id },
    include: {
      assignedPT: { select: { id: true, name: true, email: true, role: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Lead này đã có đợt Thanh toán nốt rồi", lead: existing },
      { status: 409 },
    );
  }

  const payoff = await prisma.salesLead.create({
    data: {
      branchId:          lead.branchId,
      assignedPTId:      lead.assignedPTId,
      createdById:       session.user.id,
      customerName:      lead.customerName,
      yearOfBirth:       lead.yearOfBirth,
      phone:             lead.phone,
      source:            lead.source,
      referralSource:    lead.referralSource,
      forecast:          lead.forecast,
      packageRegistered: lead.packageRegistered,
      fitpartnerRevenue: lead.fitpartnerRevenue,
      remark:            lead.remark,
      // Cùng kỳ với khoản cọc nên hiện ngay trong bảng nhân sự đang mở. Thu sang
      // tháng khác thì sửa lại như mọi lead bình thường.
      month:             lead.month,
      year:              lead.year,
      status:            "PB",
      payoffOfId:        lead.id,
      // Chưa thu được đồng nào — ba ô này để trống.
      actualRevenue:     null,
      remainingPayment:  null,
      signDate:          null,
      notes:             null,
    },
    include: {
      assignedPT: { select: { id: true, name: true, email: true, role: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  // Không gọi syncLeadRevenueToWeeklyActuals / syncLeadToTransaction ở đây: dòng
  // mới chưa có doanh thu nên không có gì để đồng bộ. Hai hàm đó sẽ chạy ở lần
  // Cập nhật đầu tiên, khi tiền thu nốt thật sự được điền vào.
  return NextResponse.json(payoff, { status: 201 });
}
