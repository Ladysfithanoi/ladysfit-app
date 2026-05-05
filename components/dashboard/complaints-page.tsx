"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquareWarning, X, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Complaint = {
  id: string;
  category: string;
  content: string;
  status: "PENDING" | "PROCESSING" | "RESOLVED";
  fmNote: string | null;
  isReadByFM: boolean;
  createdAt: string;
  updatedAt: string;
  client: { id: string; fullName: string; phone: string };
  branch: { id: string; name: string };
  assignedFM: { id: string; name: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ xử lý",
  PROCESSING: "Đang xử lý",
  RESOLVED: "Đã giải quyết",
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-orange-100 text-orange-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
};

const TABS = [
  { key: "ALL", label: "Tất cả" },
  { key: "PENDING", label: "Chờ xử lý" },
  { key: "PROCESSING", label: "Đang xử lý" },
  { key: "RESOLVED", label: "Đã giải quyết" },
] as const;

type TabKey = "ALL" | "PENDING" | "PROCESSING" | "RESOLVED";

export function ComplaintsPage({ userRole }: { userRole: string }) {
  const isReadOnly = userRole === "CEO_FITPARTNER";
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("ALL");
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [fmNote, setFmNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const fetchComplaints = useCallback(async () => {
    try {
      const res = await fetch("/api/complaints");
      if (res.ok) setComplaints(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  const filtered = tab === "ALL" ? complaints : complaints.filter((c) => c.status === tab);

  function openComplaint(c: Complaint) {
    setSelected(c);
    setFmNote(c.fmNote ?? "");
    setSaveError("");
    if (!c.isReadByFM) {
      handleUpdateStatus(c.id, c.status, undefined, true);
      setComplaints((prev) => prev.map((x) => x.id === c.id ? { ...x, isReadByFM: true } : x));
    }
  }

  async function handleUpdateStatus(
    id: string,
    status?: "PENDING" | "PROCESSING" | "RESOLVED",
    note?: string,
    readOnly?: boolean,
  ) {
    const body: Record<string, unknown> = { isReadByFM: true };
    if (status) body.status = status;
    if (note !== undefined) body.fmNote = note;
    try {
      await fetch(`/api/complaints/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch { /* ignore */ }
    if (!readOnly) {
      await fetchComplaints();
    }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/complaints/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fmNote: fmNote || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Lỗi");
      setComplaints((prev) =>
        prev.map((c) => c.id === selected.id ? { ...c, fmNote: fmNote || null } : c)
      );
      setSelected((prev) => prev ? { ...prev, fmNote: fmNote || null } : prev);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetStatus(status: "PENDING" | "PROCESSING" | "RESOLVED") {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/complaints/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setComplaints((prev) =>
        prev.map((c) => c.id === selected.id ? { ...c, status } : c)
      );
      setSelected((prev) => prev ? { ...prev, status } : prev);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  const unreadCount = complaints.filter((c) => !c.isReadByFM).length;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <MessageSquareWarning className="w-6 h-6 text-orange-500" />
            Khiếu nại
            {unreadCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                {unreadCount} mới
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Quản lý và xử lý khiếu nại từ khách hàng</p>
        </div>
        <button
          onClick={fetchComplaints}
          className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
              tab === key ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {label}
            {key !== "ALL" && (
              <span className="ml-1.5 text-xs">
                ({complaints.filter((c) => c.status === key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-sm text-gray-400 font-semibold">Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquareWarning className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-300 font-semibold">Không có khiếu nại</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => openComplaint(c)}
              className={cn(
                "w-full text-left bg-white rounded-2xl p-4 border transition-all hover:shadow-md",
                !c.isReadByFM ? "border-orange-200 bg-orange-50/30" : "border-gray-100"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-bold text-gray-800">{c.client.fullName}</span>
                    <span className="text-xs text-gray-400">{c.branch.name}</span>
                    {!c.isReadByFM && (
                      <span className="px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">Mới</span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">{c.category}</p>
                  <p className="text-xs text-gray-400 line-clamp-2">{c.content}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", STATUS_STYLE[c.status])}>
                    {STATUS_LABEL[c.status]}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(c.createdAt).toLocaleDateString("vi-VN", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail slide-over */}
      <div
        className={cn(
          "fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40 transition-opacity duration-300",
          selected ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setSelected(null)}
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out",
          selected ? "translate-x-0" : "translate-x-full"
        )}
      >
        {selected && (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Chi tiết khiếu nại</h2>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Client info */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Khách hàng</p>
                <p className="text-sm font-extrabold text-gray-800">{selected.client.fullName}</p>
                <p className="text-xs text-gray-500">{selected.client.phone}</p>
                <p className="text-xs text-gray-400">{selected.branch.name}</p>
              </div>

              {/* Complaint details */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-1">Hạng mục</p>
                  <p className="text-sm font-semibold text-gray-800">{selected.category}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-1">Nội dung</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selected.content}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-1">Ngày gửi</p>
                  <p className="text-xs text-gray-400">
                    {new Date(selected.createdAt).toLocaleString("vi-VN", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {/* Status buttons */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">Trạng thái</p>
                {isReadOnly ? (
                  <span className={cn("px-3 py-1.5 rounded-xl text-xs font-bold", STATUS_STYLE[selected.status])}>
                    {STATUS_LABEL[selected.status]}
                  </span>
                ) : (
                  <div className="flex gap-2">
                    {(["PENDING", "PROCESSING", "RESOLVED"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSetStatus(s)}
                        disabled={saving || selected.status === s}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                          selected.status === s
                            ? STATUS_STYLE[s] + " ring-2 ring-offset-1 ring-current"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        )}
                      >
                        {s === "PENDING" && <Clock className="w-3 h-3 inline mr-1" />}
                        {s === "PROCESSING" && <RefreshCw className="w-3 h-3 inline mr-1" />}
                        {s === "RESOLVED" && <CheckCircle className="w-3 h-3 inline mr-1" />}
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* FM Note */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">Ghi chú xử lý</p>
                {isReadOnly ? (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-2xl px-4 py-3 min-h-[60px]">
                    {selected.fmNote ?? <span className="text-gray-300 italic">Chưa có ghi chú</span>}
                  </p>
                ) : (
                  <>
                    <textarea
                      value={fmNote}
                      onChange={(e) => setFmNote(e.target.value)}
                      rows={4}
                      placeholder="Ghi chú nội bộ về cách xử lý khiếu nại này..."
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50 resize-none"
                    />
                    {saveError && <p className="text-xs text-red-500 mt-1">{saveError}</p>}
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="mt-2 w-full h-10 rounded-xl text-white text-sm font-bold disabled:opacity-60"
                      style={{ backgroundColor: "#f15b5c" }}
                    >
                      {saving ? "Đang lưu..." : "Lưu ghi chú"}
                    </button>
                  </>
                )}
              </div>

              {/* Assigned FM */}
              {selected.assignedFM && (
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-xs font-bold text-gray-500 mb-1">Phụ trách</p>
                  <p className="text-sm font-semibold text-gray-700">{selected.assignedFM.name}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
