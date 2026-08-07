"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SessionDetailTable } from "./session-detail-table";

type SalaryRecord = {
  baseSalary:           number;
  totalRevenue:         number;
  commissionRate:       number;
  commissionAmount:     number;
  seniorityBonus:       number;
  standardWorkDays:     number;
  actualWorkDays:       number;
  /** Ngày nghỉ lấy từ lịch nghỉ, đã trừ vào ngày công thực tế. */
  leaveDays:            number;
  showsL1L2Loyal:       number;
  showsL3L4L5:          number;
  showsResident:        number;
  showPay:              number;
  goalBonus:            number;
  clientsAchievedGoal:  number;
  kocCommission:        number;
  kolCommission:        number;
  bhxh:                 number;
  totalSalary:          number;
  advancePaid:          number;
  remainingPayment:     number;
  notes:                string | null;
  status:               "PENDING" | "CONFIRMED" | "PAID";
};

type Props = {
  currentUserId:   string;
  currentUserName: string;
  currentUserRole?: string;
};

const STATUS_LABELS = { PENDING: "Chờ xác nhận", CONFIRMED: "Đã xác nhận", PAID: "Đã thanh toán" };
const STATUS_COLORS = {
  PENDING:   "bg-gray-100 text-gray-500",
  CONFIRMED: "bg-blue-100 text-blue-600",
  PAID:      "bg-green-100 text-green-600",
};

const PT_TIERS = [
  { label: "Dưới 38M",     rate: "1%"   },
  { label: "38M – 59.9M",  rate: "2.5%" },
  { label: "60M – 85.9M",  rate: "3.5%" },
  { label: "86M trở lên",  rate: "4%"   },
];

const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between items-center py-2.5 border-b border-gray-50", strong && "border-gray-200")}>
      <span className={cn("text-sm", strong ? "font-extrabold text-gray-800" : "text-gray-500")}>{label}</span>
      <span className={cn("text-sm", strong ? "font-extrabold text-gray-800" : "font-semibold text-gray-700")}>{value}</span>
    </div>
  );
}

export function PtSalaryView({ currentUserId, currentUserName }: Props) {
  const now = new Date();
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [year, setYear]     = useState(now.getFullYear());
  const [record, setRecord] = useState<SalaryRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/salary/my?month=${month}&year=${year}`);
      if (res.ok) {
        const data = await res.json() as { record: SalaryRecord | null };
        setRecord(data.record);
      }
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalShows = record
    ? record.showsL1L2Loyal + record.showsL3L4L5 + (record.showsResident ?? 0)
    : 0;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Filter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-sm font-semibold text-gray-600">{currentUserName}</p>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Tháng:</label>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Năm:</label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
            >
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">Đang tải...</div>
      ) : !record ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-gray-400 italic text-sm">Chưa có bảng lương tháng {month}/{year}</p>
          <p className="text-xs text-gray-300 mt-1">FM sẽ tạo bảng lương cho bạn</p>
        </div>
      ) : (
        <>
          {/* Salary breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
              <p className="text-sm font-extrabold text-gray-700">Lương tháng {month}/{year}</p>
              <span className={cn("px-3 py-1 rounded-full text-xs font-bold", STATUS_COLORS[record.status])}>
                {STATUS_LABELS[record.status]}
              </span>
            </div>

            <div className="space-y-0">
              <Row label="Lương cơ bản"    value={vnd(record.baseSalary)} />

              {/* Ngày công: lương cơ bản được chia theo thực tế / chuẩn */}
              {record.standardWorkDays > 0 && (
                <Row
                  label={(record.leaveDays ?? 0) > 0 ? `Ngày công (nghỉ ${record.leaveDays} ngày)` : "Ngày công"}
                  value={record.actualWorkDays >= record.standardWorkDays
                    ? `${record.actualWorkDays}/${record.standardWorkDays} ngày (đủ công)`
                    : `${record.actualWorkDays}/${record.standardWorkDays} ngày`}
                />
              )}

              {record.seniorityBonus > 0 && (
                <Row label="Lương thâm niên" value={vnd(record.seniorityBonus)} />
              )}

              <Row label="Doanh số tháng"  value={vnd(record.totalRevenue)} />

              <Row
                label={`Hoa hồng (${record.commissionRate}%)`}
                value={vnd(record.commissionAmount)}
              />

              {record.showPay > 0 && (
                <Row
                  label={`Tiền buổi dạy (${totalShows} buổi)`}
                  value={vnd(record.showPay)}
                />
              )}

              {record.goalBonus > 0 && (
                <Row
                  label={`Thưởng KH đạt MT (${record.clientsAchievedGoal} KH)`}
                  value={vnd(record.goalBonus)}
                />
              )}

              {(record.kocCommission ?? 0) > 0 && (
                <Row
                  label="Hoa hồng KOC"
                  value={vnd(record.kocCommission)}
                />
              )}

              {(record.kolCommission ?? 0) > 0 && (
                <Row
                  label="Hoa hồng KOL"
                  value={vnd(record.kolCommission)}
                />
              )}

              {/* Total */}
              <div className="flex justify-between items-center py-5 border-b border-gray-200 mt-1">
                <span className="text-base font-extrabold text-gray-800">TỔNG LƯƠNG</span>
                <span className="text-3xl font-extrabold" style={{ color: "#f15b5c" }}>
                  {vnd(record.totalSalary)}
                </span>
              </div>

              <Row label="Đã tạm ứng" value={vnd(record.advancePaid)} />

              <div className="flex justify-between items-center py-2.5">
                <span className="text-sm font-semibold text-gray-600">Còn lại nhận</span>
                <span className="text-xl font-extrabold text-gray-800">{vnd(record.remainingPayment)}</span>
              </div>
            </div>

            {/* BHXH note */}
            <div className="mt-4 px-4 py-3 bg-blue-50 rounded-xl">
              <p className="text-xs font-semibold text-blue-600">
                BHXH: {vnd(record.bhxh)} <span className="font-normal text-blue-400">(đóng theo mức đã đăng ký)</span>
              </p>
            </div>

            {record.notes && (
              <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 font-semibold mb-0.5">Ghi chú FM:</p>
                <p className="text-xs text-gray-600">{record.notes}</p>
              </div>
            )}
          </div>

          {/* Commission tier reference */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <p className="text-sm font-extrabold text-gray-700">Bảng hoa hồng tham chiếu</p>
            </div>
            <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f5f5f5] border-b border-gray-200">
                    {["Bậc", "Doanh số", "Tỉ lệ", ""].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide border-r border-gray-200 last:border-r-0">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PT_TIERS.map((t, i) => {
                    const isApplied = record.commissionRate === [1, 2.5, 3.5, 4][i];
                    return (
                      <tr key={i} className={cn(
                        "border-b border-gray-100 last:border-0 divide-x divide-gray-100",
                        isApplied && "bg-[#f15b5c]/5"
                      )}>
                        <td className="px-3 py-2 font-semibold text-gray-700">Bậc {i + 1}</td>
                        <td className="px-3 py-2 text-gray-600">{t.label}</td>
                        <td className="px-3 py-2 font-semibold" style={{ color: isApplied ? "#f15b5c" : undefined }}>
                          {t.rate}
                        </td>
                        <td className="px-3 py-2 text-[10px]">
                          {isApplied && <span className="text-[#f15b5c] font-bold">✓ đang áp dụng</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-2.5 text-[10px] text-gray-400 italic border-t border-gray-100">
              * % doanh thu áp dụng theo bậc toàn bộ doanh số tháng
            </p>
          </div>
        </>
      )}

      {/* Session detail table — always visible, independent of salary record */}
      <SessionDetailTable
        ptId={currentUserId}
        ptName={currentUserName}
        month={month}
        year={year}
        canEdit
      />
    </div>
  );
}
