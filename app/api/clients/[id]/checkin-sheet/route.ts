import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { fmtDate } from "@/lib/format-date";

/**
 * PHIẾU CHECK-IN BUỔI TẬP — bản Excel của tờ phụ lục hợp đồng đang ký tay.
 *
 * Dựng đúng bố cục tờ giấy: hai khối 25 dòng nằm cạnh nhau (1–25 và 26–50), phần
 * thông tin hội viên bên dưới, ba ô chữ ký cuối trang. Khác tờ giấy đúng một cột:
 * chỗ "Nhân viên lễ tân" thay bằng ẢNH CHECK-OUT của khách — thứ tờ giấy không
 * làm được, và cũng là bằng chứng buổi tập có thật thay cho chữ ký lễ tân.
 *
 * Mỗi dòng là một buổi ĐÃ CHECK-OUT: chỉ những buổi đó mới là buổi dạy có thật.
 */

/** Số dòng mỗi khối, và số khối — đúng tờ giấy: 2 khối × 25 dòng = 50 buổi. */
const ROWS_PER_BLOCK = 25;
const BLOCKS = 2;
const TOTAL_ROWS = ROWS_PER_BLOCK * BLOCKS;

const BRAND = "FFF15B5C";
const BORDER = { style: "thin" as const, color: { argb: "FFE0A0A0" } };
const ALL_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

/** "08:35" theo giờ VN. Chưa check-out thì để trống. */
function hhmm(d: Date | null): string {
  if (!d) return "";
  const vn = new Date(d.getTime() + 7 * 3600_000);
  return `${String(vn.getUTCHours()).padStart(2, "0")}:${String(vn.getUTCMinutes()).padStart(2, "0")}`;
}

/** Data URL ảnh → phần base64 và đuôi ảnh, để nhúng vào Excel. */
function parseDataUrl(raw: string | null): { base64: string; ext: "jpeg" | "png" } | null {
  if (!raw) return null;
  const m = /^data:image\/(jpeg|jpg|png);base64,(.+)$/i.exec(raw.trim());
  if (!m) return null;
  return { base64: m[2], ext: m[1].toLowerCase() === "png" ? "png" : "jpeg" };
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!["ADMIN", "FM", "COO", "PT"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollmentId = new URL(req.url).searchParams.get("enrollmentId");
  if (!enrollmentId) {
    return NextResponse.json({ error: "Thiếu lộ trình cần xuất phiếu" }, { status: 400 });
  }

  const enrollment = await prisma.packageEnrollment.findFirst({
    where: { id: enrollmentId, clientId: params.id },
    include: {
      client: { select: { fullName: true, assignedPT: { select: { name: true, email: true } } } },
    },
  });
  if (!enrollment) return NextResponse.json({ error: "Không tìm thấy lộ trình" }, { status: 404 });

  // Chỉ buổi ĐÃ CHECK-OUT mới lên phiếu — đó mới là buổi dạy có thật.
  const logs = await prisma.workoutLog.findMany({
    where: {
      clientId: params.id,
      packageEnrollmentId: enrollmentId,
      checkOutAt: { not: null },
    },
    orderBy: { sessionDate: "asc" },
    select: {
      sessionDate: true,
      checkOutAt: true,
      signatureUrl: true,
      checkOutPhotoUrl: true,
      createdBy: { select: { name: true, email: true } },
    },
    take: TOTAL_ROWS,
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Ladysfit";
  const ws = wb.addWorksheet("Phiếu check-in", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // ── Cột: hai khối giống hệt nhau đặt cạnh nhau ───────────────────────────
  // A..F là khối 1, G..L là khối 2. Cột ảnh rộng hơn để ảnh check-out đủ chỗ.
  const widths = [5, 16, 9, 14, 16, 18];
  ws.columns = [...widths, ...widths].map((w) => ({ width: w }));

  // ── Tiêu đề ──────────────────────────────────────────────────────────────
  ws.mergeCells("A1:L1");
  const t1 = ws.getCell("A1");
  t1.value = "PHỤ LỤC HỢP ĐỒNG SỐ 01";
  t1.font = { bold: true, size: 15 };
  t1.alignment = { horizontal: "center" };
  ws.getRow(1).height = 22;

  ws.mergeCells("A2:L2");
  const t2 = ws.getCell("A2");
  t2.value = `(Đính kèm Hợp đồng huấn luyện viên cá nhân số ${enrollment.contractCode ?? "................"})`;
  t2.font = { italic: true, size: 10 };
  t2.alignment = { horizontal: "center" };

  ws.mergeCells("A3:L3");
  const t3 = ws.getCell("A3");
  t3.value = "PHIẾU CHECK-IN BUỔI TẬP";
  t3.font = { bold: true, size: 13 };
  t3.alignment = { horizontal: "center" };
  ws.getRow(3).height = 20;

  // ── Hàng tiêu đề bảng ────────────────────────────────────────────────────
  const HEAD = [
    "STT",
    "Ngày cung cấp dịch vụ",
    "Thời gian",
    "Chữ ký PT",
    "Chữ ký khách hàng",
    "Ảnh check-out của khách hàng",
  ];
  const headRow = ws.addRow([...HEAD, ...HEAD]);
  headRow.height = 38;
  headRow.eachCell((cell) => {
    cell.font = { bold: true, size: 9, color: { argb: BRAND } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = ALL_BORDERS;
  });

  // ── 25 dòng, mỗi dòng chứa buổi thứ i (khối 1) và i+25 (khối 2) ──────────
  type Cellish = string | number;
  const rowsAdded: number[] = [];
  for (let i = 0; i < ROWS_PER_BLOCK; i++) {
    const left = logs[i];
    const right = logs[i + ROWS_PER_BLOCK];
    const cells: Cellish[] = [
      i + 1,
      left ? fmtDate(left.sessionDate) : "",
      left ? hhmm(left.checkOutAt) : "",
      left ? left.createdBy?.name ?? left.createdBy?.email ?? "" : "",
      // Chữ ký khách là ảnh vẽ tay; ô chỉ ghi đã ký hay chưa, ảnh nhúng bên dưới.
      "",
      "",
      i + 1 + ROWS_PER_BLOCK,
      right ? fmtDate(right.sessionDate) : "",
      right ? hhmm(right.checkOutAt) : "",
      right ? right.createdBy?.name ?? right.createdBy?.email ?? "" : "",
      "",
      "",
    ];
    const r = ws.addRow(cells);
    r.height = 46; // đủ cao để ảnh check-out nhìn được
    r.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = ALL_BORDERS;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.font = { size: 9 };
    });
    rowsAdded.push(r.number);
  }

  // ── Nhúng chữ ký khách và ảnh check-out ──────────────────────────────────
  // Ảnh nằm đè lên đúng ô của nó. Ảnh hỏng/thiếu thì bỏ qua, ô để trống —
  // một buổi thiếu ảnh không được làm hỏng cả phiếu.
  function place(raw: string | null, colIndex: number, rowIndex: number) {
    const img = parseDataUrl(raw);
    if (!img) return;
    try {
      const id = wb.addImage({ base64: img.base64, extension: img.ext });
      ws.addImage(id, {
        tl: { col: colIndex + 0.1, row: rowIndex - 1 + 0.1 },
        ext: { width: 74, height: 52 },
      });
    } catch {
      // Ảnh lỗi định dạng — bỏ qua, giữ ô trống.
    }
  }

  for (let i = 0; i < ROWS_PER_BLOCK; i++) {
    const rowIndex = rowsAdded[i];
    const left = logs[i];
    const right = logs[i + ROWS_PER_BLOCK];
    if (left) {
      place(left.signatureUrl, 4, rowIndex);      // cột E — chữ ký khách
      place(left.checkOutPhotoUrl, 5, rowIndex);  // cột F — ảnh check-out
    }
    if (right) {
      place(right.signatureUrl, 10, rowIndex);     // cột K
      place(right.checkOutPhotoUrl, 11, rowIndex); // cột L
    }
  }

  // ── Thông tin hội viên ───────────────────────────────────────────────────
  const contractRange =
    enrollment.startDate || enrollment.endDate
      ? `${enrollment.startDate ? fmtDate(enrollment.startDate) : "..."} — ${enrollment.endDate ? fmtDate(enrollment.endDate) : "..."}`
      : "";

  const info: [string, string][] = [
    ["1. HỌ TÊN HỘI VIÊN:", enrollment.client.fullName],
    ["2. TỔNG SỐ BUỔI TẬP:", `${enrollment.sessions} buổi`],
    ["3. THỜI HẠN HỢP ĐỒNG:", contractRange],
    ["4. GIÁ TRỊ GÓI TẬP:", enrollment.price > 0 ? `${enrollment.price.toLocaleString("vi-VN")} đ` : ""],
  ];

  ws.addRow([]);
  for (const [label, value] of info) {
    const r = ws.addRow([label]);
    ws.mergeCells(`A${r.number}:C${r.number}`);
    ws.mergeCells(`D${r.number}:L${r.number}`);
    r.getCell(1).font = { bold: true, size: 10 };
    r.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
    r.getCell(4).value = value;
    r.getCell(4).font = { size: 10 };
    r.getCell(4).alignment = { horizontal: "left", vertical: "middle" };
    r.getCell(4).border = { bottom: { style: "dotted", color: { argb: "FF999999" } } };
    r.height = 20;
  }

  // ── Ba ô chữ ký cuối trang ───────────────────────────────────────────────
  ws.addRow([]);
  const signHead = ws.addRow(["Chữ ký khách hàng", "", "", "", "Chữ ký HLV", "", "", "", "Đại diện trung tâm"]);
  ws.mergeCells(`A${signHead.number}:D${signHead.number}`);
  ws.mergeCells(`E${signHead.number}:H${signHead.number}`);
  ws.mergeCells(`I${signHead.number}:L${signHead.number}`);
  for (const c of [1, 5, 9]) {
    signHead.getCell(c).font = { bold: true, size: 10 };
    signHead.getCell(c).alignment = { horizontal: "center" };
  }

  const signNote = ws.addRow(["(Ký, ghi rõ họ tên)", "", "", "", "(Ký, ghi rõ họ tên)", "", "", "", "(Ký, ghi rõ họ tên)"]);
  ws.mergeCells(`A${signNote.number}:D${signNote.number}`);
  ws.mergeCells(`E${signNote.number}:H${signNote.number}`);
  ws.mergeCells(`I${signNote.number}:L${signNote.number}`);
  for (const c of [1, 5, 9]) {
    signNote.getCell(c).font = { italic: true, size: 9 };
    signNote.getCell(c).alignment = { horizontal: "center" };
  }

  // Chừa chỗ ký tay, rồi ghi sẵn tên HLV phụ trách như tờ giấy vẫn làm.
  const blank = ws.addRow([]);
  blank.height = 60;
  const ptName = enrollment.client.assignedPT?.name ?? enrollment.client.assignedPT?.email ?? "";
  const nameRow = ws.addRow(["", "", "", "", ptName, "", "", "", "Fitness Manager"]);
  ws.mergeCells(`E${nameRow.number}:H${nameRow.number}`);
  ws.mergeCells(`I${nameRow.number}:L${nameRow.number}`);
  nameRow.getCell(5).font = { bold: true, size: 10 };
  nameRow.getCell(5).alignment = { horizontal: "center" };
  nameRow.getCell(9).font = { bold: true, size: 10, color: { argb: BRAND } };
  nameRow.getCell(9).alignment = { horizontal: "center" };

  // Không cho ai đọc nhầm phiếu trống thành phiếu chưa tập buổi nào.
  if (logs.length === 0) {
    const note = ws.addRow([`Lộ trình này chưa có buổi nào đã check-out.`]);
    ws.mergeCells(`A${note.number}:L${note.number}`);
    note.getCell(1).font = { italic: true, size: 10, color: { argb: "FF999999" } };
  }

  const buf = await wb.xlsx.writeBuffer();
  // Bỏ dấu khỏi tên file — Windows và trình duyệt cũ đặt tên có dấu rất dễ hỏng.
  const safeName = enrollment.client.fullName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `Phieu-check-in-${safeName}-${enrollment.packageName}.xlsx`;

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
