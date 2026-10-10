import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import ExcelJS from "exceljs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadSalary } from "@/lib/salary-access";
import { loadPaidSalaryPeriod, periodMonths, type SalaryPeriodKind } from "@/lib/salary-period";

const VND_FMT = '#,##0"đ"';
const THIN = { style: "thin" } as const;
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };

/**
 * GET /api/salary/period?kind=quarter|year&year=&quarter=&branchId=[&format=xlsx]
 *
 * Thống kê lương đã thanh toán theo quý / năm (lib/salary-period). Cùng luật
 * cơ sở với màn Quỹ lương: COO bỏ trống cơ sở = toàn hệ thống, FM chỉ cơ sở
 * mình phụ trách.
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = session.user.role;
    if (!canReadSalary(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const kind: SalaryPeriodKind = searchParams.get("kind") === "year" ? "year" : "quarter";
    const year     = parseInt(searchParams.get("year") ?? "");
    const quarter  = parseInt(searchParams.get("quarter") ?? "1");
    const branchId = searchParams.get("branchId") || "";
    if (!Number.isFinite(year)) return NextResponse.json({ error: "Thiếu năm" }, { status: 400 });
    if (kind === "quarter" && !(quarter >= 1 && quarter <= 4)) {
      return NextResponse.json({ error: "Quý không hợp lệ" }, { status: 400 });
    }

    let branchIds: string[];
    if (role === "COO") {
      branchIds = branchId
        ? [branchId]
        : (await prisma.branch.findMany({
            where: { name: { not: { contains: "Fitpartner" } } },
            select: { id: true },
          })).map(b => b.id);
    } else {
      const managed: string[] = session.user.managedBranchIds ?? [];
      if (branchId && !managed.includes(branchId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      branchIds = branchId ? [branchId] : managed;
    }

    const months  = periodMonths(kind, quarter);
    const summary = await loadPaidSalaryPeriod(branchIds, year, months);

    if (searchParams.get("format") !== "xlsx") return NextResponse.json(summary);

    // ── File Excel: chỉ tổng lương đã thanh toán, không có chi tiết từng khoản ──
    const branchName = branchId
      ? (await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }))?.name ?? branchId
      : "Tất cả cơ sở";
    const periodLabel = kind === "year" ? `năm ${year}` : `quý ${quarter}/${year}`;
    const showBranch  = branchIds.length > 1;

    const wb = new ExcelJS.Workbook();
    wb.creator = "Ladysfit";
    wb.created = new Date();
    const ws = wb.addWorksheet(kind === "year" ? `Năm ${year}` : `Quý ${quarter}-${year}`);

    const headers = [
      "STT", "Nhân viên", "Chức vụ", ...(showBranch ? ["Cơ sở"] : []),
      ...months.map(m => `Tháng ${m}`), "Tổng đã thanh toán",
    ];
    const titleRow = ws.addRow([`LƯƠNG ĐÃ THANH TOÁN ${periodLabel.toUpperCase()} — ${branchName}`]);
    ws.mergeCells(titleRow.number, 1, titleRow.number, headers.length);
    titleRow.font = { bold: true, size: 14 };
    titleRow.alignment = { horizontal: "center" };
    const noteRow = ws.addRow(["Chỉ gồm các tháng lương đã chuyển trạng thái \"Đã thanh toán\"."]);
    ws.mergeCells(noteRow.number, 1, noteRow.number, headers.length);
    noteRow.font = { italic: true, color: { argb: "FF888888" } };
    ws.addRow([]);

    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF15B5C" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = BORDER;
    });

    const firstMoneyCol = (showBranch ? 5 : 4);
    summary.rows.forEach((r, i) => {
      const row = ws.addRow([
        i + 1, r.name, r.position, ...(showBranch ? [r.branchName] : []),
        ...months.map(m => r.byMonth[m] ?? null), r.total,
      ]);
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.border = BORDER;
        if (col >= firstMoneyCol) cell.numFmt = VND_FMT;
      });
      row.getCell(headers.length).font = { bold: true };
    });

    const totalRow = ws.addRow([
      "", "TỔNG", "", ...(showBranch ? [""] : []),
      ...months.map(m => summary.monthTotals[m] ?? 0), summary.grandTotal,
    ]);
    totalRow.font = { bold: true };
    totalRow.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
      cell.border = BORDER;
      if (col >= firstMoneyCol) cell.numFmt = VND_FMT;
    });

    [6, 26, 14, ...(showBranch ? [20] : []), ...months.map(() => 15), 20]
      .forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    const buffer = await wb.xlsx.writeBuffer();
    const filename = (kind === "year" ? `Luong-Nam-${year}` : `Luong-Quy-${quarter}-${year}`) +
      `-${branchName.replace(/\s+/g, "-")}.xlsx`;
    return new Response(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error: unknown) {
    const e = error as { message?: string; stack?: string };
    console.error("Salary period error:", e.message, e.stack);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
