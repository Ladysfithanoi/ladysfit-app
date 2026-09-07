"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Tag, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PACKAGES, formatPrice } from "@/lib/packages";
import { ROADMAP_PACKAGES } from "@/lib/roadmap-phases";
import { fmtVnDate, vnDayString } from "@/lib/package-promos";

/**
 * ── Cài đặt → Trợ giá ────────────────────────────────────────────────────────
 *
 * Admin tự khai các đợt trợ giá riêng của từng cơ sở, có ngày hết hạn. Đợt hết
 * hạn thì giá tự trở về bình thường — không ai phải nhớ vào đây tắt.
 *
 * Nhập GIÁ CUỐI khách trả, không nhập phần trăm: phần trăm hiện ra là do màn
 * hình tự tính để đối chiếu, còn thứ ghi vào hợp đồng luôn là con số đã nhập.
 */

type PromoRow = {
  id: string;
  name: string;
  shortLabel: string;
  branchId: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  branch: { id: string; name: string };
  items: { id: string; packageName: string; price: number }[];
};

type BranchRow = { id: string; name: string };

type DraftItem = { packageName: string; price: string };

type Draft = {
  id: string | null;
  name: string;
  shortLabel: string;
  branchId: string;
  startDay: string;
  endDay: string;
  isActive: boolean;
  items: DraftItem[];
};

/** Gói có giá niêm yết để trợ giá — gói 0đ (tài trợ) không có gì để giảm. */
const PROMOTABLE = ROADMAP_PACKAGES.filter((k) => (PACKAGES[k]?.price ?? 0) > 0);

function todayVN(): string {
  return vnDayString(new Date());
}

function emptyDraft(branchId: string): Draft {
  return {
    id: null,
    name: "",
    shortLabel: "",
    branchId,
    startDay: todayVN(),
    endDay: todayVN(),
    isActive: true,
    items: [],
  };
}

function draftFrom(p: PromoRow): Draft {
  return {
    id: p.id,
    name: p.name,
    shortLabel: p.shortLabel,
    branchId: p.branchId,
    startDay: vnDayString(p.startsAt),
    endDay: vnDayString(p.endsAt),
    isActive: p.isActive,
    items: p.items.map((i) => ({ packageName: i.packageName, price: String(i.price) })),
  };
}

/** "−30%" so với giá niêm yết, hoặc chuỗi rỗng khi chưa nhập được số. */
function offLabel(packageName: string, price: string): string {
  const list = PACKAGES[packageName]?.price ?? 0;
  const p = Number(price);
  if (!(list > 0) || !(p > 0) || p >= list) return "";
  return `−${Math.round((1 - p / list) * 100)}%`;
}

export function PackagePromosTab({ branches }: { branches: BranchRow[] }) {
  const [promos, setPromos]   = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft]     = useState<Draft | null>(null);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [toast, setToast]     = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promos");
      if (res.ok) setPromos((await res.json()) as PromoRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function toggleItem(packageName: string) {
    setDraft((d) => {
      if (!d) return d;
      const has = d.items.some((i) => i.packageName === packageName);
      return {
        ...d,
        items: has
          ? d.items.filter((i) => i.packageName !== packageName)
          : [...d.items, { packageName, price: "" }],
      };
    });
  }

  function setItemPrice(packageName: string, price: string) {
    setDraft((d) =>
      d ? { ...d, items: d.items.map((i) => (i.packageName === packageName ? { ...i, price } : i)) } : d
    );
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: draft.name,
        shortLabel: draft.shortLabel,
        branchId: draft.branchId,
        startDay: draft.startDay,
        endDay: draft.endDay,
        isActive: draft.isActive,
        items: draft.items.map((i) => ({ packageName: i.packageName, price: Number(i.price) })),
      };
      const res = await fetch(draft.id ? `/api/admin/promos/${draft.id}` : "/api/admin/promos", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? `Lưu thất bại (mã ${res.status}).`);
        return;
      }
      setDraft(null);
      showToast(draft.id ? "Đã cập nhật đợt trợ giá ✓" : "Đã tạo đợt trợ giá ✓");
      await load();
    } catch {
      setError("Không kết nối được máy chủ. Thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setDeletingId(null);
    await fetch(`/api/admin/promos/${id}`, { method: "DELETE" });
    showToast("Đã xoá đợt trợ giá");
    await load();
  }

  const nowMs = Date.now();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-gray-800 flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#f15b5c]" />
            Đợt trợ giá theo cơ sở
          </p>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
            Giá nhập ở đây là giá cuối khách trả, áp cho đúng cơ sở và tự hết hiệu lực sau ngày
            kết thúc. Hợp đồng đã ký giữ nguyên giá lúc chốt.
          </p>
        </div>
        {!draft && (
          <button
            onClick={() => setDraft(emptyDraft(branches[0]?.id ?? ""))}
            disabled={branches.length === 0}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-white text-sm font-bold disabled:opacity-50 whitespace-nowrap"
            style={{ backgroundColor: "#f15b5c" }}
          >
            <Plus className="w-4 h-4" />
            Thêm đợt trợ giá
          </button>
        )}
      </div>

      {/* ── Form thêm / sửa ── */}
      {draft && (
        <div className="mb-5 rounded-2xl border-2 border-[#f15b5c]/30 bg-[#fff9f9] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-sm font-extrabold text-gray-800">
              {draft.id ? "Sửa đợt trợ giá" : "Đợt trợ giá mới"}
            </p>
            <button
              onClick={() => { setDraft(null); setError(""); }}
              disabled={saving}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-white disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold text-gray-500">Tên đợt</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Presale trợ giá 30% — Ladysfit Trần Duy Hưng"
                className="mt-1 w-full h-10 px-3 rounded-xl border border-gray-200 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-gray-500">Nhãn ngắn (hiện cạnh giá)</span>
              <input
                value={draft.shortLabel}
                onChange={(e) => setDraft({ ...draft, shortLabel: e.target.value })}
                placeholder="Presale −30%"
                className="mt-1 w-full h-10 px-3 rounded-xl border border-gray-200 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-gray-500">Cơ sở áp dụng</span>
              <select
                value={draft.branchId}
                onChange={(e) => setDraft({ ...draft, branchId: e.target.value })}
                className="mt-1 w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-bold text-gray-500">Từ ngày</span>
                <input
                  type="date"
                  value={draft.startDay}
                  onChange={(e) => setDraft({ ...draft, startDay: e.target.value })}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-gray-200 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-gray-500">Đến hết ngày</span>
                <input
                  type="date"
                  value={draft.endDay}
                  onChange={(e) => setDraft({ ...draft, endDay: e.target.value })}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-gray-200 text-sm"
                />
              </label>
            </div>
          </div>

          {/* Gói được trợ giá */}
          <p className="mt-4 text-xs font-bold text-gray-500">Gói được trợ giá và giá cuối</p>
          <div className="mt-2 space-y-2">
            {PROMOTABLE.map((key) => {
              const item = draft.items.find((i) => i.packageName === key);
              const def  = PACKAGES[key];
              const off  = item ? offLabel(key, item.price) : "";
              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 transition-colors",
                    item ? "border-[#f15b5c]/40 bg-white" : "border-gray-200 bg-white/60"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <label className="flex items-center gap-2 cursor-pointer min-w-[9rem]">
                      <input
                        type="checkbox"
                        checked={!!item}
                        onChange={() => toggleItem(key)}
                        className="w-4 h-4 accent-[#f15b5c]"
                      />
                      <span className="text-sm font-extrabold text-gray-800">{key}</span>
                      <span className="text-[11px] text-gray-400">
                        niêm yết {formatPrice(def.price)}
                      </span>
                    </label>

                    {item && (
                      <div className="flex items-center gap-2 flex-1 min-w-[12rem]">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={item.price}
                          onChange={(e) => setItemPrice(key, e.target.value)}
                          placeholder="17500000"
                          className="h-9 px-3 rounded-lg border border-gray-200 text-sm w-40"
                        />
                        <span className="text-xs font-semibold text-gray-500">
                          {Number(item.price) > 0 ? formatPrice(Number(item.price)) : "đ"}
                        </span>
                        {off && (
                          <span className="rounded-full bg-[#f15b5c] px-2 py-0.5 text-[10px] font-bold text-white">
                            {off}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <label className="mt-4 flex items-center gap-2 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              className="w-4 h-4 accent-[#f15b5c]"
            />
            <span className="text-xs font-bold text-gray-600">Bật đợt này</span>
          </label>

          {error && <p className="mt-3 text-xs font-semibold text-[#f15b5c]">{error}</p>}

          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="h-10 px-5 rounded-xl text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-1.5 w-full sm:w-auto"
              style={{ backgroundColor: "#f15b5c" }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? "Đang lưu..." : "Lưu đợt trợ giá"}
            </button>
            <button
              onClick={() => { setDraft(null); setError(""); }}
              disabled={saving}
              className="h-10 px-5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 disabled:opacity-50 w-full sm:w-auto"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {/* ── Danh sách ── */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      ) : promos.length === 0 ? (
        <p className="py-12 text-center text-sm font-semibold text-gray-300">
          Chưa có đợt trợ giá nào.
        </p>
      ) : (
        <div className="space-y-3">
          {promos.map((p) => {
            const started = new Date(p.startsAt).getTime() <= nowMs;
            const ended   = new Date(p.endsAt).getTime() < nowMs;
            const running = p.isActive && started && !ended;
            const status  = !p.isActive ? "Đã tắt" : ended ? "Hết hạn" : !started ? "Chưa tới ngày" : "Đang chạy";

            return (
              <div key={p.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-extrabold text-gray-900">{p.name}</p>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap",
                        running ? "bg-green-100 text-green-700"
                          : ended ? "bg-gray-100 text-gray-500"
                            : !p.isActive ? "bg-gray-100 text-gray-500"
                              : "bg-amber-100 text-amber-700"
                      )}>
                        {status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs font-semibold text-gray-500">
                      {p.branch.name} · {fmtVnDate(p.startsAt)} → hết {fmtVnDate(p.endsAt)} · nhãn &ldquo;{p.shortLabel}&rdquo;
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => { setDraft(draftFrom(p)); setError(""); }}
                      title="Sửa đợt này"
                      className="p-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingId(p.id)}
                      title="Xoá đợt này"
                      className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {p.items.map((it) => {
                    const list = PACKAGES[it.packageName]?.price ?? 0;
                    return (
                      <span
                        key={it.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-100 bg-gray-50 px-2.5 py-1.5 text-xs"
                      >
                        <span className="font-extrabold text-gray-800">{it.packageName}</span>
                        {list > it.price && (
                          <span className="text-gray-400 line-through">{formatPrice(list)}</span>
                        )}
                        <span className="font-bold text-[#f15b5c]">{formatPrice(it.price)}</span>
                        {list > it.price && (
                          <span className="text-[10px] font-bold text-gray-500">
                            −{Math.round((1 - it.price / list) * 100)}%
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>

                {deletingId === p.id && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                    <p className="text-xs font-semibold text-red-700">
                      Xoá đợt này? Hợp đồng đã ký giữ nguyên giá lúc chốt, chỉ những buổi tư vấn từ
                      giờ trở đi không còn được trợ giá.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => remove(p.id)}
                        className="h-8 px-3 rounded-lg bg-red-500 text-white text-xs font-bold"
                      >
                        Xoá
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="h-8 px-3 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600"
                      >
                        Giữ lại
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
