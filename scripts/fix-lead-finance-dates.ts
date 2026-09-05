/**
 * Sửa những dòng Bảng thu nằm sai kỳ ghi nhận.
 *
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fix-lead-finance-dates.ts          # chỉ xem, không ghi
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fix-lead-finance-dates.ts --apply  # ghi thật
 *
 * Setup doanh số cộng doanh thu theo month/year của hợp đồng; Bảng thu nhóm
 * theo transactionDate. Hai bên lệch nhau thì tiền ghi ở kỳ này lại hiện ra ở
 * bảng thu của kỳ khác — nhìn từ Bảng thu thì y như mất tiền.
 *
 * Script làm hai việc, và chỉ làm khi chắc chắn:
 *
 *   1a. NGÀY KÝ CHỈ SAI MỖI NĂM — ngày và tháng đã khớp kỳ (24/08/2025 cho kỳ
 *       8/2026). Đổi năm về đúng kỳ.
 *
 *   1b. NGÀY KÝ BỊ ĐẢO NGÀY VỚI THÁNG. Nhận ra bằng ba dấu hiệu cùng lúc: ngày
 *      ký nằm ngoài kỳ, số ngày của nó đúng bằng tháng của kỳ, và đảo lại thì
 *      rơi đúng vào kỳ. Ví dụ hợp đồng kỳ 3/2026 đang ghi 03/11/2026 — đảo lại
 *      là 11/03/2026, vừa khớp kỳ vừa không còn nằm ở tương lai.
 *      Không khớp cả ba thì KHÔNG đụng vào ngày ký.
 *
 *   2. NGÀY TRÊN DÒNG BẢNG THU. Tính lại bằng transactionDateFor() — cùng hàm
 *      mà đường đồng bộ đang dùng, nên chạy script này xong thì mọi dòng khớp
 *      đúng cái luật đang chạy, không đẻ ra một luật thứ hai.
 *
 * Số tiền, người tạo, mô tả: không đụng tới.
 */
import { PrismaClient } from "@prisma/client";
import { transactionDateFor } from "../lib/finance-period";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const dmy = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/**
 * Ngày ký chỉ SAI MỖI NĂM — ngày và tháng đã khớp kỳ, đổi năm là vừa khít.
 * Ví dụ hợp đồng kỳ 8/2026 ghi 24/08/2025, hoặc 28/08/2006.
 */
function wrongYearOnly(signDate: Date, month: number, year: number): Date | null {
  if (signDate.getFullYear() === year) return null;
  if (signDate.getMonth() + 1 !== month) return null;
  return new Date(year, month - 1, signDate.getDate(), 12, 0, 0, 0);
}

/** Ngày ký đảo ngày↔tháng có rơi đúng vào kỳ không? Không thì trả null. */
function unswapped(signDate: Date, month: number, year: number): Date | null {
  const d = signDate.getDate();
  const m = signDate.getMonth() + 1;
  if (signDate.getFullYear() === year && m === month) return null; // vốn đã đúng kỳ
  if (d !== month) return null;                                     // không khớp dấu hiệu đảo
  if (m > 31 || m < 1) return null;
  const fixed = new Date(year, d - 1, m, 12, 0, 0, 0);              // ngày ↔ tháng
  if (fixed.getMonth() + 1 !== month || fixed.getDate() !== m) return null;
  return fixed;
}

async function main() {
  const leads = await prisma.salesLead.findMany({
    where: { status: { in: ["PIF", "DE", "PB"] }, actualRevenue: { gt: 0 } },
    include: { branch: { select: { name: true } }, assignedPT: { select: { name: true } } },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });
  const txs = await prisma.transaction.findMany({
    where: { referenceId: { in: leads.map((l) => l.id) } },
    select: { id: true, referenceId: true, transactionDate: true },
  });
  const byLead = new Map<string, typeof txs>();
  for (const t of txs) {
    const arr = byLead.get(t.referenceId!) ?? [];
    arr.push(t);
    byLead.set(t.referenceId!, arr);
  }

  const signFixes: { id: string; label: string; from: Date; to: Date }[] = [];
  const dateFixes: { txId: string; label: string; from: Date; to: Date; money: number }[] = [];

  for (const lead of leads) {
    const label = `${lead.branch.name} · ${lead.customerName} · PT ${lead.assignedPT?.name ?? "—"} · kỳ ${lead.month}/${lead.year}`;

    // 1. Ngày ký bị đảo
    let signDate = lead.signDate;
    if (signDate) {
      const fixed = unswapped(signDate, lead.month, lead.year) ?? wrongYearOnly(signDate, lead.month, lead.year);
      if (fixed) {
        signFixes.push({ id: lead.id, label, from: signDate, to: fixed });
        signDate = fixed;
      }
    }

    // 2. Ngày trên dòng bảng thu — tính bằng đúng hàm của đường đồng bộ
    const want = transactionDateFor({ signDate, month: lead.month, year: lead.year, createdAt: lead.createdAt });
    for (const t of byLead.get(lead.id) ?? []) {
      const same =
        t.transactionDate.getFullYear() === want.getFullYear() &&
        t.transactionDate.getMonth() === want.getMonth() &&
        t.transactionDate.getDate() === want.getDate();
      if (!same) {
        dateFixes.push({ txId: t.id, label, from: t.transactionDate, to: want, money: lead.actualRevenue! });
      }
    }
  }

  console.log(`Hợp đồng đã chốt có doanh thu: ${leads.length}\n`);

  console.log(`── Ngày ký bị đảo ngày với tháng: ${signFixes.length} ──`);
  for (const f of signFixes.slice(0, 60)) console.log(`  ${f.label}\n      ${dmy(f.from)}  →  ${dmy(f.to)}`);
  if (signFixes.length > 60) console.log(`  … và ${signFixes.length - 60} dòng nữa`);

  const moved = new Map<string, number>();
  for (const f of dateFixes) {
    const from = `${f.from.getMonth() + 1}/${f.from.getFullYear()}`;
    const to = `${f.to.getMonth() + 1}/${f.to.getFullYear()}`;
    if (from !== to) moved.set(`${from} → ${to}`, (moved.get(`${from} → ${to}`) ?? 0) + f.money);
  }
  console.log(`\n── Dòng Bảng thu phải đổi ngày: ${dateFixes.length} ──`);
  const movedRows = Array.from(moved.entries()).sort();
  const movedTotal = movedRows.reduce((s, [, v]) => s + v, 0);
  console.log(`   Trong đó chuyển sang tháng khác: ${movedTotal.toFixed(1)} triệu`);
  movedRows.forEach(([k, v]) => console.log(`     ${k.padEnd(22)} ${v.toFixed(1)} triệu`));

  if (!APPLY) {
    console.log(`\n(Chạy thử — chưa ghi gì. Thêm --apply để ghi thật.)`);
    return;
  }

  for (const f of signFixes) {
    await prisma.salesLead.update({ where: { id: f.id }, data: { signDate: f.to } });
  }
  for (const f of dateFixes) {
    await prisma.transaction.update({ where: { id: f.txId }, data: { transactionDate: f.to } });
  }
  console.log(`\nĐã ghi: ${signFixes.length} ngày ký, ${dateFixes.length} dòng bảng thu.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
