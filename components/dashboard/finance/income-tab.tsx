"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Edit2, Lock, Save, X, Camera, Download, Upload } from "lucide-react";
import { fmtDate } from "@/lib/format-date";
import { DateMaskInput, todayDMY, dmyToISO, isoToDMY } from "./date-mask-input";
import { ReceiptPopover } from "./receipt-popover";
import { ImportModal } from "./import-modal";

type Transaction = {
  id:              string;
  category:        string;
  amount:          number;
  description:     string | null;
  transactionDate: string;
  referenceId:     string | null;
  receiptImages:   string | null;
  createdBy:       { id: string; name: string | null };
};

type Props = {
  branchId:      string;
  month:         number;
  year:          number;
  isReadOnly:    boolean;
  currentUserId: string;
  onMutate:      () => void;
};

const INCOME_CATEGORIES = ["Hợp đồng KH", "Thu khác"];

const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";

const inputCls = "h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30 w-full";

function parseAutoDesc(desc: string | null) {
  if (!desc) return { customer: "—", pkg: "—", pt: "—", contract: "—" };
  const parts    = desc.split(" | ");
  const customer = parts[0] ?? "—";
  const ptPart   = parts.find(p => p.startsWith("PT:"));
  const hdPart   = parts.find(p => p.startsWith("HĐ:"));
  const pkg      = parts.find(p => p !== parts[0] && !p.startsWith("PT:") && !p.startsWith("HĐ:"));
  return {
    customer,
    pkg:      pkg ?? "—",
    pt:       ptPart ? ptPart.slice(3).trim() : "—",
    contract: hdPart ? hdPart.slice(3).trim() : "—",
  };
}

export function IncomeTab({ branchId, month, year, isReadOnly, onMutate }: Props) {
  const [rows, setRows]           = useState<Transaction[]>([]);
  const [loading, setLoading]     = useState(false);
  const [filterCat, setFilterCat] = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [toast, setToast]         = useState("");
  const [receiptTxId, setReceiptTxId] = useState<string | null>(null);

  const [exporting, setExporting]   = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [form, setForm] = useState({
    category:           INCOME_CATEGORIES[0],
    customCategory:     "",
    amount:             "",
    description:        "",
    transactionDateStr: todayDMY(),
  });

  const fetchRows = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/transactions?branchId=${branchId}&month=${month}&year=${year}&type=INCOME`);
      if (res.ok) setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, [branchId, month, year]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const filtered   = filterCat ? rows.filter(r => r.category === filterCat) : rows;
  const categories = Array.from(new Set(rows.map(r => r.category)));
  const total      = rows.reduce((s, r) => s + r.amount, 0);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function openAdd() {
    setEditId(null);
    setForm({
      category:           INCOME_CATEGORIES[0],
      customCategory:     "",
      amount:             "",
      description:        "",
      transactionDateStr: todayDMY(),
    });
    setShowForm(true);
  }

  function openEdit(tx: Transaction) {
    setEditId(tx.id);
    setForm({
      category:           INCOME_CATEGORIES.includes(tx.category) ? tx.category : "__custom__",
      customCategory:     INCOME_CATEGORIES.includes(tx.category) ? "" : tx.category,
      amount:             String(tx.amount),
      description:        tx.description ?? "",
      transactionDateStr: isoToDMY(tx.transactionDate),
    });
    setShowForm(true);
  }

  async function handleSave() {
    const cat = form.category === "__custom__" ? form.customCategory.trim() : form.category;
    const iso = dmyToISO(form.transactionDateStr);
    if (!cat || !form.amount || !iso) return;

    const body = {
      branchId,
      type:            "INCOME",
      category:        cat,
      amount:          parseFloat(form.amount),
      description:     form.description || undefined,
      transactionDate: iso,
    };

    const res = editId
      ? await fetch(`/api/finance/transactions/${editId}`, { method: "PUT",  headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/finance/transactions",            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

    if (res.ok) {
      setShowForm(false);
      await fetchRows();
      onMutate();
      showToast(editId ? "Đã cập nhật ✓" : "Đã thêm khoản thu ✓");
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/finance/export", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type: "income", branchId, month, year }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(`Lỗi xuất file: ${body.error ?? res.status}`);
        console.error("[export income]", body);
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `Bang-Thu-Thang-${String(month).padStart(2,"0")}-${year}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Xoá khoản thu này?")) return;
    const res = await fetch(`/api/finance/transactions/${id}`, { method: "DELETE" });
    if (res.ok) {
      await fetchRows();
      onMutate();
      showToast("Đã xoá ✓");
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500">Lọc:</label>
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none"
          >
            <option value="">Tất cả</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-colors disabled:opacity-50"
            style={{ borderColor: "#f15b5c", color: "#f15b5c" }}
          >
            <Download className="w-4 h-4" />
            {exporting ? "Đang xuất..." : "Xuất Excel"}
          </button>
          {!isReadOnly && (
            <>
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-colors"
                style={{ borderColor: "#f15b5c", color: "#f15b5c" }}
              >
                <Upload className="w-4 h-4" />
                Nhập từ Excel
              </button>
              <button
                onClick={openAdd}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold"
                style={{ backgroundColor: "#10b981" }}
              >
                <Plus className="w-4 h-4" /> Thêm khoản thu
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f5f5f5] border-b border-gray-200">
                {["Ngày", "Danh mục", "Khách hàng", "Gói tập", "PT", "Mã HĐ", "Số tiền", "Chứng từ", "Nguồn", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide border-r border-gray-200 last:border-r-0 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-400">Đang tải...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-400 italic">Không có khoản thu nào</td></tr>
              ) : (
                filtered.map(tx => {
                  const images: string[] = tx.receiptImages ? (JSON.parse(tx.receiptImages) as string[]) : [];
                  const parsed = tx.referenceId ? parseAutoDesc(tx.description) : null;
                  return (
                    <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/50 divide-x divide-gray-100">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(tx.transactionDate)}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 whitespace-nowrap">
                          {tx.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[140px] truncate">
                        {parsed ? parsed.customer : (tx.description ?? "—")}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {parsed ? parsed.pkg : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {parsed ? parsed.pt : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono whitespace-nowrap">
                        {parsed ? parsed.contract : "—"}
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-600 whitespace-nowrap">{vnd(tx.amount)}</td>
                      {/* Chứng từ */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {images.length > 0 ? (
                          <button
                            onClick={() => setReceiptTxId(tx.id)}
                            className="flex items-center gap-1 text-blue-500 hover:text-blue-600 transition-colors"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold">{images.length} ảnh</span>
                          </button>
                        ) : !isReadOnly ? (
                          <button
                            onClick={() => setReceiptTxId(tx.id)}
                            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            📎 Thêm ảnh
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {tx.referenceId
                          ? <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Hợp đồng</span>
                          : (tx.createdBy.name ?? "—")}
                      </td>
                      <td className="px-4 py-3">
                        {!isReadOnly && !tx.referenceId && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(tx)} className="text-gray-400 hover:text-blue-500 transition-colors">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(tx.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
            <p className="text-sm font-extrabold text-emerald-600">
              Tổng thu tháng: {vnd(total)}
            </p>
          </div>
        )}
      </div>

      {/* Slide-over form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: "#10b981" }}>
              <p className="text-base font-extrabold text-white">{editId ? "Sửa khoản thu" : "Thêm khoản thu"}</p>
              <button onClick={() => setShowForm(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Ngày giao dịch</label>
                <DateMaskInput
                  value={form.transactionDateStr}
                  onChange={v => setForm(f => ({ ...f, transactionDateStr: v }))}
                  className={inputCls}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Danh mục</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className={inputCls}
                >
                  {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__custom__">+ Thêm mới</option>
                </select>
                {form.category === "__custom__" && (
                  <input
                    type="text"
                    placeholder="Nhập tên danh mục mới"
                    value={form.customCategory}
                    onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))}
                    className={inputCls + " mt-2"}
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Số tiền (VND)</label>
                <input
                  type="number"
                  step="1000"
                  placeholder="0"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className={inputCls}
                />
                {form.amount && (
                  <p className="text-[10px] text-gray-400">{vnd(parseFloat(form.amount) || 0)}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Mô tả (tuỳ chọn)</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30 w-full resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold"
                style={{ backgroundColor: "#10b981" }}
              >
                <Save className="w-4 h-4" />
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt popover */}
      {receiptTxId && (() => {
        const tx     = rows.find(r => r.id === receiptTxId);
        const images = tx?.receiptImages ? (JSON.parse(tx.receiptImages) as string[]) : [];
        return (
          <ReceiptPopover
            transactionId={receiptTxId}
            initialImages={images}
            canEdit={!isReadOnly}
            onClose={() => setReceiptTxId(null)}
            onSaved={newImages => {
              setRows(prev => prev.map(r =>
                r.id === receiptTxId
                  ? { ...r, receiptImages: newImages.length > 0 ? JSON.stringify(newImages) : null }
                  : r
              ));
              setReceiptTxId(null);
            }}
          />
        );
      })()}

      {showImport && (
        <ImportModal
          type="income"
          branchId={branchId}
          onClose={() => setShowImport(false)}
          onImported={() => { fetchRows(); onMutate(); setShowImport(false); }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
