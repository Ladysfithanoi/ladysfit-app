import { prisma } from "@/lib/prisma";
import { recountClientContracts } from "@/lib/recount-contracts";
import { PACKAGES } from "@/lib/packages";
import { chainPackageDates } from "@/lib/package-chain";

type LeadForSync = {
  id: string;
  phone: string | null;
  packageRegistered: string | null;
  actualRevenue: number | null;
  signDate: Date | null;
  assignedPTId: string | null;
};

// Gói tạo tay cùng tên, bắt đầu trong khoảng [ngày ký − 30 ngày, ngày ký + 15
// ngày] được coi là chính hợp đồng của lead (FM nhập lead muộn hoặc ghi ngày ký
// lệch vài hôm). Khách mua lại đúng gói đó trong vòng 30 ngày gần như không có.
const SAME_CONTRACT_DAYS_BEFORE = 30;
const SAME_CONTRACT_DAYS_AFTER  = 15;

// A lead's registered-package field can hold several packages ("L1+L3",
// "L1, L4", "L3/L5"). Split it into the individual package keys.
function parsePackageKeys(pkg: string | null): string[] {
  if (!pkg?.trim()) return [];
  return pkg.split(/[,+/]/).map((s) => s.trim()).filter(Boolean);
}

export async function syncLeadToClient(lead: LeadForSync): Promise<string | null> {
  if (!lead.phone) return null;

  const client = await prisma.client.findFirst({
    where: { phone: lead.phone },
  });
  if (!client) return null;

  // Idempotency: skip if this lead has already been synced (either the legacy
  // single code or any of the per-package codes).
  const baseCode = `SYNC-${lead.id}`;
  const already = await prisma.packageEnrollment.findFirst({
    where: { OR: [{ contractCode: baseCode }, { contractCode: { startsWith: `${baseCode}-` } }] },
    select: { id: true },
  });
  if (already) return client.id;

  const price = lead.actualRevenue ?? 0;
  const startDate = lead.signDate ?? null;

  // One enrollment per registered package, with the session count + duration +
  // stage taken from the canonical Ladysfit lộ trình (lib/packages) instead of a
  // hard-coded default. Unknown/empty labels fall back to a single generic gói.
  const keys = parsePackageKeys(lead.packageRegistered);
  const entries = keys.length > 0 ? keys : [lead.packageRegistered || "Unknown"];

  // GÓI ĐÃ TẠO TAY THÌ KHÔNG TẠO LẠI. FM hay tạo lộ trình ở hồ sơ khách trước (có
  // mã HĐ, ngày bắt đầu) rồi vài hôm sau mới nhập lead ở Setup doanh số. Trước đây
  // lead vẫn tạo thêm một gói cùng tên → khách có hai lộ trình cho một hợp đồng:
  // gói thừa 0 buổi, phiếu check-in của nó trống trơn, số hợp đồng bị đếm đôi.
  // Cùng tên gói và ngày bắt đầu nằm quanh ngày ký → coi là cùng một hợp đồng.
  const anchor = startDate ?? new Date();
  const manual = await prisma.packageEnrollment.findMany({
    where: {
      clientId: client.id,
      packageName: { in: entries.map((k) => PACKAGES[k]?.name ?? k) },
      startDate: {
        gte: new Date(anchor.getTime() - SAME_CONTRACT_DAYS_BEFORE * 86_400_000),
        lte: new Date(anchor.getTime() + SAME_CONTRACT_DAYS_AFTER * 86_400_000),
      },
      NOT: { contractCode: { startsWith: "SYNC-" } },
    },
    select: { packageName: true, startDate: true, endDate: true },
  });
  const manualByName = new Map(manual.map((m) => [m.packageName, m]));
  const alreadyHas = new Set(manual.map((m) => m.packageName));
  const toCreate = entries.filter((key) => !alreadyHas.has(PACKAGES[key]?.name ?? key));

  // Nhiều gói một hợp đồng: gói sau bắt đầu ngày hôm sau ngày kết thúc của gói
  // trước (lib/package-chain); gói đã tạo tay giữ ngày của nó, gói mới nối sau.
  const chained = startDate
    ? chainPackageDates(entries.map((key) => ({
        packageName: PACKAGES[key]?.name ?? key,
        durationDays: PACKAGES[key]?.durationDays ?? 90,
        fixed: manualByName.get(PACKAGES[key]?.name ?? key) ?? null,
      })), startDate)
    : null;

  const data = toCreate.map((key, idx) => {
    const def = PACKAGES[key];
    const durationDays = def?.durationDays ?? 90;
    // Gói không có ngày hết hạn là gói không bao giờ hết hạn — nó nằm mãi đầu hàng
    // trừ buổi (xem POST /api/clients/[id]/packages). Ngày tính ở chainPackageDates,
    // cùng công thức end = start + durationDays với chỗ đó.
    const dates = chained?.[entries.indexOf(key)] ?? null;
    return {
      clientId: client.id,
      // Unique code per enrollment when several packages are synced for one lead.
      contractCode: entries.length > 1 ? `${baseCode}-${key}` : baseCode,
      packageName: def?.name ?? key,
      packageStage: def?.stage ?? "",
      sessions: def?.sessions ?? 30,
      sessionsUsed: 0,
      startDate: dates?.startDate ?? null,
      endDate: dates?.endDate ?? null,
      durationDays,
      reservedDays: 0,
      extensionDays: 0,
      // actualRevenue is the whole-deal price; put it on the first enrollment so
      // the client's total package price isn't multiplied across packages. Gói đầu
      // đã có sẵn (tạo tay, có giá riêng) thì không gói nào mang giá nữa.
      price: idx === 0 && toCreate[0] === entries[0] ? price : 0,
      contractType: "NORMAL" as const,
      status: "ACTIVE" as const,
      notes: null,
    };
  });

  if (data.length > 0) {
    await prisma.packageEnrollment.createMany({ data });
    await recountClientContracts(client.id);
  }

  return client.id;
}
