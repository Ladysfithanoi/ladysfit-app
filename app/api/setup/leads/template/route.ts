export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LEAD_SOURCES } from "@/lib/lead-sources";
import * as XLSX from "xlsx";

const ALLOWED = ["ADMIN", "FM", "COO", "PT"];

// Header order MUST stay in sync with the parser in leads-import-modal.tsx
const TEMPLATE_HEADERS = [
  "Khách hàng *",
  "Tháng *",
  "Năm *",
  "Nhân sự phụ trách",
  "Năm sinh",
  "Số điện thoại",
  "Phân nguồn",
  "Referral đến từ đâu",
  "Dự báo gói tập",
  "Tình trạng",
  "Gói tập đăng ký",
  "Doanh thu (triệu)",
  "Còn thiếu (triệu)",
  "DT Fitpartner (triệu)",
  "Ngày ký (dd/mm/yyyy)",
  "Quá trình chăm sóc",
  "Ghi chú",
] as const;

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !ALLOWED.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    const now = new Date();
    const month = parseInt(searchParams.get("month") ?? "") || now.getMonth() + 1;
    const year = parseInt(searchParams.get("year") ?? "") || now.getFullYear();

    // Pull the branch's staff names so the user knows exactly what to type in
    // the "Nhân sự phụ trách" column (must match an existing PT/FM/Admin).
    let staffNames: string[] = [];
    if (branchId) {
      const staff = await prisma.user.findMany({
        where: {
          deletedAt: null,
          role: { in: ["PT", "FM", "ADMIN"] },
          OR: [
            { branchId },
            { role: "FM", managedBranches: { some: { branchId } } },
          ],
        },
        select: { name: true, email: true },
        orderBy: { createdAt: "asc" },
      });
      staffNames = staff.map((s) => s.name ?? s.email);
    }

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: data with examples ─────────────────────────────────────────────
    const sample = staffNames[0] ?? "Tên PT";
    const ws = XLSX.utils.aoa_to_sheet([
      [...TEMPLATE_HEADERS],
      [
        "Nguyễn Thị A", month, year, sample, 1995, "0901234567",
        "Facebook Page", "", "Gói 3 tháng", "Đặt cọc", "L2",
        10.5, 2, "", "15/" + String(month).padStart(2, "0") + "/" + year,
        "15/6: gọi tư vấn, hẹn ra cơ sở", "Khách quen",
      ],
      [
        "Trần Văn B", month, year, sample, 1990, "0907654321",
        "Referral", "Hội viên Nguyễn Thị A giới thiệu", "Gói 6 tháng", "Đang chăm", "",
        "", "", "", "",
        "16/6: nhắn tin chưa phản hồi", "",
      ],
    ]);
    ws["!cols"] = [
      { wch: 18 }, { wch: 7 }, { wch: 7 }, { wch: 18 }, { wch: 9 }, { wch: 14 },
      { wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 12 },
      { wch: 13 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 30 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Setup");

    // ── Sheet 2: instructions / valid values ────────────────────────────────────
    const guide: (string | number)[][] = [
      ["HƯỚNG DẪN ĐIỀN BẢNG SETUP"],
      [""],
      ["• Mỗi dòng là 1 lead/khách hàng. Xóa 2 dòng ví dụ ở sheet \"Setup\" trước khi điền."],
      ["• Cột có dấu * là bắt buộc: Khách hàng, Tháng, Năm."],
      ["• Cột \"Tháng\" (1-12) và \"Năm\" quyết định lead được lọc theo Tháng / Quý / Năm trong bảng."],
      ["• \"Nhân sự phụ trách\": gõ đúng tên PT bên dưới. Để trống = gán cho người tải lên."],
      ["• \"Referral đến từ đâu\" chỉ cần khi Phân nguồn = Referral."],
      ["• Doanh thu / Còn thiếu / DT Fitpartner: nhập theo đơn vị TRIỆU (vd 10.5)."],
      ["• Ngày ký: định dạng dd/mm/yyyy (vd 15/06/2026)."],
      [""],
      ["TÌNH TRẠNG hợp lệ (gõ đúng 1 trong các giá trị):"],
      ["Đang chăm", "= đang chăm sóc"],
      ["Không đăng ký", "= fail"],
      ["Đặt cọc"],
      ["Đã thanh toán"],
      ["Thanh toán nốt"],
      [""],
      ["PHÂN NGUỒN gợi ý:"],
      ...LEAD_SOURCES.map((s) => [s]),
      [""],
      ["NHÂN SỰ trong cơ sở (gõ đúng tên):"],
      ...(staffNames.length ? staffNames.map((n) => [n]) : [["(chọn cơ sở để xem danh sách)"]]),
    ];
    const wsGuide = XLSX.utils.aoa_to_sheet(guide);
    wsGuide["!cols"] = [{ wch: 40 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, "Hướng dẫn");

    const arr = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;

    return new NextResponse(arr as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="setup-doanh-so-mau.xlsx"',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Lỗi server";
    console.error("Setup template error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
