"use client";

import { useEffect, useRef, useState } from "react";
import { Trophy, Crown, Medal, Award, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomSheet } from "./bottom-sheet";

// Bảng xếp hạng nhân sự hiển thị cho khách hàng: top 3 của hệ thống ngay ở
// trang Tổng quan, kèm dòng riêng cho PT đang kèm khách để họ biết người hỗ
// trợ mình đang đứng ở đâu. "Xem thêm" mở danh sách đầy đủ.

type Row = {
  ptId: string;
  rank: number;
  name: string;
  branchName: string | null;
  levelName: string | null;
  levelColor: string | null;
  transformedCount: number;
  points: number;
};

type Data = { periodLabel: string; myPtId: string | null; rows: Row[] };

type Period = "quarter" | "year";

const PERIODS: { key: Period; label: string }[] = [
  { key: "quarter", label: "Quý" },
  { key: "year", label: "Năm" },
];

// Trang trí riêng cho 3 hạng đầu — vàng, bạc, đồng.
const PODIUM = [
  {
    Icon: Crown,
    badge: "bg-gradient-to-br from-amber-400 to-yellow-500",
    ring: "border-amber-200 bg-amber-50/60",
    label: "text-amber-600",
  },
  {
    Icon: Medal,
    badge: "bg-gradient-to-br from-slate-300 to-slate-400",
    ring: "border-slate-200 bg-slate-50",
    label: "text-slate-500",
  },
  {
    Icon: Award,
    badge: "bg-gradient-to-br from-orange-400 to-amber-600",
    ring: "border-orange-200 bg-orange-50/60",
    label: "text-orange-600",
  },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1] ?? "").charAt(0).toUpperCase() || "?";
}

/** Một dòng xếp hạng. Top 3 được tô màu bục, các hạng sau để trắng. */
function RankRowItem({ row, isMyPt }: { row: Row; isMyPt: boolean }) {
  const deco = row.rank <= 3 ? PODIUM[row.rank - 1] : null;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-3 py-2.5",
        deco ? deco.ring : "border-gray-100 bg-white",
        isMyPt && "ring-2 ring-[#f15b5c]/40"
      )}
    >
      <span
        className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0",
          deco ? `${deco.badge} text-white shadow-sm` : "bg-gray-100 text-gray-500"
        )}
      >
        {row.rank}
      </span>

      <div className="w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center shrink-0">
        <span className="text-sm font-extrabold text-gray-600">{initials(row.name)}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-extrabold text-gray-900 truncate">{row.name}</p>
          {deco && <deco.Icon className={cn("w-3.5 h-3.5 shrink-0", deco.label)} />}
          {isMyPt && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#f15b5c] text-white text-[9px] font-extrabold shrink-0">
              PT của bạn
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {row.levelName && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: (row.levelColor || "#6b7280") + "22",
                color: row.levelColor || "#6b7280",
              }}
            >
              {row.levelName}
            </span>
          )}
          {row.branchName && (
            <span className="text-[10px] font-semibold text-gray-400 truncate">
              {row.branchName}
            </span>
          )}
          <span className="text-[10px] font-semibold text-emerald-500">
            {row.transformedCount} transform
          </span>
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-black text-gray-900 leading-none">{row.points}</p>
        <p className="text-[9px] font-bold text-gray-400 mt-0.5">điểm</p>
      </div>
    </div>
  );
}

/** Bộ chọn kỳ dùng chung cho thẻ ở trang Tổng quan và cho modal. */
function PeriodTabs({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors",
            period === p.key ? "bg-white text-[#f15b5c] shadow-sm" : "text-gray-500"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function PtRankingSection() {
  const [period, setPeriod] = useState<Period>("quarter");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  // Đổi qua lại giữa Quý và Năm không gọi lại API nếu đã tải kỳ đó rồi.
  const cache = useRef<Partial<Record<Period, Data>>>({});

  useEffect(() => {
    const cached = cache.current[period];
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(false);
    fetch(`/api/my/pt-ranking?period=${period}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json() as Promise<Data>;
      })
      .then((json) => {
        if (!alive) return;
        cache.current[period] = json;
        setData(json);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [period]);

  const rows = data?.rows ?? [];
  const top3 = rows.slice(0, 3);
  const myPt = data?.myPtId ? rows.find((r) => r.ptId === data.myPtId) ?? null : null;
  // PT của khách nằm ngoài top 3 thì thêm hẳn một dòng để họ thấy ngay vị trí.
  const showMyPtRow = myPt != null && myPt.rank > 3;

  return (
    <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mt-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-extrabold text-gray-700">Bảng xếp hạng PT</p>
        </div>
        <PeriodTabs period={period} onChange={setPeriod} />
      </div>
      <p className="text-[10px] text-gray-400 font-semibold mb-3">
        {data ? `${data.periodLabel} · ${rows.length} nhân sự` : "Đang cập nhật..."}
      </p>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-2xl bg-gray-50 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="py-6 text-center text-xs font-semibold text-gray-300">
          Không tải được bảng xếp hạng
        </p>
      ) : top3.length === 0 ? (
        <p className="py-6 text-center text-xs font-semibold text-gray-300">
          Chưa có dữ liệu xếp hạng cho kỳ này
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {top3.map((row) => (
              <RankRowItem key={row.ptId} row={row} isMyPt={row.ptId === data?.myPtId} />
            ))}
          </div>

          {showMyPtRow && myPt && (
            <div className="mt-2 pt-2 border-t border-dashed border-gray-100">
              <RankRowItem row={myPt} isMyPt />
            </div>
          )}

          <div className="flex justify-end mt-3">
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-0.5 text-xs font-bold text-[#f15b5c]"
            >
              Xem thêm
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Bảng xếp hạng PT">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400">
            {data ? `${data.periodLabel} · ${rows.length} nhân sự` : ""}
          </p>
          <PeriodTabs period={period} onChange={setPeriod} />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded-2xl bg-gray-50 animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm font-semibold text-gray-300">
            Chưa có dữ liệu xếp hạng cho kỳ này
          </p>
        ) : (
          <div className="space-y-2 pb-2">
            {rows.map((row) => (
              <RankRowItem key={row.ptId} row={row} isMyPt={row.ptId === data?.myPtId} />
            ))}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
