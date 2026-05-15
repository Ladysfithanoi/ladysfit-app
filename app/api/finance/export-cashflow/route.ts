import { NextResponse }    from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "@/lib/auth";
import { prisma }           from "@/lib/prisma";
import ExcelJS              from "exceljs";

const C_RED   = "FFF15B5C";
const C_WHITE = "FFFFFFFF";
const C_GRAY  = "FFF9F9F9";
const C_TOTAL = "FFEFF6FF";
const C_BORD  = "FFD0D0D0";
const C_GREEN = "FF10B981";
const C_EXPNS = "FFEF4444";
const C_BLUE  = "FF3B82F6";

const MONTH_LABELS = [
  "Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
  "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12",
];

function styleHeader(cell: ExcelJS.Cell) {
  cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C_RED } };
  cell.font      = { bold: true, color: { argb: C_WHITE }, size: 10 };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border    = {
    top:    { style: "thin", color: { argb: C_BORD } },
    bottom: { style: "thin", color: { argb: C_BORD } },
    left:   { style: "thin", color: { argb: C_BORD } },
    right:  { style: "thin", color: { argb: C_BORD } },
  };
}

function styleData(cell: ExcelJS.Cell, even: boolean) {
  cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: even ? C_GRAY : C_WHITE } };
  cell.alignment = { vertical: "middle" };
  cell.border    = { bottom: { style: "thin", color: { argb: "FFF0F0F0" } } };
}

function styleTotal(cell: ExcelJS.Cell) {
  cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: C_TOTAL } };
  cell.font   = { bold: true, size: 11 };
  cell.border = {
    top:    { style: "medium", color: { argb: C_BORD } },
    bottom: { style: "thin",   color: { argb: C_BORD } },
  };
}

type CashflowRow = {
  label:   string;
  income:  number;
  expense: number;
  profit:  number;
  growth?: number | null;
};

function buildSheet(
  ws:          ExcelJS.Worksheet,
  branchName:  string,
  periodLabel: string,
  data:        CashflowRow[],
  sheetType:   "monthly" | "quarterly" | "yearly",
) {
  const isYearly = sheetType === "yearly";
  const ncols    = isYearly ? 6 : 5;

  const colWidths = sheetType === "monthly"
    ? [20, 22, 22, 22, 12]
    : sheetType === "quarterly"
    ? [18, 22, 22, 22, 12]
    : [10, 22, 22, 22, 12, 16];

  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Row 1: info
  ws.mergeCells(1, 1, 1, ncols);
  const infoCell     = ws.getCell(1, 1);
  infoCell.value     = `Cơ sở: ${branchName}   |   ${periodLabel}`;
  infoCell.font      = { bold: true, size: 12 };
  infoCell.alignment = { horizontal: "center", vertical: "middle" };
  infoCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C_TOTAL } };
  ws.getRow(1).height = 28;
  ws.getRow(2).height = 6;

  // Row 3: headers
  const hdrs = sheetType === "monthly"
    ? ["Tháng", "Tổng thu", "Tổng chi", "Lợi nhuận", "Tỉ suất %"]
    : sheetType === "quarterly"
    ? ["Quý", "Tổng thu", "Tổng chi", "Lợi nhuận", "Tỉ suất %"]
    : ["Năm", "Tổng thu", "Tổng chi", "Lợi nhuận", "Tỉ suất %", "Tăng trưởng %"];

  hdrs.forEach((h, i) => {
    const c = ws.getCell(3, i + 1);
    c.value = h;
    styleHeader(c);
  });
  ws.getRow(3).height = 30;

  // Data rows
  const DATA_START = 4;
  let totalIncome = 0, totalExpense = 0;

  data.forEach((row, idx) => {
    const r    = ws.getRow(DATA_START + idx);
    const even = idx % 2 === 1;
    r.height   = 22;

    const isEmpty    = row.income === 0 && row.expense === 0;
    const profitRate = row.income > 0 ? row.profit / row.income : 0;

    const c1 = r.getCell(1);
    c1.value = row.label;
    styleData(c1, even);
    if (sheetType === "yearly") c1.font = { bold: true };

    const c2 = r.getCell(2);
    c2.value = row.income > 0 ? row.income : null;
    styleData(c2, even);
    if (row.income > 0) {
      c2.numFmt    = '#,##0"đ"';
      c2.font      = { color: { argb: C_GREEN } };
      c2.alignment = { horizontal: "right", vertical: "middle" };
    }

    const c3 = r.getCell(3);
    c3.value = row.expense > 0 ? row.expense : null;
    styleData(c3, even);
    if (row.expense > 0) {
      c3.numFmt    = '#,##0"đ"';
      c3.font      = { color: { argb: C_EXPNS } };
      c3.alignment = { horizontal: "right", vertical: "middle" };
    }

    const c4 = r.getCell(4);
    c4.value = isEmpty ? null : row.profit;
    styleData(c4, even);
    if (!isEmpty) {
      c4.numFmt    = '#,##0"đ"';
      c4.font      = { bold: true, color: { argb: row.profit >= 0 ? C_BLUE : C_EXPNS } };
      c4.alignment = { horizontal: "right", vertical: "middle" };
    }

    const c5 = r.getCell(5);
    c5.value = isEmpty ? null : profitRate;
    styleData(c5, even);
    if (!isEmpty) {
      c5.numFmt    = "0.0%";
      c5.font      = { color: { argb: profitRate >= 0 ? C_BLUE : C_EXPNS } };
      c5.alignment = { horizontal: "right", vertical: "middle" };
    }

    if (isYearly) {
      const c6 = r.getCell(6);
      styleData(c6, even);
      if (row.growth != null) {
        c6.value     = row.growth / 100;
        c6.numFmt    = "0.0%";
        c6.font      = { bold: true, color: { argb: row.growth >= 0 ? C_GREEN : C_EXPNS } };
        c6.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        c6.value     = "—";
        c6.font      = { color: { argb: "FFCCCCCC" } };
        c6.alignment = { horizontal: "center", vertical: "middle" };
      }
    }

    totalIncome  += row.income;
    totalExpense += row.expense;
    r.commit();
  });

  // Total row
  const totalProfit = totalIncome - totalExpense;
  const totalRate   = totalIncome > 0 ? totalProfit / totalIncome : 0;
  const tRow        = ws.getRow(DATA_START + data.length);
  tRow.height       = 26;

  for (let c = 1; c <= ncols; c++) styleTotal(tRow.getCell(c));

  tRow.getCell(1).value     = "TỔNG CỘNG";
  tRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  tRow.getCell(1).font      = { bold: true };

  tRow.getCell(2).value     = totalIncome;
  tRow.getCell(2).numFmt    = '#,##0"đ"';
  tRow.getCell(2).font      = { bold: true, size: 12, color: { argb: C_GREEN } };
  tRow.getCell(2).alignment = { horizontal: "right", vertical: "middle" };

  tRow.getCell(3).value     = totalExpense;
  tRow.getCell(3).numFmt    = '#,##0"đ"';
  tRow.getCell(3).font      = { bold: true, size: 12, color: { argb: C_EXPNS } };
  tRow.getCell(3).alignment = { horizontal: "right", vertical: "middle" };

  tRow.getCell(4).value     = totalProfit;
  tRow.getCell(4).numFmt    = '#,##0"đ"';
  tRow.getCell(4).font      = { bold: true, size: 12, color: { argb: totalProfit >= 0 ? C_BLUE : C_EXPNS } };
  tRow.getCell(4).alignment = { horizontal: "right", vertical: "middle" };

  tRow.getCell(5).value     = totalRate;
  tRow.getCell(5).numFmt    = "0.0%";
  tRow.getCell(5).font      = { bold: true, size: 12, color: { argb: totalRate >= 0 ? C_BLUE : C_EXPNS } };
  tRow.getCell(5).alignment = { horizontal: "right", vertical: "middle" };

  if (isYearly) {
    tRow.getCell(6).value     = "—";
    tRow.getCell(6).font      = { bold: true, color: { argb: "FFCCCCCC" } };
    tRow.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
  }

  tRow.commit();
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role === "PT")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let parsed: {
    branchId: string;
    period:   "monthly" | "quarterly" | "yearly";
    year?:     number;
    fromYear?: number;
    toYear?:   number;
  };
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { branchId, period } = parsed;
  const year     = parsed.year     ?? new Date().getFullYear();
  const fromYear = parsed.fromYear ?? year;
  const toYear   = parsed.toYear   ?? year;

  const managed: string[] = session.user.managedBranchIds ?? [];
  if (role === "FM" && !managed.includes(branchId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const branch     = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
    const branchName = branch?.name ?? branchId;

    const wb   = new ExcelJS.Workbook();
    wb.creator = "Ladysfit";
    wb.modified = new Date();

    if (period === "monthly") {
      const start = new Date(year, 0, 1);
      const end   = new Date(year + 1, 0, 1);

      const rows = await prisma.transaction.findMany({
        where:  { branchId, transactionDate: { gte: start, lt: end } },
        select: { type: true, amount: true, transactionDate: true },
      });

      const byMonth: Record<number, { income: number; expense: number }> = {};
      for (let m = 1; m <= 12; m++) byMonth[m] = { income: 0, expense: 0 };
      for (const r of rows) {
        const m = new Date(r.transactionDate).getMonth() + 1;
        if (r.type === "INCOME") byMonth[m].income += r.amount;
        else byMonth[m].expense += r.amount;
      }

      const data: CashflowRow[] = Array.from({ length: 12 }, (_, i) => {
        const m       = i + 1;
        const income  = byMonth[m].income;
        const expense = byMonth[m].expense;
        return { label: `${MONTH_LABELS[i]}/${year}`, income, expense, profit: income - expense };
      });

      const ws = wb.addWorksheet("Dòng tiền theo tháng");
      buildSheet(ws, branchName, `Năm ${year}`, data, "monthly");
    }

    if (period === "quarterly") {
      const start = new Date(year, 0, 1);
      const end   = new Date(year + 1, 0, 1);

      const rows = await prisma.transaction.findMany({
        where:  { branchId, transactionDate: { gte: start, lt: end } },
        select: { type: true, amount: true, transactionDate: true },
      });

      const byQ: Record<number, { income: number; expense: number }> = {
        1: { income: 0, expense: 0 }, 2: { income: 0, expense: 0 },
        3: { income: 0, expense: 0 }, 4: { income: 0, expense: 0 },
      };
      for (const r of rows) {
        const m = new Date(r.transactionDate).getMonth() + 1;
        const q = Math.ceil(m / 3);
        if (r.type === "INCOME") byQ[q].income += r.amount;
        else byQ[q].expense += r.amount;
      }

      const data: CashflowRow[] = [1, 2, 3, 4].map(q => ({
        label:   `Quý ${q}/${year}`,
        income:  byQ[q].income,
        expense: byQ[q].expense,
        profit:  byQ[q].income - byQ[q].expense,
      }));

      const ws = wb.addWorksheet("Dòng tiền theo quý");
      buildSheet(ws, branchName, `Năm ${year}`, data, "quarterly");
    }

    if (period === "yearly") {
      const fetchFrom = fromYear - 1;
      const start     = new Date(fetchFrom, 0, 1);
      const end       = new Date(toYear + 1, 0, 1);

      const rows = await prisma.transaction.findMany({
        where:  { branchId, transactionDate: { gte: start, lt: end } },
        select: { type: true, amount: true, transactionDate: true },
      });

      const byYear: Record<number, { income: number; expense: number }> = {};
      for (const r of rows) {
        const y = new Date(r.transactionDate).getFullYear();
        if (!byYear[y]) byYear[y] = { income: 0, expense: 0 };
        if (r.type === "INCOME") byYear[y].income += r.amount;
        else byYear[y].expense += r.amount;
      }

      const data: CashflowRow[] = [];
      for (let y = fromYear; y <= toYear; y++) {
        const income     = byYear[y]?.income  ?? 0;
        const expense    = byYear[y]?.expense ?? 0;
        const profit     = income - expense;
        const prevProfit = (byYear[y - 1]?.income ?? 0) - (byYear[y - 1]?.expense ?? 0);
        const growth     = prevProfit !== 0 ? ((profit - prevProfit) / Math.abs(prevProfit)) * 100 : null;
        data.push({ label: String(y), income, expense, profit, growth });
      }

      const ws = wb.addWorksheet("Dòng tiền theo năm");
      buildSheet(ws, branchName, `${fromYear} – ${toYear}`, data, "yearly");
    }

    const periodLabel = period === "monthly"   ? `Thang-${year}`
                      : period === "quarterly" ? `Quy-${year}`
                      : `Nam-${fromYear}-${toYear}`;
    const filename = `Dong-Tien-${periodLabel}-${branchName.replace(/\s+/g, "-")}.xlsx`;

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/finance/export-cashflow]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
