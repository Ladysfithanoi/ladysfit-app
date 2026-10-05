import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canReadSalary } from "@/lib/salary-access";
import { prisma } from "@/lib/prisma";
import { formatDays, paidWorkDays, PAID_DAYS_BASE } from "@/lib/work-days";
import { loadLiveSalaryRecords } from "@/lib/salary-live";
import { buildSessionDetailRows, type SessionDetailRow } from "@/lib/salary-session-detail";
import ExcelJS from "exceljs";
import { vnWallClock } from "@/lib/format-date";

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
    const role = session.user.role;
    if (!canReadSalary(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { branchId, month, year } = await req.json() as { branchId: string; month: number; year: number };
    // COO đối soát toàn hệ thống nên không giới hạn cơ sở; FM chỉ cơ sở mình phụ trách.
    if (role === "FM") {
      const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
      if (!managedBranchIds.includes(branchId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // ── Fetch data ─────────────────────────────────────────────────────────

    // COO chọn "Tất cả cơ sở" thì branchId rỗng — xuất cả hệ thống thay vì
    // truy vấn một cơ sở tên rỗng rồi báo "không có dữ liệu".
    const allBranches = !branchId;
    const branch = allBranches ? null : await prisma.branch.findUnique({ where: { id: branchId } });
    const branchName = allBranches ? "Tất cả cơ sở" : branch?.name ?? branchId;

    // Cùng bộ lọc cơ sở và cùng đường tính lại với màn Quỹ lương (GET
    // /api/salary/records) — file phải ra đúng những con số đang hiện trên app.
    const branchIds = allBranches
      ? (await prisma.branch.findMany({
          where: { name: { not: { contains: "Fitpartner" } } },
          select: { id: true },
        })).map(b => b.id)
      : [branchId];
    const records = await loadLiveSalaryRecords(branchIds, month, year);

    if (records.length === 0) {
      return NextResponse.json({ error: "Không có dữ liệu bảng lương" }, { status: 404 });
    }

    // Người có dòng "Chi tiết" trên màn hình: PT, Admin dạy thêm và FM (FM cũng
    // dạy khách). STAFF không dạy nên không có.
    const teacherRecords = records.filter(r => r.user.role !== "STAFF");
    const sessionDetailsByRecord = new Map<string, SessionDetailRow[]>();
    await Promise.all(teacherRecords.map(async r => {
      sessionDetailsByRecord.set(r.id, await buildSessionDetailRows(r.userId, month, year));
    }));

    // ── Build workbook ─────────────────────────────────────────────────────

    const wb = new ExcelJS.Workbook();
    wb.creator = "Ladysfit";
    wb.created = new Date();

    const monthStr = String(month).padStart(2, "0");
    // Giờ VN — máy chủ chạy UTC, đọc giờ máy là sai ngày từ 0h tới 7h sáng.
    const now = vnWallClock(new Date());
    const todayStr = `${String(now.getUTCDate()).padStart(2,"0")}/${String(now.getUTCMonth()+1).padStart(2,"0")}/${now.getUTCFullYear()}`;

    const STATUS_VN: Record<string, string> = {
      PENDING: "Chờ xác nhận", CONFIRMED: "Đã xác nhận", PAID: "Đã thanh toán",
    };
    const ROLE_VN: Record<string, string> = {
      FM: "FM", PT: "PT", ADMIN: "Admin", STAFF: "Nhân sự",
    };

    // ═══════════════════════════════════════════════════════════════════════
    // Sheet 1: Tổng hợp lương
    // ═══════════════════════════════════════════════════════════════════════

    const ws1 = wb.addWorksheet("Tổng hợp lương");
    const S1_COLS = 18;

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
      "STT","Họ tên","Vị trí","Lương CB","Phụ cấp","Ngày công","Lương cộng thêm",
      "Doanh số","% HH","Tiền HH","Tiền buổi dạy","Thưởng",
      "Tổng lương","Trừ BH (10,5%)","Tạm ứng","Còn lại","Mức đóng BHXH","Trạng thái",
    ];
    const hdrRow1 = ws1.addRow(S1_HEADERS);
    applyHeaderStyle(hdrRow1);

    // Data rows
    let stt = 0;
    const totals = Array(S1_COLS).fill(0) as number[];

    for (const r of records) {
      stt++;
      const rec = r as typeof r & {
        kocCommission?: number; kolCommission?: number; bhxh?: number; insuranceDeduction?: number; showPay?: number;
        goalBonus?: number; googleBonus?: number; renewBonus?: number;
        standardWorkDays?: number; actualWorkDays?: number; leaveDays?: number;
      };
      const role = r.user.role;
      const kocC = Number(rec.kocCommission ?? 0);
      const kolC = Number(rec.kolCommission ?? 0);
      const thưởng =
        role === "FM"    ? (Number(rec.googleBonus ?? 0) + Number(rec.renewBonus ?? 0) + kocC + kolC)
        : role === "ADMIN" ? (kocC + kolC)
        :                    (Number(rec.goalBonus ?? 0) + kocC + kolC);

      // Admin dạy thêm không có lương cứng nên không áp ngày công.
      const stdDays   = Number(rec.standardWorkDays ?? 0);
      // Số ngày nghỉ = chuẩn − thực tế, như ô Ngày công trên màn hình (gồm cả phần
      // FM sửa tay, không riêng lịch nghỉ).
      const actDays   = Number(rec.actualWorkDays ?? 0);
      const offDays   = Math.max(0, stdDays - actDays);
      const workDaysText = role === "ADMIN" || stdDays <= 0
        ? "—"
        : `${formatDays(paidWorkDays(actDays, stdDays))}/${PAID_DAYS_BASE}${offDays > 0 ? ` (nghỉ ${formatDays(offDays)})` : ""}`;

      const rowData = [
        stt,
        r.user.name ?? r.user.email,
        ROLE_VN[role] ?? role,
        r.baseSalary,
        r.fixedAllowances,
        workDaysText,
        r.seniorityBonus,
        r.totalRevenue,
        r.commissionRate,
        r.commissionAmount,
        Number(rec.showPay ?? 0),
        thưởng,
        r.totalSalary,
        Number(rec.insuranceDeduction ?? 0),
        r.advancePaid,
        r.remainingPayment,
        Number(rec.bhxh ?? 0),
        STATUS_VN[r.status] ?? r.status,
      ];

      const dr = ws1.addRow(rowData);
      dr.height = 18;

      if (role === "FM") dr.fill = solidFill(BLUE_BG.argb);

      // Number formats
      [4,5,7,8,10,11,12,13,14,15,16,17].forEach((col: number) => {
        const cell = dr.getCell(col);
        cell.numFmt = VND_FMT;
      });
      dr.getCell(6).alignment = { horizontal: "center" };

      dr.eachCell(cell => {
        cell.border = { bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });

      // Accumulate totals (numeric cols, skip STT=1, name=2, role=3, ngày công=6, %HH=9, status=18).
      // Cột Doanh số (8) KHÔNG cộng dồn: dòng FM là doanh số cả phòng, đã bao gồm doanh
      // số của từng PT/Admin — cộng lại sẽ đếm trùng. Dòng tổng lấy doanh số phòng.
      [4,5,7,10,11,12,13,14,15,16,17].forEach(c => {
        if (typeof rowData[c - 1] === "number") totals[c - 1] += rowData[c - 1] as number;
      });
    }

    // Total row
    // Doanh số phòng giống ô "Doanh số phòng" trên màn hình: lấy từ dòng FM, gộp
    // theo cơ sở trước (cơ sở nhiều FM thì mỗi dòng cùng mang doanh số phòng).
    const branchRevenue = Array.from(
      records.filter(r => r.user.role === "FM")
        .reduce((m, r) => m.set(r.branchId, r.totalRevenue), new Map<string, number>()).values()
    ).reduce((s, v) => s + v, 0);
    const totRowData = Array(S1_COLS).fill("") as (string | number)[];
    totRowData[1] = "TỔNG CỘNG";
    [4,5,7,10,11,12,13,14,15,16,17].forEach(c => { totRowData[c - 1] = totals[c - 1]; });
    totRowData[7] = branchRevenue;

    const totRow = ws1.addRow(totRowData);
    totRow.height = 22;
    totRow.font = { bold: true };
    totRow.eachCell(cell => {
      cell.border = {
        top: { style: "double" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" },
      };
    });
    [4,5,7,8,10,11,12,13,14,15,16,17].forEach(c => { totRow.getCell(c).numFmt = VND_FMT; });

    // Note: giải thích cột Doanh số ở dòng tổng
    const noteRow = ws1.addRow([
      "* Doanh số ở dòng TỔNG CỘNG là doanh số cả phòng tập (bằng Tổng doanh thu bên Setup). "
      + "Dòng FM tính hoa hồng trên doanh số phòng, dòng PT/Admin tính trên doanh số cá nhân nên không cộng dồn. "
      + "Ngày công = số công được tính trên thang 26 (vd 27/26): lương 1 ngày = (lương CB + phụ cấp)/26, nghỉ ngày nào trừ ngày đó, tháng hơn 26 ngày làm việc (số ngày − Chủ nhật) được cộng thêm ngày dư. "
      + "Số trong ngoặc là ngày nghỉ thường theo lịch nghỉ; nghỉ phép năm vẫn hưởng đủ lương nên không trừ. "
      + "Trừ BH = phần người lao động đóng (BHXH 8% + BHYT 1,5% + BHTN 1% × mức đóng), từ tháng có Ngày nhận bảo hiểm; Còn lại = Tổng lương − Trừ BH − Tạm ứng.",
      ...Array(S1_COLS - 1).fill(""),
    ]);
    ws1.mergeCells(noteRow.number, 1, noteRow.number, S1_COLS);
    noteRow.height = 18;
    ws1.getCell(noteRow.number, 1).font = { italic: true, size: 9, color: { argb: "FF888888" } };

    // Column widths
    [5,28,8,16,14,11,14,18,7,16,18,16,18,14,14,14,14,14].forEach((w, i) => {
      ws1.getColumn(i + 1).width = w;
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Sheet 2: Chi tiết buổi dạy (all types merged)
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

    const S2_HEADERS = ["STT","Người dạy","Tên KH","Gói tập","Loại HĐ","Tổng buổi","Còn lại","Buổi dạy tháng","Giá/buổi","Tổng giá trị"];

    for (const r of teacherRecords) {
      const teacherName = r.user.name ?? r.user.email;
      // Section header per PT
      const secRow = ws2.addRow([`${teacherName} (${ROLE_VN[r.user.role] ?? r.user.role})`, ...Array(S2_COLS - 1).fill("")]);
      ws2.mergeCells(secRow.number, 1, secRow.number, S2_COLS);
      secRow.height = 22;
      const secCell = ws2.getCell(secRow.number, 1);
      secCell.font = { bold: true, size: 11, color: { argb: "FF1F497D" } };
      secCell.fill = solidFill(SECTION_BG.argb);
      secCell.alignment = { vertical: "middle", indent: 1 };

      // Column headers
      const s2Hdr = ws2.addRow(S2_HEADERS);
      applyHeaderStyle(s2Hdr);

      const sessionRows = sessionDetailsByRecord.get(r.id) ?? [];
      if (sessionRows.length === 0) {
        const emptyRow = ws2.addRow(["Không có gói tập đang hoạt động / buổi dạy trong tháng", ...Array(S2_COLS - 1).fill("")]);
        ws2.mergeCells(emptyRow.number, 1, emptyRow.number, S2_COLS);
        ws2.getCell(emptyRow.number, 1).font = { italic: true, color: { argb: "FF999999" } };
        ws2.getCell(emptyRow.number, 1).alignment = { horizontal: "center" };
      } else {
        let ptTotal = 0;
        sessionRows.forEach((s, idx) => {
          // KOC chưa chốt cân cuối thì chưa có giá — màn hình cũng để "Chờ kết quả".
          const kocPending = s.contractType === "KOC" && !s.koc?.endWeightConfirmed;
          const dr = ws2.addRow([
            idx + 1, teacherName,
            s.isSubstitute ? `${s.clientName} (dạy hộ)` : s.clientName,
            s.refunded ? `${s.packageName} (hoàn tiền)` : s.packageName,
            s.contractType, s.totalSessions, s.sessionsRemaining,
            s.sessionsAdjusted !== 0
              ? `${s.sessionsThisMonth} (app ${s.sessionsFromLogs}, chỉnh tay ${s.sessionsAdjusted > 0 ? "+" : ""}${s.sessionsAdjusted})`
              : s.sessionsThisMonth,
            kocPending ? "Chờ kết quả" : s.valuePerSession, s.totalValue,
          ]);
          dr.height = 17;
          if (!kocPending) dr.getCell(9).numFmt = VND_FMT;
          dr.getCell(10).numFmt = VND_FMT;
          dr.eachCell(cell => {
            cell.border = { bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
          });
          ptTotal += s.totalValue;
        });

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

    [5,22,25,14,10,10,10,15,16,16].forEach((w, i) => {
      ws2.getColumn(i + 1).width = w;
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
