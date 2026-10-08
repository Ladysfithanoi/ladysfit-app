"use client";

export type MonthBranchValue = { month: number; year: number; branchId: string };

export function currentMonthBranch(): MonthBranchValue {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear(), branchId: "" };
}

/** Bộ chọn tháng · năm · cơ sở dùng cho các khối thống kê tự tải ở Tổng quan. */
export function MonthBranchPicker({
  value,
  onChange,
  branches,
}: {
  value: MonthBranchValue;
  onChange: (v: MonthBranchValue) => void;
  branches: { id: string; name: string }[];
}) {
  const thisYear = new Date().getFullYear();
  const years = [thisYear - 2, thisYear - 1, thisYear];
  const cls =
    "h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/40";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={cls} value={value.month} onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}>
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
        ))}
      </select>
      <select className={cls} value={value.year} onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      {branches.length > 1 && (
        <select className={cls} value={value.branchId} onChange={(e) => onChange({ ...value, branchId: e.target.value })}>
          <option value="">Tất cả cơ sở</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
    </div>
  );
}
