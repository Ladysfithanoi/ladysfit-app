"use client";

import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import { Plus, Trash2, Edit2, Save, X, Camera, Download, Lock, Upload } from "lucide-react";
import { fmtDate } from "@/lib/format-date";
import { DateMaskInput, todayDMY, dmyToISO, isoToDMY } from "./date-mask-input";
import { ReceiptPopover } from "./receipt-popover";
import { ImportModal } from "./import-modal";
import { AlertDialog } from "@/components/ui/alert-dialog";

type Transaction = {
  id:              string;
  category:        string;
  amount:          number;
  description:     string | null;
  transactionDate: string;
  referenceId:     string | null;
  invoiceImages:   string | null;
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

const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";

const inputCls = "h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 w-full";

function toBase64(file: File): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

export function ExpenseTab({ branchId, month, year, isReadOnly, onMutate }: Props) {
  const [rows, setRows]           = useState<Transaction[]>([]);
  const [loading, setLoading]     = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [toast, setToast]         = useState("");
  const [invoiceTxId, setInvoiceTxId] = useState<string | null>(null);
  const [exporting, setExporting]     = useState(false);
  const [showImport, setShowImport]   = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<{ id: string; amount: number; description?: string } | null>(null);

  const [form, setForm] = useState({
    amount:             "",
    description:        "",
    transactionDateStr: todayDMY(),
  });

  const [formInvoiceImages, setFormInvoiceImages] = useState<string[]>([]);
  const [displayAmount, setDisplayAmount] = useState("");

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setForm(f => ({ ...f, amount: raw }));
    setDisplayAmount(raw ? Number(raw).toLocaleString("vi-VN") : "");
  }

  const fetchRows = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/transactions?branchId=${branchId}&month=${month}&year=${year}&type=EXPENSE`);
      if (res.ok) setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, [branchId, month, year]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const total = rows.reduce((s, r) => s + r.amount, 0);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function openAdd() {
    setEditId(null);
    setForm({ amount: "", description: "", transactionDateStr: todayDMY() });
    setFormInvoiceImages([]);
    setDisplayAmount("");
    setShowForm(true);
  }

  function openEdit(tx: Transaction) {
    setEditId(tx.id);
    setForm({
      amount:             String(tx.amount),
      description:        tx.description ?? "",
      transactionDateStr: isoToDMY(tx.transactionDate),
    });
    setFormInvoiceImages(tx.invoiceImages ? (JSON.parse(tx.invoiceImages) as string[]) : []);
    setDisplayAmount(tx.amount ? Number(tx.amount).toLocaleString("vi-VN") : "");
    setShowForm(true);
  }

  async function handleInvoiceFiles(e: ChangeEvent<HTMLInputElement>) {
    const files  = Array.from(e.target.files ?? []);
    const MAX_MB = 5 * 1024 * 1024;
    for (const f of files) {
      if (f.size > MAX_MB) { showToast(`"${f.name}" vượt quá 5MB`); return; }
    }
    if (formInvoiceImages.length + files.length > 5) { showToast("Tối đa 5 ảnh"); return; }
    const bases = await Promise.all(files.map(toBase64));
    setFormInvoiceImages(prev => [...prev, ...bases]);
    e.target.value = "";
  }

  async function handleSave() {
    const iso = dmyToISO(form.transactionDateStr);
    if (!form.amount || !iso) return;

    const body: Record<string, unknown> = {
      branchId,
      type:            "EXPENSE",
      category:        "Chi phí",
      amount:          parseFloat(form.amount),
      description:     form.description || undefined,
      transactionDate: iso,
      invoiceImages:   formInvoiceImages.length > 0 ? JSON.stringify(formInvoiceImages) : undefined,
    };

    const res = editId
      ? await fetch(`/api/finance/transactions/${editId}`, { method: "PUT",  headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/finance/transactions",            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

    if (res.ok) {
      setShowForm(false);
      await fetchRows();
      onMutate();
      showToast(editId ? "Đã cập nhật ✓" : "Đã thêm khoản chi ✓");
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/finance/export", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type: "expense", branchId, month, year }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(`Lỗi xuất file: ${body.error ?? res.status}`);
        console.error("[export expense]", body);
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `Bang-Chi-Thang-${String(month).padStart(2,"0")}-${year}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(id: string) {
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
      <div className="flex flex-wrap items-center justify-end gap-2">
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
              style={{ backgroundColor: "#ef4444" }}
            >
              <Plus className="w-4 h-4" /> Thêm khoản chi
            </button>
          </>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f5f5f5] border-b border-gray-200">
                {["Ngày", "Mô tả", "Số tiền", "Hóa đơn", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide border-r border-gray-200 last:border-r-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Đang tải...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400 italic">Không có khoản chi nào</td></tr>
              ) : (
                rows.map(tx => {
                  const invImgs: string[] = tx.invoiceImages ? (JSON.parse(tx.invoiceImages) as string[]) : [];
                  return (
                    <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/50 divide-x divide-gray-100">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(tx.transactionDate)}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{tx.description ?? "—"}</td>
                      <td className="px-4 py-3 font-bold text-red-500 whitespace-nowrap">-{vnd(tx.amount)}</td>

                      {/* Hóa đơn */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {invImgs.length > 0 ? (
                          <button
                            onClick={() => setInvoiceTxId(tx.id)}
                            className="flex items-center gap-1 text-orange-500 hover:text-orange-600 transition-colors"
                          >
                            <span className="text-xs font-semibold">🧾 {invImgs.length} ảnh</span>
                          </button>
                        ) : !isReadOnly ? (
                          <button
                            onClick={() => setInvoiceTxId(tx.id)}
                            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            📎 Thêm
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {tx.referenceId ? (
                          <span title="Tự động tạo từ bảng lương" className="text-gray-300 flex items-center">
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        ) : !isReadOnly && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(tx)} className="text-gray-400 hover:text-blue-500 transition-colors">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setTransactionToDelete({ id: tx.id, amount: tx.amount, description: tx.description ?? undefined });
                                setDeleteDialogOpen(true);
                              }}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
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
            <p className="text-sm font-extrabold text-red-500">
              Tổng chi tháng: -{vnd(total)}
            </p>
          </div>
        )}
      </div>

      {/* Slide-over form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: "#ef4444" }}>
              <p className="text-base font-extrabold text-white">{editId ? "Sửa khoản chi" : "Thêm khoản chi"}</p>
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
                <label className="text-xs font-semibold text-gray-500">Số tiền (VND)</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={displayAmount}
                    onChange={handleAmountChange}
                    className={inputCls + " pr-7"}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">đ</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Mô tả (tuỳ chọn)</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 w-full resize-none"
                />
              </div>

              {/* Hóa đơn upload */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500">Hóa đơn</label>
                {formInvoiceImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formInvoiceImages.map((src, i) => (
                      <div key={i} className="relative w-16 h-16">
                        <img
                          src={src}
                          alt=""
                          className="w-full h-full object-cover rounded-xl border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => setFormInvoiceImages(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-sm"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    {formInvoiceImages.length < 5 && (
                      <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-red-400 hover:bg-red-50 transition-colors">
                        <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleInvoiceFiles} />
                        <Camera className="w-4 h-4 text-gray-300" />
                      </label>
                    )}
                  </div>
                )}
                {formInvoiceImages.length === 0 && (
                  <label className="flex flex-col items-center justify-center gap-2 h-20 w-full rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                    <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleInvoiceFiles} />
                    <Camera className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-400">Tải ảnh lên · tối đa 5 ảnh</span>
                  </label>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold"
                style={{ backgroundColor: "#ef4444" }}
              >
                <Save className="w-4 h-4" />
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hóa đơn popover */}
      {invoiceTxId && (() => {
        const tx     = rows.find(r => r.id === invoiceTxId);
        const images = tx?.invoiceImages ? (JSON.parse(tx.invoiceImages) as string[]) : [];
        return (
          <ReceiptPopover
            transactionId={invoiceTxId}
            initialImages={images}
            canEdit={!isReadOnly}
            title="Hóa đơn"
            saveUrl={`/api/finance/transactions/${invoiceTxId}/invoices`}
            onClose={() => setInvoiceTxId(null)}
            onSaved={newImages => {
              setRows(prev => prev.map(r =>
                r.id === invoiceTxId
                  ? { ...r, invoiceImages: newImages.length > 0 ? JSON.stringify(newImages) : null }
                  : r
              ));
              setInvoiceTxId(null);
            }}
          />
        );
      })()}

      {showImport && (
        <ImportModal
          type="expense"
          branchId={branchId}
          onClose={() => setShowImport(false)}
          onImported={() => { fetchRows(); onMutate(); setShowImport(false); }}
        />
      )}

      <AlertDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setTransactionToDelete(null); }}
        title="Xóa khoản giao dịch"
        description={`Bạn có chắc muốn xóa khoản ${transactionToDelete?.amount?.toLocaleString("vi-VN")}đ${transactionToDelete?.description ? ` — ${transactionToDelete.description}` : ""}?\n\nHành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        onConfirm={() => {
          if (transactionToDelete) handleDelete(transactionToDelete.id);
          setDeleteDialogOpen(false);
          setTransactionToDelete(null);
        }}
        variant="danger"
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
