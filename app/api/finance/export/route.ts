import { NextResponse }    from "next/server";
import { getServerSession } from "next-auth";
import { authOptions }      from "@/lib/auth";
import { prisma }           from "@/lib/prisma";
import ExcelJS              from "exceljs";
import sharp                from "sharp";

const C_RED   = "FFF15B5C";
const C_WHITE = "FFFFFFFF";
const C_GRAY  = "FFF9F9F9";
const C_TOTAL = "FFEFF6FF";
const C_BORD  = "FFD0D0D0";

type TxRow = {
  id:              string;
  category:        string;
  amount:          number;
  description:     string | null;
  transactionDate: Date;
  referenceId:     string | null;
  receiptImages:   string | null;
  invoiceImages:   string | null;
  createdBy:       { name: string | null };
};

function parseDesc(desc: string | null) {
  if (!desc) return { customer: "", pkg: "", pt: "", contract: "" };
  const parts    = desc.split(" | ");
  const customer = parts[0] ?? "";
  const ptPart   = parts.find(p => p.startsWith("PT:"));
  const hdPart   = parts.find(p => p.startsWith("HĐ:"));
  const pkg      = parts.find(p => p !== parts[0] && !p.startsWith("PT:") && !p.startsWith("HĐ:"));
  return {
    customer,
    pkg:      pkg ?? "",
    pt:       ptPart ? ptPart.slice(3).trim() : "",
    contract: hdPart ? hdPart.slice(3).trim() : "",
  };
}

function fmtDate(d: Date) {
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

function styleHeader(cell: ExcelJS.Cell) {
  cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C_RED   } };
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

// Decode any data URI → JPEG resized to max 500×600, returns base64 + actual px dimensions
async function processImage(
  dataUri: string,
): Promise<{ b64: string; w: number; h: number } | null> {
  const m = /^data:image\/[^;]+;base64,([\s\S]+)$/.exec(dataUri.trim());
  if (!m) return null;
  try {
    const raw = Buffer.from(m[1].replace(/[\s\r\n]/g, ""), "base64");
    const { data, info } = await sharp(raw)
      .resize(500, 600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
    return { b64: data.toString("base64"), w: info.width, h: info.height };
  } catch {
    return null;
  }
}

// Build "Chứng từ" sheet, return Map<txId → target row in sheet 2>
async function buildReceiptsSheet(
  wb:          ExcelJS.Workbook,
  ws:          ExcelJS.Worksheet,
  transactions: TxRow[],
  mm:          string,
  year:        number,
  branchName:  string,
): Promise<Map<string, number>> {
  const targetRows = new Map<string, number>();

  ws.getColumn(1).width = 72; // ≈ 504px — fits 500px images
  ws.getColumn(2).width = 12;

  let cur = 1;

  // ── Title ────────────────────────────────────────────────────────────────
  ws.mergeCells(cur, 1, cur, 5);
  const tc     = ws.getCell(cur, 1);
  tc.value     = `HÓA ĐƠN GIAO DỊCH — Tháng ${mm}/${year} — ${branchName}`;
  tc.font      = { bold: true, size: 13, color: { argb: C_WHITE } };
  tc.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C_RED } };
  tc.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(cur).height = 30;
  cur++;

  // ── Subtitle ──────────────────────────────────────────────────────────────
  const txsWithImgs = transactions.filter(tx => {
    const rImgs = tx.receiptImages ? (JSON.parse(tx.receiptImages) as string[]) : [];
    const iImgs = tx.invoiceImages ? (JSON.parse(tx.invoiceImages) as string[]) : [];
    return rImgs.length > 0 || iImgs.length > 0;
  });
  ws.mergeCells(cur, 1, cur, 5);
  const sc     = ws.getCell(cur, 1);
  sc.value     = `Tổng: ${txsWithImgs.length} giao dịch có hóa đơn`;
  sc.font      = { italic: true, size: 10, color: { argb: "FF666666" } };
  sc.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F8F8" } };
  sc.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(cur).height = 20;
  cur++;

  cur++; // spacer

  // ── Per-transaction sections ──────────────────────────────────────────────
  for (let tIdx = 0; tIdx < transactions.length; tIdx++) {
    const tx      = transactions[tIdx];
    const recImgs = tx.receiptImages ? (JSON.parse(tx.receiptImages) as string[]) : [];
    const invImgs = tx.invoiceImages ? (JSON.parse(tx.invoiceImages) as string[]) : [];
    if (recImgs.length === 0 && invImgs.length === 0) continue;

    targetRows.set(tx.id, cur);

    // Section header (red banner)
    ws.mergeCells(cur, 1, cur, 5);
    const hc        = ws.getCell(cur, 1);
    const shortDesc = (tx.description?.split(" | ")[0] ?? "").slice(0, 50);
    hc.value        = [
      `STT ${tIdx + 1}`,
      fmtDate(tx.transactionDate),
      tx.category,
      shortDesc,
      `${tx.amount.toLocaleString("vi-VN")}đ`,
    ].filter(Boolean).join("  |  ");
    hc.font        = { bold: true, size: 11, color: { argb: C_WHITE } };
    hc.fill        = { type: "pattern", pattern: "solid", fgColor: { argb: C_RED } };
    hc.alignment   = { vertical: "middle", wrapText: false };
    ws.getRow(cur).height = 24;
    cur++;

    const showSubHeaders = recImgs.length > 0 && invImgs.length > 0;

    // ── receipt images ────────────────────────────────────────────────────────
    if (recImgs.length > 0) {
      if (showSubHeaders) {
        ws.mergeCells(cur, 1, cur, 5);
        const sh     = ws.getCell(cur, 1);
        sh.value     = "📎 Chứng từ";
        sh.font      = { bold: true, size: 10, color: { argb: "FF444444" } };
        sh.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
        sh.alignment = { vertical: "middle" };
        ws.getRow(cur).height = 18;
        cur++;
      }
      for (let j = 0; j < recImgs.length; j++) {
        ws.mergeCells(cur, 1, cur, 5);
        const lc = ws.getCell(cur, 1);
        lc.value = `Ảnh ${j + 1} / ${recImgs.length}`;
        lc.font  = { bold: true, size: 10, color: { argb: "FF444444" } };
        lc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
        lc.alignment = { vertical: "middle" };
        ws.getRow(cur).height = 18;
        cur++;
        const rImg = await processImage(recImgs[j]);
        if (rImg) {
          const imgId      = wb.addImage({ base64: rImg.b64, extension: "jpeg" });
          const rowsNeeded = Math.ceil(rImg.h / 20) + 1;
          for (let r = 0; r < rowsNeeded; r++) ws.getRow(cur + r).height = 15;
          ws.addImage(imgId, { tl: { col: 0, row: cur - 1 }, ext: { width: rImg.w, height: rImg.h }, editAs: "oneCell" });
          cur += rowsNeeded;
        } else {
          const ec = ws.getCell(cur, 1);
          ec.value = "  [Không thể hiển thị ảnh]";
          ec.font  = { italic: true, color: { argb: "FFCC3300" }, size: 10 };
          ws.getRow(cur).height = 18;
          cur++;
        }
        cur += 2;
      }
    }

    // ── invoice images ────────────────────────────────────────────────────────
    if (invImgs.length > 0) {
      if (showSubHeaders) {
        ws.mergeCells(cur, 1, cur, 5);
        const sh     = ws.getCell(cur, 1);
        sh.value     = "🧾 Hóa đơn";
        sh.font      = { bold: true, size: 10, color: { argb: "FF444444" } };
        sh.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
        sh.alignment = { vertical: "middle" };
        ws.getRow(cur).height = 18;
        cur++;
      }
      for (let j = 0; j < invImgs.length; j++) {
        ws.mergeCells(cur, 1, cur, 5);
        const lc = ws.getCell(cur, 1);
        lc.value = `Ảnh ${j + 1} / ${invImgs.length}`;
        lc.font  = { bold: true, size: 10, color: { argb: "FF444444" } };
        lc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
        lc.alignment = { vertical: "middle" };
        ws.getRow(cur).height = 18;
        cur++;
        const iImg = await processImage(invImgs[j]);
        if (iImg) {
          const imgId      = wb.addImage({ base64: iImg.b64, extension: "jpeg" });
          const rowsNeeded = Math.ceil(iImg.h / 20) + 1;
          for (let r = 0; r < rowsNeeded; r++) ws.getRow(cur + r).height = 15;
          ws.addImage(imgId, { tl: { col: 0, row: cur - 1 }, ext: { width: iImg.w, height: iImg.h }, editAs: "oneCell" });
          cur += rowsNeeded;
        } else {
          const ec = ws.getCell(cur, 1);
          ec.value = "  [Không thể hiển thị ảnh]";
          ec.font  = { italic: true, color: { argb: "FFCC3300" }, size: 10 };
          ws.getRow(cur).height = 18;
          cur++;
        }
        cur += 2;
      }
    }

    cur += 3;
  }

  return targetRows;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (["FREE", "RESTRICTED", "PT"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let parsed: { type: "income" | "expense"; branchId: string; month: number; year: number };
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { type, branchId, month, year } = parsed;

  const managed: string[] = session.user.managedBranchIds ?? [];
  if (role === "FM" && !managed.includes(branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [branch, transactions] = await Promise.all([
      prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
      prisma.transaction.findMany({
        where: {
          branchId,
          type:            type === "income" ? "INCOME" : "EXPENSE",
          transactionDate: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) },
        },
        include: { createdBy: { select: { name: true } } },
        orderBy: { transactionDate: "asc" },
      }),
    ]);

    const branchName = branch?.name ?? branchId;
    const mm         = String(month).padStart(2, "0");
    const wb         = new ExcelJS.Workbook();
    wb.creator       = "Ladysfit";
    wb.modified      = new Date();

    const sheetLabel = type === "income" ? "Bảng Thu" : "Bảng Chi";
    const ws         = wb.addWorksheet(sheetLabel); // Sheet 1 — added first

    // Build Sheet 2 first to collect target rows for hyperlinks
    const hasAnyImages = transactions.some(tx => {
      const rImgs = tx.receiptImages ? (JSON.parse(tx.receiptImages) as string[]) : [];
      const iImgs = tx.invoiceImages ? (JSON.parse(tx.invoiceImages) as string[]) : [];
      return rImgs.length > 0 || iImgs.length > 0;
    });

    let targetRows = new Map<string, number>();
    if (hasAnyImages) {
      const ws2 = wb.addWorksheet("Hóa đơn"); // Sheet 2
      targetRows = await buildReceiptsSheet(wb, ws2, transactions, mm, year, branchName);
    }

    // ── Now build Sheet 1 ─────────────────────────────────────────────────
    const NCOLS = type === "income" ? 10 : 6;
    const HDR   = 3;

    ws.mergeCells(1, 1, 1, NCOLS);
    const info     = ws.getCell(1, 1);
    info.value     = `Cơ sở: ${branchName}   |   Tháng: ${mm}/${year}`;
    info.font      = { bold: true, size: 12 };
    info.alignment = { horizontal: "center", vertical: "middle" };
    info.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C_TOTAL } };
    ws.getRow(1).height = 28;
    ws.getRow(2).height = 6;

    if (type === "income") {
      const HEADERS = ["STT","Ngày GD","Danh mục","Khách hàng","Gói tập","PT phụ trách","Mã HĐ","Số tiền (VND)","Mô tả","Hóa đơn"];
      const WIDTHS  = [5, 13, 18, 24, 18, 18, 13, 18, 30, 18];

      HEADERS.forEach((h, i) => {
        const c = ws.getCell(HDR, i + 1);
        c.value = h;
        styleHeader(c);
        ws.getColumn(i + 1).width = WIDTHS[i];
      });
      ws.getRow(HDR).height = 30;

      const DATA_START       = HDR + 1;
      const RECEIPT_COL_1IDX = 10;

      for (let idx = 0; idx < transactions.length; idx++) {
        const tx     = transactions[idx];
        const row    = ws.getRow(DATA_START + idx);
        const even   = idx % 2 === 1;
        const p      = tx.referenceId ? parseDesc(tx.description) : null;
        const images = tx.invoiceImages ? (JSON.parse(tx.invoiceImages) as string[]) : [];

        const vals: ExcelJS.CellValue[] = [
          idx + 1,
          new Date(tx.transactionDate),
          tx.category,
          p ? p.customer : (tx.description ?? ""),
          p ? p.pkg      : "",
          p ? p.pt       : "",
          p ? p.contract : "",
          tx.amount,
          p ? "" : "",
          "", // invoice — set below
        ];
        vals.forEach((v, i) => { const c = row.getCell(i+1); c.value = v; styleData(c, even); });

        row.getCell(2).numFmt  = "dd/mm/yyyy";
        const amt              = row.getCell(8);
        amt.numFmt             = '#,##0"đ"';
        amt.font               = { bold: true, color: { argb: "FF059669" } };
        amt.alignment          = { horizontal: "right", vertical: "middle" };
        row.height             = 22;

        const rc = row.getCell(RECEIPT_COL_1IDX);
        if (images.length > 0 && targetRows.has(tx.id)) {
          rc.value = { text: `🧾 Xem ${images.length} ảnh`, hyperlink: `#'Hóa đơn'!A${targetRows.get(tx.id)!}` };
          rc.font  = { color: { argb: "FF0563C1" }, underline: true };
        } else {
          rc.value = images.length > 0 ? `${images.length} ảnh` : "—";
        }
        styleData(rc, even); // re-apply fill/border (font preserved)

        row.commit();
      }

      const TR   = DATA_START + transactions.length;
      const tRow = ws.getRow(TR);
      const tot  = transactions.reduce((s, tx) => s + tx.amount, 0);
      for (let c = 1; c <= 10; c++) styleTotal(tRow.getCell(c));
      tRow.getCell(1).value     = "TỔNG CỘNG";
      tRow.getCell(8).value     = tot;
      tRow.getCell(8).numFmt    = '#,##0"đ"';
      tRow.getCell(8).font      = { bold: true, color: { argb: "FF059669" }, size: 12 };
      tRow.getCell(8).alignment = { horizontal: "right", vertical: "middle" };
      tRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      tRow.height = 26;
      tRow.commit();

    } else {
      const HEADERS = ["STT","Ngày GD","Mô tả","Số tiền (VND)","Hóa đơn"];
      const WIDTHS  = [5, 13, 40, 18, 18];

      HEADERS.forEach((h, i) => {
        const c = ws.getCell(HDR, i + 1);
        c.value = h;
        styleHeader(c);
        ws.getColumn(i + 1).width = WIDTHS[i];
      });
      ws.getRow(HDR).height = 30;

      const DATA_START       = HDR + 1;
      const INVOICE_COL_1IDX = 5;

      for (let idx = 0; idx < transactions.length; idx++) {
        const tx      = transactions[idx];
        const row     = ws.getRow(DATA_START + idx);
        const even    = idx % 2 === 1;
        const invImgs = tx.invoiceImages ? (JSON.parse(tx.invoiceImages) as string[]) : [];

        const vals: ExcelJS.CellValue[] = [
          idx + 1,
          new Date(tx.transactionDate),
          tx.description ?? "",
          tx.amount,
          "", // invoice — set below
        ];
        vals.forEach((v, i) => { const c = row.getCell(i+1); c.value = v; styleData(c, even); });

        row.getCell(2).numFmt  = "dd/mm/yyyy";
        const amt              = row.getCell(4);
        amt.numFmt             = '#,##0"đ"';
        amt.font               = { bold: true, color: { argb: "FFDC2626" } };
        amt.alignment          = { horizontal: "right", vertical: "middle" };
        row.height             = 22;

        const ic = row.getCell(INVOICE_COL_1IDX);
        if (invImgs.length > 0 && targetRows.has(tx.id)) {
          ic.value = { text: `🧾 Xem ${invImgs.length} ảnh`, hyperlink: `#'Hóa đơn'!A${targetRows.get(tx.id)!}` };
          ic.font  = { color: { argb: "FF0563C1" }, underline: true };
        } else {
          ic.value = invImgs.length > 0 ? `${invImgs.length} ảnh` : "—";
        }
        styleData(ic, even);

        row.commit();
      }

      const TR   = DATA_START + transactions.length;
      const tRow = ws.getRow(TR);
      const tot  = transactions.reduce((s, tx) => s + tx.amount, 0);
      for (let c = 1; c <= 5; c++) styleTotal(tRow.getCell(c));
      tRow.getCell(1).value     = "TỔNG CỘNG";
      tRow.getCell(4).value     = tot;
      tRow.getCell(4).numFmt    = '#,##0"đ"';
      tRow.getCell(4).font      = { bold: true, color: { argb: "FFDC2626" }, size: 12 };
      tRow.getCell(4).alignment = { horizontal: "right", vertical: "middle" };
      tRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      tRow.height = 26;
      tRow.commit();
    }

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const prefix   = type === "income" ? "Bang-Thu" : "Bang-Chi";
    const filename = `${prefix}-Thang-${mm}-${year}-${branchName.replace(/\s+/g, "-")}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack   = err instanceof Error ? err.stack   : undefined;
    console.error("[/api/finance/export] Export failed:", err);
    return NextResponse.json({ error: message, stack }, { status: 500 });
  }
}
