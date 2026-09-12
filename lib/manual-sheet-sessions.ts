import { prisma } from "@/lib/prisma";
import { parseOverride } from "@/lib/checkin-sheet";

// ── Buổi ghi tay trên phiếu, đọc dưới góc nhìn "buổi dạy" ───────────────────
//
// Dòng ghi tay là ĐƯỜNG DUY NHẤT để thêm một buổi bằng tay (xem SheetExtraRow ở
// lib/checkin-sheet), nên nó phải chảy vào cả hai nơi: phiếu check-in của khách
// và "Số buổi PT" của bảng lương. Module này lo vế thứ hai.
//
// Vì sao phải đọc JSON thay vì một bảng riêng: phần sửa tay của phiếu sống trong
// ba cột JSON của checkin_sheet_overrides — một LỚP PHỦ đặt lên trên workout_logs,
// cố ý không có bảng buổi tập thứ hai để không đẻ ra một nguồn sự thật song song.
// Số lượng nhỏ (mỗi lộ trình một bản ghi, mỗi bản vài chục dòng) nên đọc và lọc ở
// JS là đủ.
//
// CHỈ dòng có `ptId` mới được tính công. Dòng để trống người dạy vẫn in lên phiếu
// bình thường — buổi cũ nhiều khi không còn ai nhớ ai dạy, mà trả tiền cho một cái
// tên đoán ra thì tệ hơn là không trả.

export type ManualSessionRow = {
  ptId:         string;
  clientId:     string;
  enrollmentId: string;
  packageName:  string;
  contractType: "NORMAL" | "KOC" | "KOL";
  /** Mốc ISO của buổi — dùng để xếp vào đúng tháng lương. */
  date:         string;
};

type Filter = {
  /** Lọc theo người được tính công. Bỏ trống = mọi HLV. */
  ptIds?:    string[];
  /** Lọc theo khách. Bỏ trống = mọi khách. */
  clientId?: string;
  /** Cửa sổ thời gian [gte, lt). Bỏ trống = cả đời. */
  gte?:      Date;
  lt?:       Date;
};

/**
 * Buổi ghi tay đọc thành "buổi dạy", cùng hình dạng với buổi app ghi.
 *
 * Trả về MỘT PHẦN TỬ cho mỗi buổi, để chỗ gọi chỉ việc nối vào danh sách buổi
 * app ghi rồi đếm — không cần biết buổi đến từ đâu.
 */
export async function getManualSheetSessions(filter: Filter = {}): Promise<ManualSessionRow[]> {
  const { ptIds, clientId, gte, lt } = filter;
  if (ptIds && ptIds.length === 0) return [];

  const overrides = await prisma.checkinSheetOverride.findMany({
    where: {
      extraRows: { not: null },
      ...(clientId ? { enrollment: { clientId } } : {}),
    },
    select: {
      header: true,
      rows: true,
      extraRows: true,
      enrollment: {
        select: {
          id: true,
          clientId: true,
          packageName: true,
          contractType: true,
        },
      },
    },
  });

  const wanted = ptIds ? new Set(ptIds) : null;
  const from = gte?.getTime();
  const to = lt?.getTime();
  const out: ManualSessionRow[] = [];

  for (const o of overrides) {
    const enrollment = o.enrollment;
    if (!enrollment) continue;
    // Đi qua đúng bộ luật làm sạch của phiếu, nên bản ghi hỏng bị bỏ y như khi in.
    const parsed = parseOverride({ header: o.header, rows: o.rows, extraRows: o.extraRows });
    for (const row of parsed.extraRows) {
      const ptId = row.ptId ?? "";
      if (ptId === "") continue;
      if (wanted && !wanted.has(ptId)) continue;
      const at = new Date(row.date).getTime();
      if (Number.isNaN(at)) continue;
      if (from !== undefined && at < from) continue;
      if (to !== undefined && at >= to) continue;
      out.push({
        ptId,
        clientId:     enrollment.clientId,
        enrollmentId: enrollment.id,
        packageName:  enrollment.packageName,
        contractType: enrollment.contractType as "NORMAL" | "KOC" | "KOL",
        date:         row.date,
      });
    }
  }

  return out;
}
