export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SALES_TARGET, salesTargetFor } from "@/lib/roles";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isPT = role === "PT";
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const year = parseInt(searchParams.get("year") ?? "0");

  if (!branchId || !year) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  if (isFM && !managedBranchIds.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Pull every lead in the whole year so the client can slice by month/quarter/year
  // without refetching. PT only sees their own data.
  const leads = await prisma.salesLead.findMany({
    where: {
      branchId,
      year,
      ...(isPT ? { assignedPTId: session.user.id } : {}),
    },
    select: {
      month: true,
      status: true,
      actualRevenue: true,
      assignedPTId: true,
      assignedPT: {
        select: {
          id: true, name: true, email: true, role: true,
          ptLevel: { select: { name: true, monthlyTarget: true } },
        },
      },
    },
  });

  // A "khách hàng" (transform) = lead that bought a contract.
  const isWon = (l: (typeof leads)[number]) =>
    l.status === "PIF" || l.status === "DE" || l.status === "PB";

  // ptId → name + 12-month arrays of revenue / customers / leads.
  const ptMap = new Map<string, {
    name: string;
    role: string;
    levelName: string | null;
    salesTarget: number;   // KPI doanh số/tháng (triệu) theo cấp độ PT
    revenue: number[];   // index 0 = tháng 1
    customers: number[];
    leads: number[];
  }>();

  // Số khách hàng thực tế PT phụ trách (đếm Client, không cộng dồn lead won theo tháng
  // — 1 khách gia hạn nhiều lần chỉ tính 1) + số khách đã gán mác đạt transform.
  const clientRows = await prisma.client.findMany({
    where: {
      branchId,
      ...(isPT ? { assignedPTId: session.user.id } : {}),
    },
    select: {
      assignedPTId: true,
      hasTransformed: true,
      assignedPT: {
        select: {
          name: true, email: true, role: true,
          ptLevel: { select: { name: true, monthlyTarget: true } },
        },
      },
    },
  });

  const clientStat = new Map<string, {
    name: string;
    role: string;
    levelName: string | null;
    salesTarget: number;
    clientCount: number;
    transformedCount: number;
  }>();
  for (const c of clientRows) {
    const s = clientStat.get(c.assignedPTId) ?? {
      name: c.assignedPT.name ?? c.assignedPT.email,
      role: c.assignedPT.role,
      levelName: c.assignedPT.ptLevel?.name ?? null,
      salesTarget: salesTargetFor(c.assignedPT.ptLevel?.monthlyTarget),
      clientCount: 0,
      transformedCount: 0,
    };
    s.clientCount += 1;
    if (c.hasTransformed) s.transformedCount += 1;
    clientStat.set(c.assignedPTId, s);
  }

  // Doanh số của lead không gắn PT (nhân sự đã nghỉ) gom vào "phòng tập" — vẫn tính
  // vào tổng doanh số đội nhưng không thuộc hiệu suất của PT nào.
  const house = {
    revenue: Array(12).fill(0),
    customers: Array(12).fill(0),
    leads: Array(12).fill(0),
  };
  let houseHasData = false;

  for (const lead of leads) {
    const m = lead.month - 1;
    if (m < 0 || m >= 12) continue;

    const ptId = lead.assignedPTId;
    if (!ptId || !lead.assignedPT) {
      house.revenue[m] += lead.actualRevenue ?? 0;
      house.leads[m] += 1;
      if (isWon(lead)) house.customers[m] += 1;
      houseHasData = true;
      continue;
    }

    const name = lead.assignedPT.name ?? lead.assignedPT.email;
    const cur = ptMap.get(ptId) ?? {
      name,
      role: lead.assignedPT.role,
      levelName: lead.assignedPT.ptLevel?.name ?? null,
      salesTarget: salesTargetFor(lead.assignedPT.ptLevel?.monthlyTarget),
      revenue: Array(12).fill(0),
      customers: Array(12).fill(0),
      leads: Array(12).fill(0),
    };
    cur.revenue[m] += lead.actualRevenue ?? 0;
    cur.leads[m] += 1;
    if (isWon(lead)) cur.customers[m] += 1;
    ptMap.set(ptId, cur);
  }

  // Tập PT = có hoạt động lead/doanh số trong năm HOẶC đang phụ trách khách hàng.
  const allPtIds = new Set<string>([
    ...Array.from(ptMap.keys()),
    ...Array.from(clientStat.keys()),
  ]);

  const personnel = Array.from(allPtIds)
    .map((ptId) => {
      const stat = ptMap.get(ptId);
      const cStat = clientStat.get(ptId);
      return {
        ptId,
        ptName: stat?.name ?? cStat?.name ?? "",
        ptRole: stat?.role ?? cStat?.role ?? "",
        ptLevelName: stat?.levelName ?? cStat?.levelName ?? null,
        // KPI doanh số/tháng (triệu) theo cấp độ PT — dùng để tính hiệu suất doanh số.
        salesTarget: stat?.salesTarget ?? cStat?.salesTarget ?? DEFAULT_SALES_TARGET,
        revenue: stat?.revenue ?? Array(12).fill(0),
        customers: stat?.customers ?? Array(12).fill(0),
        leads: stat?.leads ?? Array(12).fill(0),
        clientCount: cStat?.clientCount ?? 0,
        transformedCount: cStat?.transformedCount ?? 0,
      };
    })
    // Drop personnel with no activity at all in the year and no clients.
    .filter((p) =>
      p.revenue.some((v) => v > 0) || p.leads.some((v) => v > 0) || p.clientCount > 0
    )
    .sort((a, b) => {
      const ar = a.revenue.reduce((s, v) => s + v, 0);
      const br = b.revenue.reduce((s, v) => s + v, 0);
      return br - ar;
    });

  return NextResponse.json({
    year,
    target: DEFAULT_SALES_TARGET, // KPI mặc định (triệu/tháng) khi PT chưa gán cấp độ
    personnel,                    // mỗi nhân sự mang salesTarget theo cấp độ riêng
    house: houseHasData ? house : null,
  });
}
