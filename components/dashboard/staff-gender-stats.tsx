"use client";

import { useMemo, useState } from "react";
import { UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tổng quan Admin — số nhân sự và tỉ lệ giới tính, lọc theo chức vụ.
 * Nguồn: User đang làm (chưa xoá, bỏ tài khoản test), giới tính khai trong hồ
 * sơ nhân sự. Người chưa khai giới tính đứng riêng một nhóm, không bị đoán.
 */

export type StaffOverview = {
  people:    { gender: "MALE" | "FEMALE" | null; jobPositionId: string | null }[];
  positions: { id: string; name: string; color: string }[];
};

// Bảng màu đã chạy validate_palette (CVD ΔE 19, normal ΔE 32). "Chưa khai" là
// xám trung tính — không phải một nhóm danh tính.
const SEGMENTS = [
  { key: "FEMALE",  label: "Nữ",        color: "#e8455f" },
  { key: "MALE",    label: "Nam",       color: "#2f6fd6" },
  { key: "UNKNOWN", label: "Chưa khai", color: "#d1d5db" },
] as const;
type SegKey = (typeof SEGMENTS)[number]["key"];

const ALL = "__all__";
const NO_POSITION = "__none__";

function tally(people: StaffOverview["people"]) {
  const c: Record<SegKey, number> = { FEMALE: 0, MALE: 0, UNKNOWN: 0 };
  for (const p of people) c[p.gender ?? "UNKNOWN"]++;
  return { ...c, total: people.length };
}

const pct = (n: number, total: number) => (total === 0 ? 0 : (n / total) * 100);
const fmtPct = (v: number) => `${v.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;

export function StaffGenderStats({ data }: { data: StaffOverview }) {
  const [positionId, setPositionId] = useState<string>(ALL);
  const [hover, setHover] = useState<SegKey | null>(null);

  const hasNoPosition = data.people.some((p) => !p.jobPositionId);

  const filtered = useMemo(() => {
    if (positionId === ALL) return data.people;
    if (positionId === NO_POSITION) return data.people.filter((p) => !p.jobPositionId);
    return data.people.filter((p) => p.jobPositionId === positionId);
  }, [data.people, positionId]);

  const t = tally(filtered);

  // Bảng theo chức vụ — vừa là bảng số cho phần biểu đồ, vừa để so các chức vụ.
  const rows = useMemo(() => {
    const list = data.positions.map((pos) => ({
      id: pos.id, name: pos.name, color: pos.color,
      ...tally(data.people.filter((p) => p.jobPositionId === pos.id)),
    }));
    if (hasNoPosition) {
      list.push({ id: NO_POSITION, name: "Chưa có chức vụ", color: "#9ca3af", ...tally(data.people.filter((p) => !p.jobPositionId)) });
    }
    return list.filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  }, [data, hasNoPosition]);

  const visibleSegs = SEGMENTS.filter((s) => t[s.key] > 0);
  const hovered = hover ? SEGMENTS.find((s) => s.key === hover) : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6 space-y-5">
      {/* Tiêu đề + bộ lọc chức vụ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <UsersRound className="w-4 h-4 text-[#f15b5c]" />
          <h2 className="text-base font-extrabold text-gray-900">Nhân sự & tỉ lệ giới tính</h2>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 font-medium whitespace-nowrap">Chức vụ</span>
          <select
            value={positionId}
            onChange={(e) => setPositionId(e.target.value)}
            className="h-10 min-w-0 flex-1 sm:w-56 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/40"
          >
            <option value={ALL}>Tất cả chức vụ</option>
            {data.positions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            {hasNoPosition && <option value={NO_POSITION}>Chưa có chức vụ</option>}
          </select>
        </label>
      </div>

      {/* Số liệu chính */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-gray-50 p-4">
          <p className="text-xs font-semibold text-gray-500">Tổng nhân sự</p>
          <p className="mt-1 text-3xl font-extrabold text-gray-900 tabular-nums">{t.total}</p>
        </div>
        {SEGMENTS.map((s) => (
          <div key={s.key} className="rounded-xl bg-gray-50 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </p>
            <p className="mt-1 text-3xl font-extrabold text-gray-900 tabular-nums">
              {t[s.key]}
              <span className="ml-1.5 text-sm font-bold text-gray-400">{fmtPct(pct(t[s.key], t.total))}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Thanh tỉ lệ giới tính */}
      <div>
        <div className="flex items-center justify-between mb-2 min-h-[20px]">
          <p className="text-xs font-semibold text-gray-500">Tỉ lệ giới tính</p>
          {hovered && (
            <p className="text-xs font-semibold text-gray-700 tabular-nums">
              {hovered.label}: {t[hovered.key]} người · {fmtPct(pct(t[hovered.key], t.total))}
            </p>
          )}
        </div>
        {t.total === 0 ? (
          <div className="h-4 rounded bg-gray-100" />
        ) : (
          <div className="flex h-4 gap-[2px]" role="img" aria-label={
            visibleSegs.map((s) => `${s.label} ${fmtPct(pct(t[s.key], t.total))}`).join(", ")
          }>
            {visibleSegs.map((s, i) => (
              <div
                key={s.key}
                onMouseEnter={() => setHover(s.key)}
                onMouseLeave={() => setHover(null)}
                className={cn(
                  "h-full transition-opacity cursor-default",
                  i === 0 && "rounded-l",
                  i === visibleSegs.length - 1 && "rounded-r",
                  hover && hover !== s.key && "opacity-40",
                )}
                style={{ width: `${pct(t[s.key], t.total)}%`, backgroundColor: s.color }}
              />
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {SEGMENTS.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label} <span className="font-semibold text-gray-800 tabular-nums">{fmtPct(pct(t[s.key], t.total))}</span>
            </span>
          ))}
        </div>
        {t.UNKNOWN > 0 && (
          <p className="mt-2 text-xs text-gray-400">
            {t.UNKNOWN} nhân sự chưa khai giới tính — điền ở Nhân sự → Sửa → Giới tính.
          </p>
        )}
      </div>

      {/* Bảng theo chức vụ */}
      {positionId === ALL && rows.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left font-semibold py-2 px-1">Chức vụ</th>
                <th className="text-right font-semibold py-2 px-1">Số người</th>
                <th className="text-right font-semibold py-2 px-1">Nữ</th>
                <th className="text-right font-semibold py-2 px-1">Nam</th>
                <th className="text-right font-semibold py-2 px-1 whitespace-nowrap">Chưa khai</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setPositionId(r.id)}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
                  title="Bấm để lọc theo chức vụ này"
                >
                  <td className="py-2 px-1">
                    <span className="flex items-center gap-2 font-semibold text-gray-800">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                      {r.name}
                    </span>
                  </td>
                  <td className="py-2 px-1 text-right font-bold text-gray-900 tabular-nums">{r.total}</td>
                  <td className="py-2 px-1 text-right text-gray-700 tabular-nums">
                    {r.FEMALE} <span className="text-gray-400 text-xs">({fmtPct(pct(r.FEMALE, r.total))})</span>
                  </td>
                  <td className="py-2 px-1 text-right text-gray-700 tabular-nums">
                    {r.MALE} <span className="text-gray-400 text-xs">({fmtPct(pct(r.MALE, r.total))})</span>
                  </td>
                  <td className="py-2 px-1 text-right text-gray-500 tabular-nums">{r.UNKNOWN}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
