import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

// ── KOC helpers (same logic as session-detail) ────────────────────────────

function calcKOCRate(startW: number, endW: number | null): number {
  if (endW == null) return 0;
  const lost = startW - endW;
  if (startW < 70) return 0;
  if (lost >= 8 && lost <= 9.9) return 35_000;
  if (lost >= 5 && lost <= 7.9) return 25_000;
  if (lost >= 3 && lost <= 4.9) return 20_000;
  return 0;
}

function calcKOCTotal(startW: number, endW: number | null, sessions: number): number {
  if (endW == null) return 0;
  return Math.min(sessions, 60) * calcKOCRate(startW, endW);
}

// ── Style helpers ─────────────────────────────────────────────────────────

const RED   = { argb: "FFF15B5C" };
const WHITE = { argb: "FFFFFFFF" };
const GRAY  = { argb: "FFF5F5F5" };
const BLUE_BG = { argb: "FFE8F4FD" };
const SECTION_BG = { argb: "FFD9E1F2" };
const VND_FMT = '#,##0"đ"';

function solidFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function applyHeaderStyle(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = solidFill(GRAY.argb);
  row.height = 20;
  row.eachCell(cell => {
    cell.border = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
}

// ── POST /api/salary/export ───────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "FM") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { branchId, month, year } = await req.json() as { branchId: string; month: number; year: number };
    const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
    if (!managedBranchIds.includes(branchId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Fetch data ─────────────────────────────────────────────────────────

    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    const branchName = branch?.name ?? branchId;

    const records = await prisma.salaryRecord.findMany({
      where: { branchId, month, year },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: [{ user: { role: "asc" } }, { user: { name: "asc" } }],
    });

    if (records.length === 0) {
      return NextResponse.json({ error: "Không có dữ liệu bảng lương" }, { status: 404 });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 1);
    const ptAdminRecords = records.filter(r => r.user.role !== "FM");
    const ptUserIds = ptAdminRecords.map(r => r.userId);

    // Session details per PT
    type EnrollmentRow = {
      id: string; clientId: string; contractCode: string | null;
      packageName: string; sessions: number; sessionsUsed: number;
      contractType: string; fullName: string;
    };
    type SessionRow = {
      stt: number; contractCode: string | null; clientName: string;
      packageName: string; contractType: string;
      totalSessions: number; sessionsRemaining: number;
      sessionsThisMonth: number; valuePerSession: number; totalValue: number;
    };

    const sessionDetailsByUser = new Map<string, SessionRow[]>();

    await Promise.all(ptAdminRecords.map(async r => {
      const enrollments = await prisma.$queryRawUnsafe<EnrollmentRow[]>(
        `SELECT pe.id, pe."clientId", pe."contractCode", pe."packageName",
                pe.sessions, pe."sessionsUsed", pe."contractType"::text AS "contractType",
                c."fullName"
         FROM package_enrollments pe
         JOIN clients c ON c.id = pe."clientId"
         WHERE pe.status = 'ACTIVE' AND c."assignedPTId" = $1
         ORDER BY c."fullName" ASC, pe."createdAt" ASC`,
        r.userId
      );

      const logs = await prisma.workoutLog.findMany({
        where: { clientId: { in: enrollments.map(e => e.clientId) }, sessionDate: { gte: startDate, lt: endDate } },
        select: { clientId: true },
      });

      const logCount = new Map<string, number>();
      for (const l of logs) logCount.set(l.clientId, (logCount.get(l.clientId) ?? 0) + 1);

      const rows: SessionRow[] = enrollments.map((e, idx) => {
        const contractType = e.contractType as "NORMAL" | "KOC" | "KOL";
        const sessionsThisMonth = logCount.get(e.clientId) ?? 0;
        const valuePerSession =
          contractType === "KOC" ? 0
          : contractType === "KOL" ? 60_000
          : ["L1", "L2", "Loyalfit"].includes(e.packageName) ? 60_000
          : 100_000;
        return {
          stt: idx + 1,
          contractCode: e.contractCode,
          clientName: e.fullName,
          packageName: e.packageName,
          contractType,
          totalSessions: Number(e.sessions),
          sessionsRemaining: Number(e.sessions) - Number(e.sessionsUsed),
          sessionsThisMonth,
          valuePerSession,
          totalValue: contractType !== "KOC" ? sessionsThisMonth * valuePerSession : 0,
        };
      });

      sessionDetailsByUser.set(r.userId, rows);
    }));

    // KOC contracts for branch PTs
    type KOCRow = {
      enrollmentId: string; startWeight: number; endWeight: number | null;
      startWeightConfirmed: boolean; endWeightConfirmed: boolean;
      status: string; totalSessions: number;
      clientName: string; ptName: string;
    };
    const kocContracts: KOCRow[] = ptUserIds.length > 0
      ? await prisma.$queryRawUnsafe<KOCRow[]>(
          `SELECT k."enrollmentId", k."startWeight", k."endWeight",
                  k."startWeightConfirmed", k."endWeightConfirmed", k.status, k."totalSessions",
                  c."fullName" AS "clientName",
                  u.name       AS "ptName"
           FROM koc_contracts k
           JOIN clients c ON c.id = k."clientId"
           JOIN users u   ON u.id = k."ptId"
           WHERE k."ptId" = ANY($1::text[])
           ORDER BY u.name ASC, c."fullName" ASC`,
          ptUserIds
        )
      : [];

    // ── Build workbook ─────────────────────────────────────────────────────

    const wb = new ExcelJS.Workbook();
    wb.creator = "Ladysfit";
    wb.created = new Date();

    const monthStr = String(month).padStart(2, "0");
    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()}`;

    const STATUS_VN: Record<string, string> = {
      PENDING: "Chờ xác nhận", CONFIRMED: "Đã xác nhận", PAID: "Đã thanh toán",
    };
    const ROLE_VN: Record<string, string> = {
      FM: "FM", FREE: "PT", RESTRICTED: "PT", ADMIN: "Admin",
    };

    // ═══════════════════════════════════════════════════════════════════════
    // Sheet 1: Tổng hợp lương
    // ═══════════════════════════════════════════════════════════════════════

    const ws1 = wb.addWorksheet("Tổng hợp lương");
    const S1_COLS = 16;

    // Title row
    const titleRow = ws1.addRow([`BẢNG LƯƠNG THÁNG ${monthStr}/${year}`, ...Array(S1_COLS - 1).fill("")]);
    ws1.mergeCells(titleRow.number, 1, titleRow.number, S1_COLS);
    titleRow.height = 32;
    const titleCell = ws1.getCell(titleRow.number, 1);
    titleCell.font = { bold: true, size: 14, color: WHITE };
    titleCell.fill = solidFill(RED.argb);
    titleCell.alignment = { horizontal: "center", vertical: "middle" };

    // Branch row
    const branchRow = ws1.addRow([`Cơ sở: ${branchName}`, ...Array(S1_COLS - 1).fill("")]);
    ws1.mergeCells(branchRow.number, 1, branchRow.number, S1_COLS);
    branchRow.height = 20;
    const branchCell = ws1.getCell(branchRow.number, 1);
    branchCell.font = { bold: true, size: 11 };
    branchCell.alignment = { horizontal: "center", vertical: "middle" };

    // Date row
    const dateRow = ws1.addRow([`Ngày xuất: ${todayStr}`, ...Array(S1_COLS - 1).fill("")]);
    ws1.mergeCells(dateRow.number, 1, dateRow.number, S1_COLS);
    dateRow.height = 18;
    ws1.getCell(dateRow.number, 1).alignment = { horizontal: "center" };

    ws1.addRow([]); // spacer

    // Header row
    const S1_HEADERS = [
      "STT","Họ tên","Vị trí","Lương CB","Phụ cấp","Thâm niên",
      "Doanh số","% HH","Tiền HH","Tiền buổi dạy","Thưởng",
      "Tổng lương","Tạm ứng","Còn lại","BHXH","Trạng thái",
    ];
    const hdrRow1 = ws1.addRow(S1_HEADERS);
    applyHeaderStyle(hdrRow1);

    // Data rows
    let stt = 0;
    const totals = Array(S1_COLS).fill(0) as number[];

    for (const r of records) {
      stt++;
      const rec = r as typeof r & { kocCommission?: number; kolCommission?: number; bhxh?: number; showPay?: number; goalBonus?: number; googleBonus?: number; renewBonus?: number };
      const role = r.user.role;
      const kocC = Number(rec.kocCommission ?? 0);
      const kolC = Number(rec.kolCommission ?? 0);
      const thưởng =
        role === "FM"    ? (Number(rec.googleBonus ?? 0) + Number(rec.renewBonus ?? 0))
        : role === "ADMIN" ? (kocC + kolC)
        :                    (Number(rec.goalBonus ?? 0) + kocC + kolC);

      const rowData = [
        stt,
        r.user.name ?? r.user.email,
        ROLE_VN[role] ?? role,
        r.baseSalary,
        r.fixedAllowances,
        r.seniorityBonus,
        r.totalRevenue,
        r.commissionRate,
        r.commissionAmount,
        Number(rec.showPay ?? 0),
        thưởng,
        r.totalSalary,
        r.advancePaid,
        r.remainingPayment,
        Number(rec.bhxh ?? 0),
        STATUS_VN[r.status] ?? r.status,
      ];

      const dr = ws1.addRow(rowData);
      dr.height = 18;

      if (role === "FM") dr.fill = solidFill(BLUE_BG.argb);

      // Number formats
      ([4,5,6,7,9,10,11,12,13,14,15] as const).forEach(col => {
        const cell = dr.getCell(col);
        cell.numFmt = col === 8 ? '0.00"%"' : VND_FMT;
      });

      dr.eachCell(cell => {
        cell.border = { bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });

      // Accumulate totals (numeric cols, skip STT=1, name=2, role=3, %HH=8, status=16)
      [4,5,6,7,9,10,11,12,13,14,15].forEach(c => {
        if (typeof rowData[c - 1] === "number") totals[c - 1] += rowData[c - 1] as number;
      });
    }

    // Total row
    const totRowData = Array(S1_COLS).fill("") as (string | number)[];
    totRowData[1] = "TỔNG CỘNG";
    [4,5,6,7,9,10,11,12,13,14,15].forEach(c => { totRowData[c - 1] = totals[c - 1]; });

    const totRow = ws1.addRow(totRowData);
    totRow.height = 22;
    totRow.font = { bold: true };
    totRow.eachCell(cell => {
      cell.border = {
        top: { style: "double" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" },
      };
    });
    [4,5,6,7,9,10,11,12,13,14,15].forEach(c => { totRow.getCell(c).numFmt = VND_FMT; });

    // Column widths
    [5,28,8,16,14,14,18,7,16,18,16,18,14,14,14,14].forEach((w, i) => {
      ws1.getColumn(i + 1).width = w;
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Sheet 2: Chi tiết buổi dạy
    // ═══════════════════════════════════════════════════════════════════════

    const ws2 = wb.addWorksheet("Chi tiết buổi dạy");
    const S2_COLS = 10;

    const s2Title = ws2.addRow([`CHI TIẾT BUỔI DẠY — THÁNG ${monthStr}/${year}`, ...Array(S2_COLS - 1).fill("")]);
    ws2.mergeCells(s2Title.number, 1, s2Title.number, S2_COLS);
    s2Title.height = 28;
    const s2TitleCell = ws2.getCell(s2Title.number, 1);
    s2TitleCell.font = { bold: true, size: 13, color: WHITE };
    s2TitleCell.fill = solidFill(RED.argb);
    s2TitleCell.alignment = { horizontal: "center", vertical: "middle" };

    const S2_HEADERS = ["STT","Mã HĐ","Tên KH","Gói tập","Loại HĐ","Tổng buổi","Còn lại","Buổi tháng","Giá/buổi","Tổng giá trị"];

    for (const r of ptAdminRecords) {
      // Section header
      const secRow = ws2.addRow([`${r.user.name ?? r.user.email} — Tháng ${monthStr}/${year}`, ...Array(S2_COLS - 1).fill("")]);
      ws2.mergeCells(secRow.number, 1, secRow.number, S2_COLS);
      secRow.height = 22;
      const secCell = ws2.getCell(secRow.number, 1);
      secCell.font = { bold: true, size: 11, color: { argb: "FF1F497D" } };
      secCell.fill = solidFill(SECTION_BG.argb);
      secCell.alignment = { vertical: "middle", indent: 1 };

      // Column headers
      const s2Hdr = ws2.addRow(S2_HEADERS);
      applyHeaderStyle(s2Hdr);

      const sessionRows = sessionDetailsByUser.get(r.userId) ?? [];
      if (sessionRows.length === 0) {
        const emptyRow = ws2.addRow(["Không có gói tập đang hoạt động", ...Array(S2_COLS - 1).fill("")]);
        ws2.mergeCells(emptyRow.number, 1, emptyRow.number, S2_COLS);
        ws2.getCell(emptyRow.number, 1).font = { italic: true, color: { argb: "FF999999" } };
        ws2.getCell(emptyRow.number, 1).alignment = { horizontal: "center" };
      } else {
        let ptTotal = 0;
        for (const s of sessionRows) {
          const dr = ws2.addRow([
            s.stt, s.contractCode ?? "", s.clientName, s.packageName,
            s.contractType, s.totalSessions, s.sessionsRemaining,
            s.sessionsThisMonth, s.valuePerSession, s.totalValue,
          ]);
          dr.height = 17;
          dr.getCell(9).numFmt = VND_FMT;
          dr.getCell(10).numFmt = VND_FMT;
          dr.eachCell(cell => {
            cell.border = { bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
          });
          ptTotal += s.totalValue;
        }

        // Sub-total row
        const subRow = ws2.addRow([...Array(8).fill(""), "", ptTotal]);
        ws2.mergeCells(subRow.number, 1, subRow.number, 8);
        ws2.getCell(subRow.number, 1).value = "Tổng tiền buổi dạy:";
        ws2.getCell(subRow.number, 1).font = { bold: true };
        ws2.getCell(subRow.number, 1).alignment = { horizontal: "right" };
        ws2.getCell(subRow.number, 10).numFmt = VND_FMT;
        ws2.getCell(subRow.number, 10).font = { bold: true };
        subRow.eachCell(cell => {
          cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        });
      }

      ws2.addRow([]); // spacer between PTs
    }

    [5,16,25,14,10,10,10,12,14,16].forEach((w, i) => {
      ws2.getColumn(i + 1).width = w;
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Sheet 3: KOC
    // ═══════════════════════════════════════════════════════════════════════

    const ws3 = wb.addWorksheet("KOC");
    const S3_COLS = 9;

    const s3Title = ws3.addRow([`HỢP ĐỒNG KOC — THÁNG ${monthStr}/${year}`, ...Array(S3_COLS - 1).fill("")]);
    ws3.mergeCells(s3Title.number, 1, s3Title.number, S3_COLS);
    s3Title.height = 28;
    const s3TitleCell = ws3.getCell(s3Title.number, 1);
    s3TitleCell.font = { bold: true, size: 13, color: WHITE };
    s3TitleCell.fill = solidFill(RED.argb);
    s3TitleCell.alignment = { horizontal: "center", vertical: "middle" };

    const S3_HEADERS = ["STT","Tên PT","Tên KH","Cân đầu (kg)","Cân cuối (kg)","Kg giảm","Số buổi","HH/buổi","Tổng HH"];
    const s3Hdr = ws3.addRow(S3_HEADERS);
    applyHeaderStyle(s3Hdr);

    if (kocContracts.length === 0) {
      const emptyRow = ws3.addRow(["Không có hợp đồng KOC", ...Array(S3_COLS - 1).fill("")]);
      ws3.mergeCells(emptyRow.number, 1, emptyRow.number, S3_COLS);
      ws3.getCell(emptyRow.number, 1).font = { italic: true, color: { argb: "FF999999" } };
      ws3.getCell(emptyRow.number, 1).alignment = { horizontal: "center" };
    } else {
      kocContracts.forEach((k, idx) => {
        const sw = Number(k.startWeight);
        const ew = k.endWeight != null ? Number(k.endWeight) : null;
        const lost = ew != null ? sw - ew : null;
        const rate = k.endWeightConfirmed ? calcKOCRate(sw, ew) : 0;
        const total = k.endWeightConfirmed ? calcKOCTotal(sw, ew, Number(k.totalSessions)) : 0;

        const kr = ws3.addRow([
          idx + 1,
          k.ptName,
          k.clientName,
          sw,
          ew ?? "Chưa có",
          lost != null ? lost : "—",
          Number(k.totalSessions),
          rate > 0 ? rate : "—",
          total,
        ]);
        kr.height = 17;
        kr.getCell(4).numFmt = "0.0";
        if (ew != null) kr.getCell(5).numFmt = "0.0";
        if (lost != null) kr.getCell(6).numFmt = "0.0";
        if (rate > 0) kr.getCell(8).numFmt = VND_FMT;
        kr.getCell(9).numFmt = VND_FMT;
        kr.eachCell(cell => {
          cell.border = { bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        });
      });
    }

    [5,20,25,14,14,10,10,14,16].forEach((w, i) => {
      ws3.getColumn(i + 1).width = w;
    });

    // ── Return file ────────────────────────────────────────────────────────

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `Bang-Luong-Thang-${monthStr}-${year}-${branchName.replace(/\s+/g, "-")}.xlsx`;

    return new Response(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error: unknown) {
    const e = error as { message?: string; stack?: string };
    console.error("Export error:", e.message, e.stack);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
