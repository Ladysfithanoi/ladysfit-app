// Xuất "Thống kê năm" (Setup doanh số) ra file Excel. Mỗi cơ sở được chọn nằm ở
// MỘT sheet riêng biệt trong cùng một workbook. Dùng SheetJS (đã có sẵn trong
// dependencies) và import động để không làm nặng bundle khi chưa bấm tải.

import type { StatsData } from "@/components/dashboard/setup/monthly-stats-tab";

export type BranchYearStats = { branchName: string; data: StatsData };

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Tên sheet Excel: tối đa 31 ký tự, không chứa : \ / ? * [ ]. Khử trùng để 2 cơ
// sở trùng tên (sau khi cắt) không ghi đè nhau.
function sanitizeSheetName(name: string, used: Set<string>): string {
  let base = (name || "Cơ sở").replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Cơ sở";
  let candidate = base;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${i})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
    i++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

type Row = (string | number)[];

function buildSheetRows(year: number, branchName: string, data: StatsData): Row[] {
  const { bySource, bySourceAll, byAge, byWeight, byPT, totalLeads, totalContracts, totalRevenue } = data;
  const overallConversionPct = totalLeads > 0 ? round1((totalContracts / totalLeads) * 100) : 0;

  const rows: Row[] = [];
  rows.push([`Thống kê năm ${year} — ${branchName}`]);
  rows.push([]);
  rows.push(["Tổng lead", totalLeads]);
  rows.push(["Đã chốt HĐ", totalContracts]);
  rows.push(["Tỉ lệ chốt", `${overallConversionPct}%`]);
  rows.push(["Tổng doanh thu (triệu)", round1(totalRevenue)]);
  rows.push([]);

  // Phân tích nguồn lead (toàn bộ lead + tỉ lệ chốt)
  rows.push(["PHÂN TÍCH NGUỒN LEAD"]);
  rows.push(["Nguồn", "Số lead", "% lead", "Đã chốt", "Tỉ lệ chốt"]);
  for (const r of bySourceAll) {
    rows.push([r.source, r.leads, `${r.leadPct}%`, r.contracts, `${r.conversionPct}%`]);
  }
  rows.push(["Tổng", totalLeads, "100%", totalContracts, `${overallConversionPct}%`]);
  rows.push([]);

  // Phân tích nguồn lead theo doanh thu (chỉ HĐ đã chốt)
  rows.push(["PHÂN TÍCH NGUỒN LEAD THEO DOANH THU"]);
  rows.push(["Nguồn", "Số hợp đồng", "Doanh thu (triệu)", "% số HĐ", "% doanh thu"]);
  for (const r of bySource) {
    rows.push([r.source, r.contracts, round1(r.revenue), `${r.contractPct}%`, `${r.revenuePct}%`]);
  }
  rows.push(["Tổng", totalContracts, round1(totalRevenue), "100%", "100%"]);
  rows.push([]);

  // Chuẩn tệp — độ tuổi
  rows.push(["PHÂN TÍCH CHUẨN TỆP — ĐỘ TUỔI"]);
  rows.push(["Độ tuổi", "Số lead", "% lead", "Đã chốt", "Tỉ lệ chốt"]);
  for (const r of byAge) {
    rows.push([r.bucket, r.leads, `${r.leadPct}%`, r.contracts, `${r.conversionPct}%`]);
  }
  rows.push([]);

  // Chuẩn tệp — cân nặng
  rows.push(["PHÂN TÍCH CHUẨN TỆP — CHÊNH LỆCH CÂN NẶNG"]);
  rows.push(["Chênh lệch cân nặng", "Số lead", "% lead", "Đã chốt", "Tỉ lệ chốt"]);
  for (const r of byWeight) {
    rows.push([r.bucket, r.leads, `${r.leadPct}%`, r.contracts, `${r.conversionPct}%`]);
  }
  rows.push([]);

  // Theo PT
  rows.push(["PHÂN TÍCH THEO PT"]);
  rows.push(["PT", "Số HĐ", "Doanh thu (triệu)", "% tổng DS", "Nguồn chính"]);
  for (const r of byPT) {
    const label = r.ptName + (r.ptRole === "FM" ? " (FM)" : r.ptRole === "ADMIN" ? " (Admin)" : "");
    rows.push([label, r.contracts, round1(r.revenue), `${r.revenuePct}%`, r.mainSource]);
  }

  return rows;
}

/** Tạo & tải workbook: mỗi cơ sở 1 sheet. */
export async function downloadYearStatsExcel(year: number, branchStats: BranchYearStats[]): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  for (const { branchName, data } of branchStats) {
    const rows = buildSheetRows(year, branchName, data);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(branchName, usedNames));
  }

  const fileName =
    branchStats.length === 1
      ? `Thong-ke-nam-${year}-${branchStats[0].branchName}.xlsx`.replace(/\s+/g, "-")
      : `Thong-ke-nam-${year}-${branchStats.length}-co-so.xlsx`;

  XLSX.writeFile(wb, fileName);
}
