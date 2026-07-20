import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const HOUSE_KEY = "__house__";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isFM = role === "FM";
  const isCOO = role === "COO";
  // CEO_FitPartner chỉ được XEM — không chuyển lead sang tháng sau. (COO ngang quyền Admin)
  if (!isFM && !isCOO) {
    return NextResponse.json({ error: "Chỉ FM hoặc COO mới có thể chuyển lead" }, { status: 403 });
  }

  const { branchId, month, year, reassignments } = await req.json() as {
    branchId: string;
    month: number;
    year: number;
    // Map: assignedPTId của NS đã nghỉ (hoặc "__house__" cho lead chưa phân bổ) → id PT mới
    reassignments?: Record<string, string>;
  };

  if (isFM) {
    const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
    if (!managedBranchIds.includes(branchId)) {
      return NextResponse.json({ error: "Không có quyền quản lý chi nhánh này" }, { status: 403 });
    }
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const leads = await prisma.salesLead.findMany({
    where: {
      branchId,
      month,
      year,
      status: { in: ["TAKECARE", "DE"] },
    },
    include: {
      assignedPT: { select: { id: true, name: true, email: true, deletedAt: true } },
    },
  });

  // ── Phát hiện lead thuộc nhân sự đã nghỉ việc (hoặc chưa phân bổ) ─────────────
  // Nhân sự đã nghỉ = deletedAt != null. Lead của họ không thể tự đẩy sang tháng
  // sau, phải phân lại cho PT đang làm việc trước.
  const quitGroups = new Map<string, { id: string; name: string; leadCount: number }>();
  for (const lead of leads) {
    const pt = lead.assignedPT;
    const isQuit = !lead.assignedPTId || (pt != null && pt.deletedAt != null);
    if (!isQuit) continue;
    const key = lead.assignedPTId ?? HOUSE_KEY;
    const name = pt ? (pt.name ?? pt.email) : "Chưa phân bổ / Phòng tập";
    const cur = quitGroups.get(key);
    if (cur) cur.leadCount++;
    else quitGroups.set(key, { id: key, name, leadCount: 1 });
  }

  const map = reassignments ?? {};

  if (quitGroups.size > 0) {
    const groups = Array.from(quitGroups.values());
    // Xác định những nhóm chưa được phân lại → yêu cầu FM phân Lead cho PT khác.
    const unresolved = groups.filter(g => !map[g.id]);
    if (unresolved.length > 0) {
      return NextResponse.json(
        {
          error: "NEEDS_REASSIGNMENT",
          quitStaff: groups,
        },
        { status: 409 },
      );
    }

    // Kiểm tra các PT được chọn là hợp lệ (đang làm việc)
    const targetIds = Array.from(new Set(groups.map(g => map[g.id])));
    const validTargets = await prisma.user.findMany({
      where: {
        id: { in: targetIds },
        deletedAt: null,
        role: { in: ["PT", "FM", "ADMIN"] },
      },
      select: { id: true },
    });
    const validIds = new Set(validTargets.map(u => u.id));
    const invalid = targetIds.filter(id => !validIds.has(id));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "Nhân sự được chọn không hợp lệ hoặc đã nghỉ việc" },
        { status: 400 },
      );
    }
  }

  let carried = 0;
  let skipped = 0;

  for (const lead of leads) {
    const pt = lead.assignedPT;
    const isQuit = !lead.assignedPTId || (pt != null && pt.deletedAt != null);
    // PT phụ trách của lead ở tháng mới: nếu NS đã nghỉ thì lấy PT được phân lại.
    const targetPTId = isQuit ? map[lead.assignedPTId ?? HOUSE_KEY] : lead.assignedPTId;

    // Dedup by phone + PT phụ trách (mới) nếu có số điện thoại
    if (lead.phone) {
      const exists = await prisma.salesLead.findFirst({
        where: {
          phone: lead.phone,
          assignedPTId: targetPTId,
          branchId: lead.branchId,
          month: nextMonth,
          year: nextYear,
        },
      });
      if (exists) {
        skipped++;
        continue;
      }
    }

    const carryNote = `[Chuyển từ tháng ${month}/${year}]`;
    const reassignNote = isQuit
      ? `\n[Phân lại từ NS đã nghỉ: ${pt ? (pt.name ?? pt.email) : "Chưa phân bổ"}]`
      : "";
    const newNotes = (lead.notes ? `${lead.notes}\n${carryNote}` : carryNote) + reassignNote;

    await prisma.salesLead.create({
      data: {
        branchId: lead.branchId,
        assignedPTId: targetPTId,
        createdById: session.user.id,
        customerName: lead.customerName,
        yearOfBirth: lead.yearOfBirth,
        phone: lead.phone,
        source: lead.source,
        notes: newNotes,
        forecast: lead.forecast,
        status: lead.status,
        month: nextMonth,
        year: nextYear,
      },
    });
    carried++;
  }

  return NextResponse.json({ carried, skipped, nextMonth, nextYear });
}
