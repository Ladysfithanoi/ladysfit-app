/**
 * Huỷ buổi tính lương cho các buổi tập NGOÀI LỘ TRÌNH.
 *
 * Bối cảnh: trước khi có chốt chặn check-in (lib/checkin-eligibility.ts), PT vẫn
 * cho khách ký check-in được kể cả khi lộ trình đã hết buổi hoặc hết hạn. Buổi
 * đó không trừ vào gói nào của khách (countPackageSession trả null) nhưng vẫn
 * được tính lương cho PT khi ký check-out — PT nhận tiền từ buổi khách không hề
 * mua. Script này rà lại lịch sử và huỷ phần tính lương của đúng những buổi đó.
 *
 * CÁCH NHẬN DIỆN — chỉ huỷ khi CHỨNG MINH ĐƯỢC bằng chính dữ liệu lộ trình:
 *   1. Buổi đã ký tính lương: status=COMPLETED + có chữ ký check-out + có nhật ký set.
 *   2. workout_logs."packageEnrollmentId" IS NULL → lúc check-in không có gói nào
 *      trừ được.
 *   3. Khách đã có ít nhất một lộ trình TRONG HỆ THỐNG trước khi buổi được tạo
 *      (loại trường hợp sale/FM nhập hợp đồng muộn — buổi tập là thật, khách có
 *      gói, hệ thống chỉ chưa biết nên không trừ được).
 *   4. MỌI lộ trình đã có lúc đó đều hết hạn trước ngày tập HOẶC đã dùng hết
 *      buổi. Đây là điều kiện chặt nhất: chỉ cần còn một gói về lý thuyết trừ
 *      được thì bỏ qua, thà sót còn hơn cắt oan tiền của PT.
 *
 * Huỷ = đặt status VOID (KHÔNG xoá dữ liệu): buổi biến mất khỏi getTaughtSessions
 * (chỉ đếm COMPLETED) nên không còn tính lương, nhưng nhật ký, chữ ký check-in
 * /check-out và ảnh check-out vẫn giữ nguyên để đối chiếu. Đảo ngược được bằng
 * cách đưa status về COMPLETED.
 *
 * packageCounted cũng đặt lại về false: những buổi này chưa từng trừ buổi của
 * khách, cờ true (đặt sẵn lúc check-in) sẽ làm luồng xoá buổi hoàn nhầm một buổi
 * vào lộ trình gần nhất.
 *
 * Chạy:
 *   npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" scripts/void-out-of-package-sessions.ts             # chỉ xem
 *   npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" scripts/void-out-of-package-sessions.ts --apply     # thực thi
 *   ... --branch=branch-xa-dan   (mặc định; bỏ trống = mọi cơ sở)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

export const VOID_REASON =
  "Buổi ngoài lộ trình — khách đã hết buổi/hết hạn tại ngày tập, không tính lương PT";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

type LogRow = {
  id: string;
  sessionDate: Date;
  createdAt: Date;
  clientId: string;
  client: string;
  pt: string;
};

type PkgRow = {
  id: string;
  clientId: string;
  packageName: string;
  sessions: number;
  sessionsUsed: number;
  endDate: Date | null;
  createdAt: Date;
};

export type Flagged = LogRow & { reason: string; detail: string };

export async function findOutOfPackageSessions(branchId?: string): Promise<{
  flagged: Flagged[];
  skippedLateEntry: number;
  skippedChargeable: number;
  total: number;
}> {
  const logs = await prisma.$queryRawUnsafe<LogRow[]>(
    `
    SELECT wl.id, wl."sessionDate", wl."createdAt", wl."clientId",
           c."fullName" AS client, u.name AS pt
    FROM workout_logs wl
    JOIN clients c ON c.id = wl."clientId"
    JOIN users   u ON u.id = wl."createdById"
    WHERE wl.status = 'COMPLETED'
      AND wl."signatureUrl" IS NOT NULL AND wl."signatureUrl" <> ''
      AND EXISTS (SELECT 1 FROM workout_set_logs sl WHERE sl."workoutLogId" = wl.id)
      AND wl."packageEnrollmentId" IS NULL
      AND ($1::text IS NULL OR u."branchId" = $1::text)
    ORDER BY c."fullName", wl."sessionDate"
    `,
    branchId ?? null
  );

  const clientIds = Array.from(new Set(logs.map((l) => l.clientId)));
  const pkgs = clientIds.length
    ? await prisma.$queryRawUnsafe<PkgRow[]>(
        `SELECT id, "clientId", "packageName", sessions, "sessionsUsed", "endDate", "createdAt"
         FROM package_enrollments WHERE "clientId" = ANY($1::text[]) ORDER BY "createdAt"`,
        clientIds
      )
    : [];
  const byClient = new Map<string, PkgRow[]>();
  for (const p of pkgs) byClient.set(p.clientId, [...(byClient.get(p.clientId) ?? []), p]);

  const flagged: Flagged[] = [];
  let skippedLateEntry = 0;
  let skippedChargeable = 0;

  for (const log of logs) {
    const d = day(log.sessionDate)!;
    // Chỉ xét những lộ trình ĐÃ CÓ trong hệ thống lúc buổi tập được tạo.
    const existed = (byClient.get(log.clientId) ?? []).filter((p) => p.createdAt <= log.createdAt);
    if (existed.length === 0) {
      skippedLateEntry++;
      continue;
    }

    const isExpired = (p: PkgRow) => p.endDate != null && day(p.endDate)! < d;
    const isFull = (p: PkgRow) => p.sessionsUsed >= p.sessions;
    if (!existed.every((p) => isExpired(p) || isFull(p))) {
      // Còn ít nhất một gói lẽ ra trừ được → không kết luận là ngoài lộ trình.
      skippedChargeable++;
      continue;
    }

    const full = existed.filter(isFull);
    const expired = existed.filter(isExpired);
    flagged.push({
      ...log,
      reason:
        full.length && expired.length ? "HẾT BUỔI + HẾT HẠN" : full.length ? "HẾT BUỔI" : "HẾT HẠN",
      detail: existed
        .map((p) => `${p.packageName} ${p.sessionsUsed}/${p.sessions} hạn ${day(p.endDate) ?? "—"}`)
        .join(" | "),
    });
  }

  return { flagged, skippedLateEntry, skippedChargeable, total: logs.length };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const branchArg = args.find((a) => a.startsWith("--branch="));
  const branchId = branchArg ? branchArg.split("=")[1] || undefined : "branch-xa-dan";

  const { flagged, skippedLateEntry, skippedChargeable, total } =
    await findOutOfPackageSessions(branchId);

  console.log(`Cơ sở: ${branchId ?? "TẤT CẢ"}`);
  console.log(`Buổi đã ký nhưng không trừ lộ trình nào: ${total}`);
  console.log(`  • bỏ qua — hợp đồng nhập sau ngày tập:   ${skippedLateEntry}`);
  console.log(`  • bỏ qua — còn gói lẽ ra trừ được:       ${skippedChargeable}`);
  console.log(`  • NGOÀI LỘ TRÌNH (huỷ tính lương):       ${flagged.length}\n`);

  let current = "";
  for (const f of flagged) {
    if (f.client !== current) {
      current = f.client;
      console.log(`\n${f.client}  [PT: ${f.pt}]`);
    }
    console.log(`   ${day(f.sessionDate)}  ${f.reason.padEnd(20)} ${f.detail}`);
  }

  if (!apply) {
    console.log("\n(chạy thử — thêm --apply để thực thi)");
    return;
  }
  if (flagged.length === 0) return;

  const ids = flagged.map((f) => f.id);
  const before = await prisma.workoutLog.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, voidReason: true, packageCounted: true },
  });

  const res = await prisma.workoutLog.updateMany({
    where: { id: { in: ids }, status: "COMPLETED" },
    data: { status: "VOID", voidReason: VOID_REASON, packageCounted: false },
  });
  console.log(`\nĐã huỷ tính lương ${res.count} buổi.`);

  // In sẵn câu lệnh đảo ngược — buổi chỉ đổi trạng thái, dữ liệu và chữ ký còn nguyên.
  console.log("\n-- Trạng thái trước khi huỷ --");
  console.log(JSON.stringify(before));
  console.log("\n-- Đảo ngược nếu cần --");
  console.log(
    `UPDATE workout_logs SET status='COMPLETED', "voidReason"=NULL, "packageCounted"=true\n` +
      `WHERE id IN (${ids.map((i) => `'${i}'`).join(", ")});`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
