import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PACKAGES } from "@/lib/packages";
import { logPTAssignment } from "@/lib/transform-credit";

/**
 * ── Cài đặt → Giả lập ────────────────────────────────────────────────────────
 *
 * Admin "đóng vai" một tài khoản FM/PT để xem đúng giao diện người đó thấy, khỏi
 * phải tạo tài khoản rồi đăng nhập lại mỗi lần kiểm tính năng.
 *
 * Cơ chế: JWT của Admin giữ thêm `actAs` (id tài khoản được đóng vai). Session
 * callback ở lib/auth.ts đổi session.user sang tài khoản đó → mọi màn và API đi
 * qua getServerSession đều thấy FM/PT thật sự, quyền cũng là quyền của FM/PT.
 * session.user.impersonator ghi lại Admin thật để hiện thanh "Đang giả lập".
 *
 * Kèm một bộ dữ liệu TEST cố định (cơ sở, FM, PT, vài khách) để thử tính năng
 * mà không đụng khách thật. Tài khoản test không có mật khẩu — chỉ vào được
 * bằng giả lập.
 */

/** Có đóng vai được không: người thật phải là Admin, đích không phải Admin và chưa bị xoá. */
export async function canSimulate(realUserId: string, targetUserId: string): Promise<boolean> {
  if (realUserId === targetUserId) return false;
  const [real, target] = await Promise.all([
    prisma.user.findUnique({ where: { id: realUserId }, select: { role: true, deletedAt: true } }),
    prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true, deletedAt: true } }),
  ]);
  return (
    real?.role === Role.ADMIN && !real.deletedAt &&
    !!target && !target.deletedAt && target.role !== Role.ADMIN
  );
}

// ─── Dữ liệu test ─────────────────────────────────────────────────────────────

export const TEST_BRANCH_NAME = "🧪 Cơ sở Giả lập";
export const TEST_FM_EMAIL    = "test.fm@ladysfit.test";
export const TEST_PT_EMAIL    = "test.pt@ladysfit.test";
/** Mã khách test — không theo dạng LDFxxxx nên không chiếm số của khách thật. */
const TEST_CLIENT_CODE_PREFIX = "TEST-";

/** Tài khoản test nhận ra bằng đuôi email. */
export function isTestEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith("@ladysfit.test");
}

const DAY = 24 * 60 * 60 * 1000;

type TestPackage = { name: string; startOffsetDays: number; status?: "ACTIVE" | "COMPLETED"; price?: number };
type TestClient = {
  code: string;
  fullName: string;
  phone: string;
  initialWeight: number;
  currentWeight: number;
  targetWeight: number;
  height: number;
  goalNote: string;
  packages: TestPackage[];
};

const TEST_CLIENTS: TestClient[] = [
  {
    code: "01", fullName: "🧪 Khách A · đang tập L1", phone: "0900000001",
    initialWeight: 66, currentWeight: 64.2, targetWeight: 58, height: 158,
    goalNote: "Khách test: L1 đã bắt đầu 7 ngày trước — thử check-in/check-out, nhật ký cân.",
    packages: [{ name: "L1", startOffsetDays: -7, price: PACKAGES.L1.discountedPrice }],
  },
  {
    code: "02", fullName: "🧪 Khách B · chưa tới ngày tập", phone: "0900000002",
    initialWeight: 72, currentWeight: 72, targetWeight: 63, height: 160,
    goalNote: "Khách test: L2 bắt đầu sau 3 ngày nữa — trạng thái 'Chưa tập'.",
    packages: [{ name: "L2", startOffsetDays: 3, price: PACKAGES.L2.discountedPrice }],
  },
  {
    code: "03", fullName: "🧪 Khách C · tái ký L3", phone: "0900000003",
    initialWeight: 70, currentWeight: 63.5, targetWeight: 58, height: 162,
    goalNote: "Khách test: xong L1, đang tập L3 (tái ký) — thử nhiều gói, thứ tự trừ buổi.",
    packages: [
      { name: "L1", startOffsetDays: -60, status: "COMPLETED", price: PACKAGES.L1.discountedPrice },
      { name: "L3", startOffsetDays: -20 },
    ],
  },
];

/**
 * Tạo (hoặc làm mới) bộ dữ liệu test. Gọi lại nhiều lần được: cơ sở và tài khoản
 * giữ nguyên id, còn khách test bị xoá rồi tạo lại nên mọi thứ đã thử trên khách
 * test (buổi tập, cân nặng…) trở về trạng thái ban đầu.
 */
export async function seedSimulationData() {
  const branch =
    (await prisma.branch.findFirst({ where: { name: TEST_BRANCH_NAME } })) ??
    (await prisma.branch.create({ data: { name: TEST_BRANCH_NAME, address: "Dữ liệu test — không phải cơ sở thật" } }));

  const lowestLevel = await prisma.pTLevel.findFirst({ orderBy: { order: "asc" }, select: { id: true } });

  const upsertUser = (email: string, name: string, role: Role, extra: { ptLevelId?: string | null } = {}) =>
    prisma.user.upsert({
      where:  { email },
      update: { name, role, branchId: branch.id, deletedAt: null, ...extra },
      create: { email, name, role, branchId: branch.id, password: null, ...extra },
    });

  const fm = await upsertUser(TEST_FM_EMAIL, "🧪 FM Giả lập", Role.FM);
  const pt = await upsertUser(TEST_PT_EMAIL, "🧪 PT Giả lập", Role.PT, { ptLevelId: lowestLevel?.id ?? null });

  await prisma.fMBranchAssignment.upsert({
    where:  { userId_branchId: { userId: fm.id, branchId: branch.id } },
    update: {},
    create: { userId: fm.id, branchId: branch.id },
  });

  // Làm mới khách test: xoá sạch rồi tạo lại (quan hệ con đều Cascade/SetNull).
  // Xoá và tạo cùng số lượng nên tổng số khách — thứ sinh mã LDFxxxx — không đổi.
  await prisma.client.deleteMany({ where: { clientCode: { startsWith: TEST_CLIENT_CODE_PREFIX } } });

  const now = Date.now();
  for (const c of TEST_CLIENTS) {
    const client = await prisma.client.create({
      data: {
        clientCode:    TEST_CLIENT_CODE_PREFIX + c.code,
        fullName:      c.fullName,
        phone:         c.phone,
        initialWeight: c.initialWeight,
        currentWeight: c.currentWeight,
        targetWeight:  c.targetWeight,
        height:        c.height,
        goalNote:      c.goalNote,
        assignedPTId:  pt.id,
        branchId:      branch.id,
        contractCount: c.packages.length,
        createdAt:     new Date(now + Math.min(...c.packages.map((p) => p.startOffsetDays), 0) * DAY),
      },
    });
    await logPTAssignment(client.id, pt.id, "CREATED");

    for (const p of c.packages) {
      const def = PACKAGES[p.name];
      const start = new Date(now + p.startOffsetDays * DAY);
      await prisma.packageEnrollment.create({
        data: {
          clientId:     client.id,
          contractCode: `${TEST_CLIENT_CODE_PREFIX}${c.code}-${p.name}`,
          packageName:  def.name,
          packageStage: def.stage,
          sessions:     def.sessions,
          sessionsUsed: p.status === "COMPLETED" ? def.sessions : 0,
          durationDays: def.durationDays,
          startDate:    start,
          endDate:      new Date(start.getTime() + def.durationDays * DAY),
          price:        p.price ?? def.price,
          status:       p.status ?? "ACTIVE",
          notes:        "Dữ liệu test (Cài đặt → Giả lập)",
        },
      });
    }

    // Vài mốc cân để biểu đồ có dữ liệu.
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const w = c.initialWeight - ((c.initialWeight - c.currentWeight) * i) / steps;
      await prisma.weightLog.create({
        data: {
          clientId: client.id,
          date:     new Date(now - (steps - i) * 3 * DAY),
          weight:   Math.round(w * 10) / 10,
        },
      });
    }
  }

  return { branchId: branch.id, fmId: fm.id, ptId: pt.id, clients: TEST_CLIENTS.length };
}
