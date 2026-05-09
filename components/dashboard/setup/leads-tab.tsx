"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SalesLead, LeadStatus, LEAD_STATUS_LABEL, LEAD_STATUS_STYLE, SOURCES, PTUser,
} from "./types";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { fmtDate } from "@/lib/format-date";

type Props = {
  branchId: string;
  branchName: string;
  month: number;
  year: number;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  isReadOnly: boolean;
  isPT: boolean;
  isFM: boolean;
  isCEO: boolean;
  ptList: PTUser[];
  selectedPTId: string;
  selectedSource: string;
  selectedStatus: string;
};

const STATUS_OPTIONS: LeadStatus[] = ["TAKECARE", "FAIL", "DE", "PIF", "PB"];
const REGISTERED_STATUSES: LeadStatus[] = ["DE", "PIF", "PB"];

// ── Note helpers ──────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().split("T")[0]; }

type NoteEntry = { date: string; text: string };

function parseNoteEntries(raw: string): NoteEntry[] {
  if (!raw.trim()) return [];
  return raw
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const m = /^-?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[:\s]\s*([\s\S]+)$/.exec(line);
      if (m) {
        const parts = m[1].split("/");
        return {
          date: `${parts[0].padStart(2,"0")}/${parts[1].padStart(2,"0")}/${parts[2]}`,
          text: m[2].trim(),
        };
      }
      return { date: "", text: line.replace(/^-\s*/, "") };
    });
}

function getLastNoteDate(notes: string): Date | null {
  const lines = notes.split("\n").reverse();
  for (const line of lines) {
    const m = /^-?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(line.trim());
    if (m) {
      const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function needsReminder(notes: string | null | undefined): boolean {
  if (!notes?.trim()) return true;
  const last = getLastNoteDate(notes);
  if (!last) return true;
  return (Date.now() - last.getTime()) > 3 * 24 * 60 * 60 * 1000;
}

// ── Main component ────────────────────────────────────────────────────────────

export function LeadsTab({
  branchId, branchName, month, year,
  currentUserId, currentUserName,
  isPT, isFM,
  ptList, selectedPTId, selectedSource, selectedStatus,
}: Props) {
  const isFitpartner = branchName.toLowerCase().includes("fitpartner");
  const [leads, setLeads]                   = useState<SalesLead[]>([]);
  const [loading, setLoading]               = useState(true);
  const [formOpen, setFormOpen]             = useState(false);
  const [editing, setEditing]               = useState<SalesLead | null>(null);
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState("");
  const [collapsedPTs, setCollapsedPTs]     = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete]   = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting]             = useState(false);
  const [successToast, setSuccessToast]     = useState("");
  const [toastIsError, setToastIsError]     = useState(false);
  const [carryOverDialogOpen, setCarryOverDialogOpen] = useState(false);
  const [carrying, setCarrying]             = useState(false);
  const [careNotesLead, setCareNotesLead]   = useState<SalesLead | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen]     = useState(false);
  const [bulkSending, setBulkSending]             = useState(false);

  const [form, setForm] = useState<Partial<SalesLead & { signDateStr: string }>>({});

  const fetchLeads = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/setup/leads?branchId=${branchId}&month=${month}&year=${year}`);
      if (res.ok) setLeads(await res.json());
    } finally {
      setLoading(false);
    }
  }, [branchId, month, year]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  function openAdd() {
    setEditing(null);
    setForm({ status: "TAKECARE", assignedPTId: (isPT || isFM) ? currentUserId : undefined });
    setError("");
    setFormOpen(true);
  }

  function openEdit(lead: SalesLead) {
    setEditing(lead);
    setForm({ ...lead, signDateStr: lead.signDate ? lead.signDate.split("T")[0] : "" });
    setError("");
    setFormOpen(true);
  }

  function closeForm() { setFormOpen(false); setEditing(null); setError(""); }

  async function handleSave() {
    if (!form.customerName?.trim()) { setError("Tên khách hàng không được để trống"); return; }
    if (!form.assignedPTId) { setError("Vui lòng chọn PT phụ trách"); return; }
    setSaving(true);
    setError("");
    const body = { branchId, month, year, ...form, signDate: form.signDateStr || null };
    try {
      const url = editing ? `/api/setup/leads/${editing.id}` : "/api/setup/leads";
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Lỗi");
      closeForm();
      fetchLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string, name: string) {
    setPendingDelete({ id, name });
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/setup/leads/${pendingDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        const deletedName = pendingDelete.name;
        setLeads(prev => prev.filter(l => l.id !== pendingDelete.id));
        setDeleteDialogOpen(false);
        setPendingDelete(null);
        setSuccessToast(`Đã xóa lead "${deletedName}" thành công`);
        setTimeout(() => setSuccessToast(""), 3000);
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleCarryOver() {
    setCarrying(true);
    try {
      const res = await fetch("/api/setup/carry-over", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, month, year }),
      });
      if (res.ok) {
        const { carried, nextMonth, nextYear } = await res.json() as { carried: number; skipped: number; nextMonth: number; nextYear: number };
        setCarryOverDialogOpen(false);
        setSuccessToast(`Đã chuyển ${carried} lead sang tháng ${nextMonth}/${nextYear}`);
        setTimeout(() => setSuccessToast(""), 4000);
      }
    } finally {
      setCarrying(false);
    }
  }

  function showToast(msg: string, isError = false) {
    setToastIsError(isError);
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(""), isError ? 4000 : 3000);
  }

  async function handleSendReminder(lead: SalesLead) {
    setSendingReminderId(lead.id);
    try {
      const res = await fetch("/api/notifications/lead-reminder", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ assignedPTId: lead.assignedPTId, customerName: lead.customerName }),
      });
      if (res.ok) {
        const ptName = lead.assignedPT.name ?? lead.assignedPT.email;
        showToast(`Đã gửi nhắc nhở đến ${ptName} về KH ${lead.customerName}`);
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string; message?: string; code?: string; role?: string };
        const msg = data.error === "Forbidden"
          ? `Không có quyền (role: ${data.role ?? "?"})`
          : data.message
          ? `Lỗi: ${data.message}`
          : `Lỗi ${res.status}`;
        showToast(msg, true);
        console.error("[handleSendReminder]", res.status, data);
      }
    } catch {
      showToast("Lỗi kết nối!", true);
    } finally {
      setSendingReminderId(null);
    }
  }

  async function handleBulkReminder() {
    setBulkSending(true);
    try {
      const entries = Object.values(visibleGrouped)
        .flat()
        .filter(l => l.assignedPTId !== currentUserId && needsReminder(l.notes))
        .map(l => ({ assignedPTId: l.assignedPTId, customerName: l.customerName }));

      const res = await fetch("/api/notifications/lead-reminder", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ entries }),
      });
      if (res.ok) {
        const { sent, ptCount } = await res.json() as { sent: number; ptCount: number };
        setBulkConfirmOpen(false);
        showToast(`Đã gửi ${sent} nhắc nhở đến ${ptCount} PT`);
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string; message?: string; code?: string; role?: string };
        const msg = data.message ? `Lỗi: ${data.message}` : `Lỗi ${res.status}`;
        showToast(msg, true);
        console.error("[handleBulkReminder]", res.status, data);
      }
    } catch {
      showToast("Lỗi kết nối!", true);
    } finally {
      setBulkSending(false);
    }
  }

  function togglePT(ptId: string) {
    setCollapsedPTs(prev => {
      const next = new Set(prev);
      if (next.has(ptId)) next.delete(ptId); else next.add(ptId);
      return next;
    });
  }

  const grouped = leads.reduce<Record<string, SalesLead[]>>((acc, l) => {
    if (!acc[l.assignedPTId]) acc[l.assignedPTId] = [];
    acc[l.assignedPTId].push(l);
    return acc;
  }, {});

  const visibleGrouped: Record<string, SalesLead[]> = Object.fromEntries(
    Object.entries(grouped)
      .filter(([ptId]) => !selectedPTId || ptId === selectedPTId)
      .map(([ptId, ptLeads]) => [
        ptId,
        ptLeads.filter(
          l => (!selectedSource || l.source === selectedSource) &&
               (!selectedStatus || l.status === selectedStatus)
        ),
      ])
      .filter(([, ptLeads]) => (ptLeads as SalesLead[]).length > 0)
  );

  const visibleLeads = Object.values(visibleGrouped).flat();
  const branchTotal = {
    revenue:           visibleLeads.reduce((s, l) => s + (l.actualRevenue ?? 0), 0),
    fitpartnerRevenue: visibleLeads.reduce((s, l) => s + (l.fitpartnerRevenue ?? 0), 0),
    registered:        visibleLeads.filter(l => REGISTERED_STATUSES.includes(l.status)).length,
    takecare:          visibleLeads.filter(l => l.status === "TAKECARE").length,
    total:             visibleLeads.length,
  };

  const canMutate    = isPT || isFM;
  const nextMonth    = month === 12 ? 1 : month + 1;
  const nextYear     = month === 12 ? year + 1 : year;
  const carryableLeads = leads.filter(l => l.status === "TAKECARE" || l.status === "DE");

  // Leads that need a reminder (FM can send) — excludes FM's own leads
  const reminderLeads = isFM
    ? Object.values(visibleGrouped).flat().filter(l =>
        l.assignedPTId !== currentUserId && needsReminder(l.notes)
      )
    : [];

  // Count unique PTs for bulk confirm message
  const reminderPTCount = new Set(reminderLeads.map(l => l.assignedPTId)).size;

  return (
    <div>
      {/* Branch summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Tổng doanh thu",    value: `${branchTotal.revenue.toFixed(1)} tr`,           color: "text-emerald-600" },
          ...(isFitpartner ? [{ label: "Doanh thu Fitpartner", value: `${branchTotal.fitpartnerRevenue.toFixed(1)} tr`, color: "text-purple-600" }] : []),
          { label: "KH đăng ký",        value: branchTotal.registered,                            color: "text-blue-600" },
          { label: "Đang chăm sóc",     value: branchTotal.takecare,                              color: "text-yellow-600" },
          { label: "Tổng lead",         value: branchTotal.total,                                 color: "text-gray-700" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className={cn("text-2xl font-black", s.color)}>{s.value}</p>
            <p className="text-xs font-semibold text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Action bar */}
      {(isPT || isFM) && (
        <div className="flex flex-wrap justify-end gap-3 mb-4">
          {/* Bulk remind — FM only */}
          {isFM && reminderLeads.length > 0 && (
            <button
              onClick={() => setBulkConfirmOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 border-amber-400 text-amber-600 hover:bg-amber-50 transition-colors"
            >
              ⚠️ Nhắc tất cả PT ({reminderLeads.length})
            </button>
          )}
          {isFM && carryableLeads.length > 0 && (
            <button
              onClick={() => setCarryOverDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 border-[#f15b5c] text-[#f15b5c] hover:bg-[#f15b5c]/5 transition-colors"
            >
              📤 Đẩy sang tháng sau
            </button>
          )}
          {(isPT || isFM) && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold shadow-sm"
              style={{ backgroundColor: "#f15b5c" }}
            >
              <Plus className="w-4 h-4" /> Thêm Lead
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Đang tải...</div>
      ) : Object.keys(visibleGrouped).length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-300">
          {selectedPTId || selectedSource || selectedStatus
            ? "Không có lead nào khớp với bộ lọc đã chọn"
            : "Chưa có lead nào tháng này"}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(visibleGrouped).map(([ptId, ptLeads]) => {
            const pt           = ptLeads[0].assignedPT;
            const collapsed    = collapsedPTs.has(ptId);
            const ptRevenue    = ptLeads.reduce((s, l) => s + (l.actualRevenue ?? 0), 0);
            const ptRegistered = ptLeads.filter(l => REGISTERED_STATUSES.includes(l.status)).length;
            const isFMGroup    = ptId === currentUserId && isFM;

            return (
              <div key={ptId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Group header */}
                <button
                  onClick={() => togglePT(ptId)}
                  className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                      isFMGroup ? "bg-purple-100" : "bg-[#f15b5c]/10"
                    )}>
                      <span className={cn("text-xs font-black", isFMGroup ? "text-purple-600" : "text-[#f15b5c]")}>
                        {(pt.name ?? pt.email)[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-extrabold text-gray-800">
                      {isFMGroup ? "FM" : "PT"} {pt.name ?? pt.email}
                    </span>
                    <span className="text-xs text-gray-400">
                      {ptLeads.length} lead · {ptRevenue.toFixed(1)} tr · {ptRegistered} đăng ký
                    </span>
                  </div>
                  {collapsed
                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                    : <ChevronUp   className="w-4 h-4 text-gray-400" />}
                </button>

                {!collapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 bg-[#f5f5f5] divide-x divide-gray-200">
                          {[
                            "STT", "Khách hàng", "NĂM SINH", "SĐT", "Nguồn",
                            "Chăm sóc", "Dự báo", "Tình trạng", "Gói tập",
                            "DT (tr)", "Còn thiếu",
                            ...(isFitpartner ? ["DT Fitpartner (tr)"] : []),
                            "Ngày ký", "Ghi chú",
                            ...(canMutate ? [""] : []),
                          ].map((h, i) => (
                            <th
                              key={i}
                              className={cn(
                                "px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap",
                                i === 0 && "sticky left-0 z-10 bg-[#f5f5f5]",
                                i === 1 && "sticky left-10 z-10 bg-[#f5f5f5]",
                              )}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ptLeads.map((l, idx) => {
                          const isOwnLead  = l.assignedPTId === currentUserId;
                          const warnRow    = isPT && isOwnLead && !l.notes?.trim();
                          const warnBanner = needsReminder(l.notes);

                          return (
                            <tr
                              key={l.id}
                              className={cn(
                                "border-b border-gray-100 last:border-0 hover:bg-gray-50/50 even:bg-[#fafafa] divide-x divide-gray-100",
                                warnRow && "border-l-[3px] border-l-amber-400"
                              )}
                            >
                              <td className="px-3 py-2.5 text-gray-400 sticky left-0 z-10 bg-inherit">{idx + 1}</td>

                              {/* Customer name + badges */}
                              <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap sticky left-10 z-10 bg-inherit">
                                <span>{l.customerName}</span>
                                {warnRow && (
                                  <span className="ml-1.5 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                    Cần cập nhật
                                  </span>
                                )}
                                {l.notes?.includes("[Chuyển từ tháng") && (
                                  <span className="ml-1.5 text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                    🔄 Chuyển tháng
                                  </span>
                                )}
                                {l.consultationId && (
                                  <a
                                    href={`/dashboard/consultation/${l.consultationId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1.5 text-[10px] font-semibold text-blue-500 hover:text-blue-700 whitespace-nowrap"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    📋 Tư vấn
                                  </a>
                                )}
                              </td>

                              <td className="px-3 py-2.5 text-gray-500">{l.yearOfBirth ?? "—"}</td>
                              <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{l.phone ?? "—"}</td>
                              <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{l.source ?? "—"}</td>

                              {/* Chăm sóc — clickable with warning indicator */}
                              <td className="px-3 py-2.5 max-w-[140px]">
                                <button
                                  onClick={() => setCareNotesLead(l)}
                                  className="text-left w-full group cursor-pointer"
                                >
                                  {l.notes?.trim() ? (
                                    <span className="flex items-center gap-1">
                                      <span className="block max-w-[100px] truncate text-gray-500 group-hover:text-[#f15b5c] transition-colors">
                                        {l.notes.length > 25 ? l.notes.slice(0, 25) + "…" : l.notes}
                                      </span>
                                      {warnBanner && <span className="flex-shrink-0 text-amber-500">⚠️</span>}
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-amber-500 group-hover:text-amber-600 transition-colors">
                                      <span>⚠️</span>
                                      <span className="text-[10px] font-semibold">Chưa cập nhật</span>
                                    </span>
                                  )}
                                </button>
                              </td>

                              <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{l.forecast ?? "—"}</td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span className={cn("px-2 py-0.5 rounded-full font-bold", LEAD_STATUS_STYLE[l.status])}>
                                  {LEAD_STATUS_LABEL[l.status]}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{l.packageRegistered ?? "—"}</td>
                              <td className="px-3 py-2.5 font-semibold text-emerald-600 whitespace-nowrap">
                                {l.actualRevenue != null ? l.actualRevenue.toFixed(1) : "—"}
                              </td>
                              <td className="px-3 py-2.5 text-orange-500 whitespace-nowrap">
                                {l.remainingPayment != null ? l.remainingPayment.toFixed(1) : "—"}
                              </td>
                              {isFitpartner && (
                                <td className="px-3 py-2.5 font-semibold text-purple-600 whitespace-nowrap">
                                  {l.fitpartnerRevenue != null ? l.fitpartnerRevenue.toFixed(1) : "—"}
                                </td>
                              )}
                              <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                                {l.signDate ? fmtDate(l.signDate) : "—"}
                              </td>
                              <td className="px-3 py-2.5 text-gray-400 max-w-[120px]">
                                <p className="truncate" title={l.remark ?? ""}>{l.remark ?? "—"}</p>
                              </td>

                              {/* Actions */}
                              {canMutate && (
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    {(isFM || isOwnLead) && (
                                      <>
                                        <button onClick={() => openEdit(l)} className="text-gray-400 hover:text-[#f15b5c]">
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDelete(l.id, l.customerName)} className="text-gray-400 hover:text-red-500">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                    {/* Nhắc PT — FM only, not for FM's own leads */}
                                    {isFM && !isOwnLead && warnBanner && (
                                      <button
                                        onClick={() => handleSendReminder(l)}
                                        disabled={sendingReminderId === l.id}
                                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border border-amber-400 text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                                      >
                                        {sendingReminderId === l.id ? "..." : "🔔 Nhắc PT"}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50/80 font-bold">
                          <td colSpan={9} className="px-3 py-2 text-xs text-gray-500">
                            Tổng: {ptLeads.length} lead · {ptRegistered} đăng ký
                          </td>
                          <td className="px-3 py-2 text-xs text-emerald-600">{ptRevenue.toFixed(1)}</td>
                          {isFitpartner ? (
                            <>
                              <td />
                              <td className="px-3 py-2 text-xs text-purple-600">
                                {ptLeads.reduce((s, l) => s + (l.fitpartnerRevenue ?? 0), 0).toFixed(1)}
                              </td>
                            </>
                          ) : (
                            <td />
                          )}
                          <td colSpan={canMutate ? 3 : 2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Status legend */}
      <div className="mt-6 bg-gray-50 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Chú giải</p>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map(s => (
            <span key={s} className={cn("px-2.5 py-1 rounded-full text-xs font-bold", LEAD_STATUS_STYLE[s])}>
              {s} = {LEAD_STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </div>

      {/* Delete dialog */}
      <AlertDialog
        open={deleteDialogOpen}
        onClose={() => { if (!deleting) { setDeleteDialogOpen(false); setPendingDelete(null); } }}
        title="Xóa lead khách hàng"
        description={`Bạn có chắc muốn xóa lead "${pendingDelete?.name}"?\nHành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />

      {/* Carry-over dialog */}
      <AlertDialog
        open={carryOverDialogOpen}
        onClose={() => { if (!carrying) setCarryOverDialogOpen(false); }}
        title={`Đẩy lead sang tháng ${nextMonth}/${nextYear}`}
        description={`Chuyển tất cả lead đang chăm sóc và đặt cọc sang tháng ${nextMonth}/${nextYear}?\nSẽ có ${carryableLeads.length} lead được chuyển (đã có ở tháng sau sẽ bỏ qua).`}
        confirmLabel="Đẩy sang tháng sau"
        cancelLabel="Hủy"
        onConfirm={handleCarryOver}
        loading={carrying}
      />

      {/* Bulk reminder confirm dialog */}
      <AlertDialog
        open={bulkConfirmOpen}
        onClose={() => { if (!bulkSending) setBulkConfirmOpen(false); }}
        title="Nhắc nhở chăm sóc khách hàng"
        description={`Sẽ gửi ${reminderLeads.length} nhắc nhở đến ${reminderPTCount} PT chưa cập nhật. Tiếp tục?`}
        confirmLabel="Gửi nhắc nhở"
        cancelLabel="Hủy"
        onConfirm={handleBulkReminder}
        loading={bulkSending}
      />

      {/* Toast */}
      {successToast && (
        <div className={cn(
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg",
          toastIsError ? "bg-red-600" : "bg-gray-900"
        )}>
          {successToast}
        </div>
      )}

      {/* Care notes popup */}
      {careNotesLead && (
        <CareNotesPopup
          lead={careNotesLead}
          canEdit={isFM || (isPT && careNotesLead.assignedPTId === currentUserId)}
          onClose={() => setCareNotesLead(null)}
          onUpdated={(id, newNotes) => {
            setLeads(prev => prev.map(l => l.id === id ? { ...l, notes: newNotes } : l));
            setCareNotesLead(prev => prev ? { ...prev, notes: newNotes } : null);
          }}
        />
      )}

      {/* Lead form slide-over */}
      {formOpen && (
        <>
          <div className="fixed inset-0 bg-black/25 z-40" onClick={closeForm} />
          <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold">{editing ? "Sửa Lead" : "Thêm Lead mới"}</h2>
              <button onClick={closeForm}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <FormRow label="Khách hàng *">
                <input
                  value={form.customerName ?? ""}
                  onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                  className={inputCls}
                  placeholder="Nguyễn Thị B"
                />
              </FormRow>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Năm sinh">
                  <input
                    type="number"
                    value={form.yearOfBirth ?? ""}
                    onChange={e => setForm(f => ({ ...f, yearOfBirth: e.target.value ? parseInt(e.target.value) : undefined }))}
                    className={inputCls}
                    placeholder="1995"
                  />
                </FormRow>
                <FormRow label="Số điện thoại">
                  <input
                    value={form.phone ?? ""}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className={inputCls}
                    placeholder="0901234567"
                  />
                </FormRow>
              </div>
              {isPT ? (
                <FormRow label="PT phụ trách">
                  <input
                    value={ptList.find(p => p.id === currentUserId)?.name ?? "Bạn"}
                    readOnly
                    className={`${inputCls} bg-gray-100 text-gray-500 cursor-not-allowed`}
                  />
                </FormRow>
              ) : isFM ? (
                <FormRow label="PT phụ trách *">
                  <select
                    value={form.assignedPTId ?? currentUserId}
                    onChange={e => setForm(f => ({ ...f, assignedPTId: e.target.value }))}
                    className={inputCls}
                  >
                    <option value={currentUserId}>{currentUserName} (FM)</option>
                    {ptList.map(pt => (
                      <option key={pt.id} value={pt.id}>{pt.name ?? pt.email}</option>
                    ))}
                  </select>
                </FormRow>
              ) : (
                <FormRow label="PT phụ trách *">
                  <select
                    value={form.assignedPTId ?? ""}
                    onChange={e => setForm(f => ({ ...f, assignedPTId: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">— Chọn PT —</option>
                    {ptList.map(pt => (
                      <option key={pt.id} value={pt.id}>{pt.name ?? pt.email}</option>
                    ))}
                  </select>
                </FormRow>
              )}
              <FormRow label="Phân nguồn">
                <select
                  value={form.source ?? ""}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— Chọn nguồn —</option>
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormRow>
              <FormRow label="Quá trình chăm sóc">
                <textarea
                  value={form.notes ?? ""}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className={`${inputCls} resize-none py-3`}
                  placeholder="Ngày tháng: nội dung..."
                />
              </FormRow>
              <FormRow label="Dự báo gói tập">
                <input
                  value={form.forecast ?? ""}
                  onChange={e => setForm(f => ({ ...f, forecast: e.target.value }))}
                  className={inputCls}
                  placeholder="Gói 3 tháng..."
                />
              </FormRow>
              <FormRow label="Tình trạng *">
                <select
                  value={form.status ?? "TAKECARE"}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as LeadStatus }))}
                  className={inputCls}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Gói tập đăng ký">
                <input
                  value={form.packageRegistered ?? ""}
                  onChange={e => setForm(f => ({ ...f, packageRegistered: e.target.value }))}
                  className={inputCls}
                />
              </FormRow>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Doanh thu (triệu)">
                  <input
                    type="number" step="0.1"
                    value={form.actualRevenue ?? ""}
                    onChange={e => setForm(f => ({ ...f, actualRevenue: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    className={inputCls}
                    placeholder="10.5"
                  />
                </FormRow>
                <FormRow label="Còn thiếu (triệu)">
                  <input
                    type="number" step="0.1"
                    value={form.remainingPayment ?? ""}
                    onChange={e => setForm(f => ({ ...f, remainingPayment: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    className={inputCls}
                    placeholder="2.0"
                  />
                </FormRow>
              </div>
              {isFitpartner && (
                <FormRow label="Doanh thu Fitpartner (triệu)">
                  <input
                    type="number" step="0.1"
                    value={form.fitpartnerRevenue ?? ""}
                    onChange={e => setForm(f => ({ ...f, fitpartnerRevenue: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    className={inputCls}
                    placeholder="5.0"
                  />
                </FormRow>
              )}
              <FormRow label="Ngày ký">
                <input
                  type="date"
                  value={(form as { signDateStr?: string }).signDateStr ?? ""}
                  onChange={e => setForm(f => ({ ...f, signDateStr: e.target.value }))}
                  className={inputCls}
                />
              </FormRow>
              <FormRow label="Ghi chú">
                <textarea
                  value={form.remark ?? ""}
                  onChange={e => setForm(f => ({ ...f, remark: e.target.value }))}
                  rows={2}
                  className={`${inputCls} resize-none py-3`}
                />
              </FormRow>
              {error && <p className="text-sm text-red-500 font-semibold">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-11 rounded-xl text-white font-bold text-sm disabled:opacity-60"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {saving ? "Đang lưu..." : editing ? "Cập nhật" : "Thêm mới"}
              </button>
              <button
                onClick={closeForm}
                className="h-11 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
              >
                Hủy
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Care Notes Popup ──────────────────────────────────────────────────────────

function CareNotesPopup({
  lead,
  canEdit,
  onClose,
  onUpdated,
}: {
  lead: SalesLead;
  canEdit: boolean;
  onClose: () => void;
  onUpdated: (id: string, newNotes: string) => void;
}) {
  const [newDate, setNewDate] = useState(todayISO());
  const [newText, setNewText] = useState("");
  const [saving, setSaving]   = useState(false);

  const entries = parseNoteEntries(lead.notes ?? "");
  const ptName  = lead.assignedPT.name ?? lead.assignedPT.email;

  async function handleAddNote() {
    const text = newText.trim();
    if (!text) return;
    setSaving(true);
    const [y, m, d] = newDate.split("-");
    const dateLabel  = `${parseInt(d)}/${parseInt(m)}/${y}`;
    const appended   = (lead.notes ?? "").trimEnd() + `\n- ${dateLabel}: ${text}`;
    try {
      const res = await fetch(`/api/setup/leads/${lead.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ notes: appended }),
      });
      if (res.ok) {
        onUpdated(lead.id, appended);
        setNewText("");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes _slideUp  { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes _fadeZoom { from { opacity: 0; transform: scale(0.96); }      to { opacity: 1; transform: scale(1); } }
        .care-sheet { animation: _slideUp 0.25s ease-out; }
        @media (min-width: 640px) { .care-sheet { animation: _fadeZoom 0.2s ease-out; } }
      `}</style>

      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4">
        <div className="care-sheet bg-white w-full sm:max-w-[500px] rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl">

          <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-200" />
          </div>

          <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between flex-shrink-0">
            <div className="pr-4 min-w-0">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Lịch sử chăm sóc</p>
              <p className="text-base font-extrabold text-gray-900 mt-0.5 truncate">{lead.customerName}</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                PT: {ptName}
                {lead.forecast && ` · Gói: ${lead.forecast}`}
                {lead.source   && ` · Nguồn: ${lead.source}`}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {entries.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-8">Chưa có ghi chú chăm sóc nào</p>
            ) : (
              <div className="space-y-4">
                {entries.map((e, i) => (
                  <div key={i}>
                    {e.date ? (
                      <div className="flex gap-3 items-start">
                        <span className="flex-shrink-0 text-xs font-extrabold text-[#f15b5c] bg-red-50 px-2.5 py-1 rounded-lg whitespace-nowrap mt-0.5">
                          📅 {e.date}
                        </span>
                        <p className="text-sm text-gray-700 leading-relaxed pt-1">{e.text}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600 leading-relaxed">{e.text}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {canEdit && (
            <div className="border-t border-gray-100 px-5 py-4 space-y-3 flex-shrink-0 bg-gray-50/60">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Thêm ghi chú</p>
              <div className="flex gap-2 items-start">
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="h-9 w-36 flex-shrink-0 rounded-xl border border-gray-200 px-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                />
                <textarea
                  value={newText}
                  onChange={e => setNewText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddNote(); }}
                  rows={2}
                  placeholder="Thêm ghi chú chăm sóc..."
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 resize-none"
                />
              </div>
              <button
                onClick={handleAddNote}
                disabled={saving || !newText.trim()}
                className="w-full h-10 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {saving ? "Đang lưu..." : "Lưu ghi chú"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls = "w-full h-11 rounded-xl border border-gray-200 px-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      {children}
    </div>
  );
}
