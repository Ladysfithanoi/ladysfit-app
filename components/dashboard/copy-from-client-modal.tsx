"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Dumbbell,
  Eye,
  Loader2,
  Search,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export type CopiedMovement = {
  movementCode: string;
  movementName: string;
  selectedExercise: string;
  sets: number;
  reps: string;
  order: number;
};

export type CopiedSession = {
  sessionName: string;
  sessionType: string;
  order: number;
  movements: CopiedMovement[];
};

type PTClient = {
  id: string;
  fullName: string;
  phone: string;
  status: string;
  packageEnrollments: { packageName: string }[];
};

type ApiMovement = {
  movementCode: string;
  movementName: string;
  selectedExercise: string;
  sets: number;
  reps: string;
  order: number;
};
type ApiSession = { sessionName: string; order: number; movements: ApiMovement[] };
type ApiWeek = { id: string; weekNumber: number; sessions: ApiSession[] };
type ApiProgram = {
  id: string;
  phase: string;
  status: string;
  currentWeek: number;
  weeks: ApiWeek[];
};

type ClientWeek = { weekNumber: number; phase: string; sessions: CopiedSession[] };

const PER_PAGE = 4;
const BRAND = "#f15b5c";

// ── Helpers ────────────────────────────────────────────────────────────────

function sessionTypeOf(sessionName: string): string {
  return sessionName.includes("—") ? sessionName.split("—").slice(1).join("—").trim() : "";
}

/** Chọn chương trình đang áp dụng (hoặc mới nhất) + tuần hiện tại của khách. */
function resolveWeek(programs: ApiProgram[]): ClientWeek | null {
  if (!programs || programs.length === 0) return null;
  const prog = programs.find((p) => p.status === "ACTIVE") ?? programs[0];
  if (!prog || prog.weeks.length === 0) return null;
  const week =
    prog.weeks.find((w) => w.weekNumber === prog.currentWeek) ?? prog.weeks[prog.weeks.length - 1];
  if (!week) return null;
  const sessions: CopiedSession[] = week.sessions.map((s) => ({
    sessionName: s.sessionName,
    sessionType: sessionTypeOf(s.sessionName),
    order: s.order,
    movements: s.movements.map((m) => ({
      movementCode: m.movementCode,
      movementName: m.movementName,
      selectedExercise: m.selectedExercise,
      sets: m.sets,
      reps: m.reps,
      order: m.order,
    })),
  }));
  return { weekNumber: week.weekNumber, phase: prog.phase, sessions };
}

// ── Component ──────────────────────────────────────────────────────────────

export function CopyFromClientModal({
  open,
  onClose,
  onApply,
  excludeClientId,
}: {
  open: boolean;
  onClose: () => void;
  /**
   * Được gọi khi PT xác nhận sao chép; trả về tên khách, các buổi trong tuần và
   * danh sách VỊ TRÍ buổi được chọn (chỉ những buổi này mới được điền sang).
   */
  onApply: (clientName: string, sessions: CopiedSession[], sessionIndices: number[]) => void;
  /** Ẩn 1 khách khỏi danh sách (thường là khách đang được soạn giáo án). */
  excludeClientId?: string;
}) {
  const [clients, setClients] = useState<PTClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState("");
  const [page, setPage] = useState(0);

  // Cache chương trình đã tải theo từng khách để không phải gọi lại API.
  const [cache, setCache] = useState<Record<string, ClientWeek | null>>({});

  // Preview 1 khách (modal con)
  const [previewClient, setPreviewClient] = useState<PTClient | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<ClientWeek | null>(null);
  const [previewSessionIdx, setPreviewSessionIdx] = useState(0);
  // Vị trí các buổi được chọn để sao chép (mặc định chọn tất cả khi mở preview).
  const [selectedSessions, setSelectedSessions] = useState<Set<number>>(new Set());

  // Hộp xác nhận nhỏ trước khi sao chép
  const [pendingClient, setPendingClient] = useState<PTClient | null>(null);
  const [copying, setCopying] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  // ── Load PT's clients on open ────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: PTClient[]) => {
        setClients(Array.isArray(data) ? data.filter((c) => c.id !== excludeClientId) : []);
      })
      .catch(() => setError("Không tải được danh sách khách hàng"))
      .finally(() => setLoading(false));
  }, [open, excludeClientId]);

  // Reset bộ lọc / trang khi mở lại
  useEffect(() => {
    if (open) {
      setSearch("");
      setPackageFilter("");
      setPage(0);
      setPreviewClient(null);
      setPendingClient(null);
      setSelectedSessions(new Set());
    }
  }, [open]);

  const packageNames = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) {
      const pkg = c.packageEnrollments[0]?.packageName;
      if (pkg) set.add(pkg);
    }
    return Array.from(set).sort();
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      const pkg = c.packageEnrollments[0]?.packageName ?? "";
      const matchesText =
        q === "" ||
        c.fullName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q);
      const matchesPkg = packageFilter === "" || pkg === packageFilter;
      return matchesText && matchesPkg;
    });
  }, [clients, search, packageFilter]);

  // Trang hiện tại luôn nằm trong khoảng hợp lệ khi bộ lọc thay đổi.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  useEffect(() => {
    if (page > pageCount - 1) setPage(0);
  }, [pageCount, page]);
  const pageItems = filtered.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  const loadClientWeek = useCallback(
    async (clientId: string): Promise<ClientWeek | null> => {
      if (clientId in cache) return cache[clientId];
      const res = await fetch(`/api/clients/${clientId}/programs`);
      const programs: ApiProgram[] = res.ok ? await res.json() : [];
      const resolved = resolveWeek(programs);
      setCache((prev) => ({ ...prev, [clientId]: resolved }));
      return resolved;
    },
    [cache]
  );

  function openPreview(client: PTClient) {
    setPreviewClient(client);
    setPreviewSessionIdx(0);
    setPreviewData(null);
    setSelectedSessions(new Set());
    setPreviewLoading(true);
    loadClientWeek(client.id)
      .then((data) => {
        setPreviewData(data);
        // Mặc định chọn tất cả các buổi.
        setSelectedSessions(new Set((data?.sessions ?? []).map((_, i) => i)));
      })
      .finally(() => setPreviewLoading(false));
  }

  function toggleSession(i: number) {
    setSelectedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function toggleAllSessions() {
    const total = previewData?.sessions.length ?? 0;
    setSelectedSessions((prev) =>
      prev.size >= total ? new Set() : new Set(Array.from({ length: total }, (_, i) => i))
    );
  }

  async function confirmCopy() {
    if (!pendingClient) return;
    setCopying(true);
    setConfirmError("");
    try {
      const fromPreview = previewClient?.id === pendingClient.id;
      const data = fromPreview && previewData
        ? previewData
        : await loadClientWeek(pendingClient.id);
      if (!data || data.sessions.length === 0) {
        setConfirmError("Khách này chưa có lịch tập để sao chép");
        setCopying(false);
        return;
      }
      // Sao chép từ preview: dùng các buổi đã chọn. Sao chép nhanh từ danh sách:
      // chọn tất cả các buổi.
      const indices =
        fromPreview && selectedSessions.size > 0
          ? Array.from(selectedSessions).sort((a, b) => a - b)
          : data.sessions.map((_, i) => i);
      onApply(pendingClient.fullName, data.sessions, indices);
      setPendingClient(null);
      setPreviewClient(null);
      onClose();
    } catch {
      setConfirmError("Có lỗi xảy ra, thử lại nhé");
    } finally {
      setCopying(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND}15` }}>
              <Users className="w-4 h-4" style={{ color: BRAND }} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-gray-900 leading-tight">Sao chép lịch khách</h3>
              <p className="text-[11px] text-gray-400">Chọn khách để xem trước &amp; sao chép giáo án 1 tuần</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 pt-4 pb-2 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Tìm theo tên hoặc số điện thoại..."
              className="w-full h-10 rounded-xl border border-gray-200 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
            />
          </div>
          <select
            value={packageFilter}
            onChange={(e) => { setPackageFilter(e.target.value); setPage(0); }}
            className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
          >
            <option value="">Tất cả lộ trình</option>
            {packageNames.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Client list */}
        <div className="flex-1 overflow-y-auto px-5 py-2 min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <span className="text-xs">Đang tải danh sách...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400">
              <span className="text-xs text-red-500 font-medium">{error}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-300">
              <Users className="w-9 h-9 mb-2" />
              <span className="text-sm font-semibold">
                {clients.length === 0 ? "Bạn chưa có khách hàng nào" : "Không tìm thấy khách phù hợp"}
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {pageItems.map((c) => {
                const pkg = c.packageEnrollments[0]?.packageName;
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-100 hover:border-[#f15b5c]/40 transition-colors p-3"
                  >
                    <button
                      onClick={() => openPreview(c)}
                      className="flex-1 min-w-0 text-left"
                      title="Xem trước lịch tập của khách"
                    >
                      <p className="text-sm font-bold text-gray-800 truncate">{c.fullName}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="text-[11px] text-gray-400">{c.phone}</span>
                        {pkg && (
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                            {pkg}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => openPreview(c)}
                      className="flex-shrink-0 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Xem</span>
                    </button>
                    <button
                      onClick={() => { setPendingClient(c); setConfirmError(""); }}
                      className="flex-shrink-0 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-bold text-white transition-colors"
                      style={{ backgroundColor: BRAND }}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Sao chép</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && filtered.length > PER_PAGE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
            <span className="text-xs text-gray-400">
              {filtered.length} khách · Trang {page + 1}/{pageCount}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Preview modal (con) ── */}
      {previewClient && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-gray-900 truncate">{previewClient.fullName}</h3>
                <p className="text-[11px] text-gray-400">
                  {previewData
                    ? `${previewData.phase} · Tuần ${previewData.weekNumber}`
                    : "Xem trước lịch tập"}
                </p>
              </div>
              <button onClick={() => setPreviewClient(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <span className="text-xs">Đang tải lịch tập...</span>
                </div>
              ) : !previewData || previewData.sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-gray-300">
                  <Dumbbell className="w-9 h-9 mb-2" />
                  <span className="text-sm font-semibold">Khách này chưa có lịch tập</span>
                </div>
              ) : (
                <>
                  {/* Chọn buổi để sao chép */}
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={toggleAllSessions}
                      className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-800"
                    >
                      <span
                        className={cn(
                          "w-4 h-4 rounded-[5px] border flex items-center justify-center transition-colors",
                          selectedSessions.size >= previewData.sessions.length
                            ? "border-transparent"
                            : "border-gray-300 bg-white"
                        )}
                        style={
                          selectedSessions.size >= previewData.sessions.length
                            ? { backgroundColor: BRAND }
                            : undefined
                        }
                      >
                        {selectedSessions.size >= previewData.sessions.length && (
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        )}
                      </span>
                      Chọn tất cả
                    </button>
                    <span className="text-[11px] text-gray-400">
                      Đã chọn {selectedSessions.size}/{previewData.sessions.length} buổi
                    </span>
                  </div>

                  {/* Session tabs (bấm tên để xem, bấm ô vuông để chọn/bỏ chọn) */}
                  <div className="flex gap-1 overflow-x-auto pb-1 mb-3">
                    {previewData.sessions.map((s, i) => {
                      const active = i === previewSessionIdx;
                      const checked = selectedSessions.has(i);
                      return (
                        <div
                          key={i}
                          onClick={() => setPreviewSessionIdx(i)}
                          className={cn(
                            "flex-shrink-0 flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer",
                            active
                              ? "text-white border-transparent"
                              : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                          )}
                          style={active ? { backgroundColor: BRAND } : undefined}
                        >
                          <span
                            role="checkbox"
                            aria-checked={checked}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSession(i);
                            }}
                            className={cn(
                              "w-4 h-4 rounded-[5px] border flex items-center justify-center transition-colors",
                              checked
                                ? active
                                  ? "bg-white border-white"
                                  : "border-transparent"
                                : active
                                  ? "border-white/70 bg-transparent"
                                  : "border-gray-300 bg-white"
                            )}
                            style={checked && !active ? { backgroundColor: BRAND } : undefined}
                          >
                            {checked && (
                              <Check
                                className="w-3 h-3"
                                strokeWidth={3}
                                style={{ color: active ? BRAND : "#fff" }}
                              />
                            )}
                          </span>
                          Buổi {i + 1}
                        </div>
                      );
                    })}
                  </div>

                  {previewData.sessions[previewSessionIdx] && (
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      {previewData.sessions[previewSessionIdx].sessionType && (
                        <div className="px-4 py-2 bg-gray-50/70 border-b border-gray-100">
                          <span className="text-xs font-semibold text-gray-500">
                            {previewData.sessions[previewSessionIdx].sessionType}
                          </span>
                        </div>
                      )}
                      <div className="px-4 py-3 overflow-x-auto">
                        <table className="w-full min-w-[320px]">
                          <thead>
                            <tr className="border-b border-gray-100">
                              {["Chuyển động", "Bài tập", "Lượng"].map((h) => (
                                <th key={h} className="pb-2 text-left text-xs font-bold text-gray-400 pr-3">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.sessions[previewSessionIdx].movements.map((m, mi) => (
                              <tr key={m.movementCode + mi} className="border-b border-gray-50 last:border-0">
                                <td className="py-2 pr-3 text-xs font-semibold text-gray-600 whitespace-nowrap">{m.movementName}</td>
                                <td className="py-2 pr-3 text-sm font-medium text-gray-800">
                                  {m.selectedExercise || <span className="text-gray-300 italic text-xs">Chưa chọn</span>}
                                </td>
                                <td className="py-2 text-sm text-gray-500 whitespace-nowrap">{m.sets} × {m.reps}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-gray-50">
              <button
                onClick={() => { setPendingClient(previewClient); setConfirmError(""); }}
                disabled={!previewData || previewData.sessions.length === 0 || selectedSessions.size === 0}
                className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: BRAND }}
              >
                <Copy className="w-4 h-4" />
                {selectedSessions.size > 0 && previewData && selectedSessions.size < previewData.sessions.length
                  ? `Sao chép ${selectedSessions.size} buổi`
                  : "Sao chép lịch này"}
              </button>
              <button
                onClick={() => setPreviewClient(null)}
                className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm toast (nhỏ, theo màu thương hiệu) ── */}
      {pendingClient && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs overflow-hidden">
            <div className="h-1.5 w-full" style={{ backgroundColor: BRAND }} />
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BRAND}15` }}>
                  <Copy className="w-5 h-5" style={{ color: BRAND }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900">Sao chép lịch tập?</p>
                  <p className="text-[11px] text-gray-400 truncate">từ khách {pendingClient.fullName}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Các bài tập phù hợp sẽ được điền vào giáo án đang soạn. Bạn vẫn có thể chỉnh sửa lại sau khi sao chép.
              </p>
              {confirmError && <p className="text-xs text-red-500 font-medium">{confirmError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={confirmCopy}
                  disabled={copying}
                  className="flex-1 h-9 rounded-xl text-white text-xs font-bold disabled:opacity-60 flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: BRAND }}
                >
                  {copying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Sao chép"}
                </button>
                <button
                  onClick={() => { if (!copying) { setPendingClient(null); setConfirmError(""); } }}
                  disabled={copying}
                  className="h-9 px-4 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
