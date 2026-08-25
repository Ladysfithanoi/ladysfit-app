"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, RotateCcw, Search, X, Settings2, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format-date";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Pagination } from "@/components/ui/pagination";

type TrashRow = {
  id: string;
  entityType: string;
  entityId: string;
  label: string;
  summary: string | null;
  branchName: string | null;
  deletedByName: string | null;
  deletedByRole: string | null;
  deletedAt: string;
};

type TypeOption = { value: string; label: string; count: number };

type TrashResponse = {
  items: TrashRow[];
  total: number;
  page: number;
  pageSize: number;
  retentionDays: number;
  types: TypeOption[];
};

const ROLE_COLOR: Record<string, string> = {
  ADMIN: "bg-violet-50 text-violet-700",
  FM: "bg-emerald-50 text-emerald-700",
  PT: "bg-amber-50 text-amber-700",
  COO: "bg-blue-50 text-blue-700",
  CEO_FITPARTNER: "bg-indigo-50 text-indigo-700",
};

const TYPE_COLOR: Record<string, string> = {
  CLIENT: "bg-rose-50 text-rose-700",
  CONSULTATION: "bg-orange-50 text-orange-700",
  PACKAGE_ENROLLMENT: "bg-amber-50 text-amber-700",
  WORKOUT_PROGRAM: "bg-sky-50 text-sky-700",
  WORKOUT_WEEK: "bg-sky-50 text-sky-700",
  WORKOUT_SESSION: "bg-cyan-50 text-cyan-700",
  WORKOUT_LOG: "bg-teal-50 text-teal-700",
  WEIGHT_LOG: "bg-lime-50 text-lime-700",
  BODY_MEASUREMENT: "bg-lime-50 text-lime-700",
  SALES_LEAD: "bg-blue-50 text-blue-700",
  TRANSACTION: "bg-emerald-50 text-emerald-700",
  STAFF: "bg-violet-50 text-violet-700",
};

const inputCls =
  "h-10 rounded-xl border border-gray-200 px-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

/** Số ngày gợi ý sẵn cho ô cài đặt tự động xóa. */
const RETENTION_PRESETS = [7, 15, 30, 60, 90, 180, 365];

export function TrashPageClient() {
  const [data, setData] = useState<TrashResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  // Bộ lọc
  const [type, setType] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Cài đặt tự động xóa
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [retentionInput, setRetentionInput] = useState("30");
  const [savingSettings, setSavingSettings] = useState(false);

  // Hộp thoại xác nhận
  const [purgeDialog, setPurgeDialog] = useState<"filtered" | "all" | null>(null);
  const [purging, setPurging] = useState(false);
  const [deleteRow, setDeleteRow] = useState<TrashRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const hasFilter = type !== "ALL" || !!from || !!to || !!search;

  const queryString = useCallback(
    (includePage: boolean) => {
      const p = new URLSearchParams();
      if (type !== "ALL") p.set("type", type);
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (search) p.set("q", search);
      if (includePage) p.set("page", String(page));
      return p.toString();
    },
    [type, from, to, search, page]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/trash?${queryString(true)}`);
      if (!res.ok) throw new Error("Không tải được thùng rác");
      const json = (await res.json()) as TrashResponse;
      setData(json);
      setRetentionInput(String(json.retentionDays));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Đổi bộ lọc thì luôn quay về trang 1
  useEffect(() => {
    setPage(1);
  }, [type, from, to, search]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  async function handleRestore(row: TrashRow) {
    setBusyId(row.id);
    setError("");
    try {
      const res = await fetch(`/api/trash/${row.id}/restore`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Khôi phục thất bại");
      showToast(`Đã khôi phục "${row.label}"`);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khôi phục thất bại");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteRow() {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      await fetch(`/api/trash/${deleteRow.id}`, { method: "DELETE" });
      setDeleteRow(null);
      showToast("Đã xóa vĩnh viễn 1 mục");
      await fetchData();
    } finally {
      setDeleting(false);
    }
  }

  async function handlePurge() {
    if (!purgeDialog) return;
    setPurging(true);
    try {
      const qs = purgeDialog === "filtered" ? queryString(false) : "";
      const res = await fetch(`/api/trash${qs ? `?${qs}` : ""}`, { method: "DELETE" });
      const json = await res.json();
      setPurgeDialog(null);
      showToast(`Đã xóa vĩnh viễn ${json.deleted ?? 0} mục`);
      await fetchData();
    } finally {
      setPurging(false);
    }
  }

  async function handleSaveSettings() {
    const days = Number(retentionInput);
    if (!Number.isFinite(days) || days < 0 || days > 3650) {
      setError("Số ngày phải từ 0 đến 3650");
      return;
    }
    setSavingSettings(true);
    setError("");
    try {
      const res = await fetch("/api/trash/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionDays: Math.round(days) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Lưu thất bại");
      setSettingsOpen(false);
      showToast(
        days === 0
          ? "Đã đặt: giữ dữ liệu trong thùng rác vĩnh viễn"
          : `Đã đặt: tự động xóa sau ${Math.round(days)} ngày${json.purged ? ` · dọn ngay ${json.purged} mục quá hạn` : ""}`
      );
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setSavingSettings(false);
    }
  }

  function clearFilters() {
    setType("ALL");
    setFrom("");
    setTo("");
    setQ("");
    setSearch("");
  }

  const types = data?.types ?? [];
  const totalInBin = types.reduce((s, t) => s + t.count, 0);
  const retentionDays = data?.retentionDays ?? 30;
  const pageCount = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-[#f15b5c]" />
            Thùng rác
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            {totalInBin} mục · Mọi dữ liệu PT và FM xóa đi đều được giữ ở đây
            {retentionDays > 0 ? ` và tự động xóa sau ${retentionDays} ngày` : " và không tự động xóa"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
          >
            <Settings2 className="w-4 h-4" />
            Tự động xóa
          </button>
          <button
            onClick={() => setPurgeDialog("all")}
            disabled={totalInBin === 0}
            className="flex items-center gap-2 px-4 h-10 rounded-xl text-white text-sm font-bold shadow-sm disabled:opacity-40"
            style={{ backgroundColor: "#ef4444" }}
          >
            <Trash2 className="w-4 h-4" />
            Dọn sạch
          </button>
        </div>
      </div>

      {/* ── Bộ lọc ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Loại dữ liệu
            </label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={cn(inputCls, "w-full")}>
              <option value="ALL">Tất cả loại ({totalInBin})</option>
              {types.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} ({t.count})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Xóa từ ngày
            </label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={cn(inputCls, "w-full")} />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Đến ngày
            </label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={cn(inputCls, "w-full")} />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Tìm kiếm
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(q.trim());
              }}
              className="relative"
            >
              <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tên dữ liệu, người xóa..."
                className={cn(inputCls, "w-full pl-9")}
              />
            </form>
          </div>
        </div>

        {hasFilter && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-gray-400">
              Đang lọc — {data?.total ?? 0} mục khớp
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 px-3 h-8 rounded-lg hover:bg-gray-100"
              >
                <X className="w-3.5 h-3.5" />
                Bỏ lọc
              </button>
              <button
                onClick={() => setPurgeDialog("filtered")}
                disabled={(data?.total ?? 0) === 0}
                className="text-xs font-bold text-red-600 hover:text-red-700 px-3 h-8 rounded-lg hover:bg-red-50 disabled:opacity-40"
              >
                Xóa vĩnh viễn {data?.total ?? 0} mục đang lọc
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Lỗi ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Danh sách ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Đang tải...</div>
      ) : !data || data.items.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-2xl">
          <Trash2 className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-300">
            {hasFilter ? "Không có mục nào khớp bộ lọc" : "Thùng rác đang trống"}
          </p>
          <p className="text-xs text-gray-300 mt-1">
            {hasFilter ? "Thử bỏ bớt điều kiện lọc" : "Dữ liệu PT và FM xóa sẽ xuất hiện tại đây"}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100">
              {data.items.map((row) => {
                const typeLabel = types.find((t) => t.value === row.entityType)?.label ?? row.entityType;
                const busy = busyId === row.id;
                return (
                  <div key={row.id} className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-gray-50/50">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0",
                            TYPE_COLOR[row.entityType] ?? "bg-gray-100 text-gray-600"
                          )}
                        >
                          {typeLabel}
                        </span>
                        <p className="text-sm font-semibold text-gray-800 truncate">{row.label}</p>
                      </div>
                      {row.summary && (
                        <p className="text-xs text-gray-400 mt-1 truncate">{row.summary}</p>
                      )}
                    </div>

                    <div className="text-xs text-gray-400 min-w-[150px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-gray-600">
                          {row.deletedByName ?? "—"}
                        </span>
                        {row.deletedByRole && (
                          <span
                            className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded",
                              ROLE_COLOR[row.deletedByRole] ?? "bg-gray-100 text-gray-600"
                            )}
                          >
                            {row.deletedByRole}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5">
                        {fmtDateTime(row.deletedAt)}
                        {row.branchName ? ` · ${row.branchName}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleRestore(row)}
                        disabled={busy}
                        className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        Khôi phục
                      </button>
                      <button
                        onClick={() => setDeleteRow(row)}
                        className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Xóa vĩnh viễn"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Pagination
            page={data.page}
            pageCount={pageCount}
            total={data.total}
            pageSize={data.pageSize}
            onPageChange={setPage}
            itemLabel="mục"
          />
        </>
      )}

      {/* ── Cài đặt tự động xóa ───────────────────────────────────────── */}
      {settingsOpen && (
        <>
          <div className="fixed inset-0 bg-black/25 z-40" onClick={() => setSettingsOpen(false)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold">Tự động xóa thùng rác</h2>
              <button onClick={() => setSettingsOpen(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <p className="text-sm text-gray-500 leading-relaxed">
                Dữ liệu nằm trong thùng rác quá số ngày dưới đây sẽ bị xóa vĩnh viễn và
                không khôi phục lại được. Hệ thống dọn tự động mỗi ngày.
              </p>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Giữ dữ liệu trong (ngày)</label>
                <input
                  type="number"
                  min={0}
                  max={3650}
                  value={retentionInput}
                  onChange={(e) => setRetentionInput(e.target.value)}
                  className={cn(inputCls, "w-full h-11")}
                />
                <p className="text-xs text-gray-400">Đặt 0 để giữ mãi — không bao giờ tự xóa.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {RETENTION_PRESETS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setRetentionInput(String(d))}
                    className={cn(
                      "px-3 h-8 rounded-lg text-xs font-bold border transition-colors",
                      Number(retentionInput) === d
                        ? "border-[#f15b5c] text-[#f15b5c] bg-[#f15b5c]/5"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    )}
                  >
                    {d} ngày
                  </button>
                ))}
                <button
                  onClick={() => setRetentionInput("0")}
                  className={cn(
                    "px-3 h-8 rounded-lg text-xs font-bold border transition-colors",
                    Number(retentionInput) === 0
                      ? "border-[#f15b5c] text-[#f15b5c] bg-[#f15b5c]/5"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  )}
                >
                  Giữ mãi
                </button>
              </div>

              {Number(retentionInput) > 0 && Number(retentionInput) < retentionDays && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl px-4 py-3 text-xs">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Hạ số ngày xuống sẽ dọn ngay những mục đã quá hạn theo mốc mới.
                  </span>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setSettingsOpen(false)}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="flex-1 h-11 rounded-xl text-white text-sm font-bold shadow-sm disabled:opacity-50"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {savingSettings ? "Đang lưu..." : "Lưu cài đặt"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Xác nhận dọn sạch ─────────────────────────────────────────── */}
      <AlertDialog
        open={purgeDialog !== null}
        onClose={() => setPurgeDialog(null)}
        title={purgeDialog === "filtered" ? "Xóa vĩnh viễn các mục đang lọc?" : "Dọn sạch thùng rác?"}
        description={
          purgeDialog === "filtered"
            ? `${data?.total ?? 0} mục đang khớp bộ lọc sẽ bị xóa vĩnh viễn và KHÔNG thể khôi phục.`
            : `Toàn bộ ${totalInBin} mục trong thùng rác sẽ bị xóa vĩnh viễn và KHÔNG thể khôi phục.`
        }
        confirmLabel="Xóa vĩnh viễn"
        variant="danger"
        loading={purging}
        onConfirm={handlePurge}
      />

      {/* ── Xác nhận xóa 1 mục ────────────────────────────────────────── */}
      <AlertDialog
        open={deleteRow !== null}
        onClose={() => setDeleteRow(null)}
        title="Xóa vĩnh viễn mục này?"
        description={`"${deleteRow?.label ?? ""}" sẽ bị xóa vĩnh viễn và KHÔNG thể khôi phục.`}
        confirmLabel="Xóa vĩnh viễn"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteRow}
      />

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
