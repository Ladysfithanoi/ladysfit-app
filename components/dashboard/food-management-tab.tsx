"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";

type FoodRow = {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  weight_g: number;
  category: string | null;
  meal_type: string | null;
};

const CATEGORIES = ["Tăng cơ", "Giảm mỡ", "Giữ cân"];
const MEAL_TYPES = ["Bữa sáng", "Bữa trưa", "Bữa phụ", "Bữa tối"];

const inputCls =
  "w-full h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

function emptyForm(): Omit<FoodRow, "id"> {
  return { name: "", calories: 0, protein: 0, carbs: 0, fat: 0, weight_g: 100, category: null, meal_type: null };
}

export function FoodManagementTab() {
  const [foods, setFoods] = useState<FoodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMeal, setFilterMeal] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FoodRow | null>(null);
  const [form, setForm] = useState<Omit<FoodRow, "id">>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/foods");
      const data = await res.json();
      setFoods(Array.isArray(data) ? data : []);
    } catch {
      setFoods([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = foods.filter((f) => {
    const matchName = !search || f.name.toLowerCase().includes(search.toLowerCase());
    const matchCat  = !filterCategory || f.category === filterCategory;
    const matchMeal = !filterMeal || f.meal_type === filterMeal;
    return matchName && matchCat && matchMeal;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setModalOpen(true);
  }

  function openEdit(f: FoodRow) {
    setEditing(f);
    setForm({ name: f.name, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, weight_g: f.weight_g, category: f.category, meal_type: f.meal_type });
    setError("");
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditing(null); setError(""); }

  async function handleSave() {
    if (!form.name.trim()) { setError("Tên món ăn là bắt buộc"); return; }
    setSaving(true);
    setError("");
    try {
      const url = editing ? `/api/admin/foods/${editing.id}` : "/api/admin/foods";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Lỗi không xác định");
        return;
      }
      closeModal();
      load();
    } catch {
      setError("Lỗi kết nối server");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await fetch(`/api/admin/foods/${id}`, { method: "DELETE" });
      setFoods((prev) => prev.filter((f) => f.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  function num(v: unknown) { return v === "" ? 0 : Number(v); }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h2 className="text-base font-extrabold text-gray-800">Quản lý Thực phẩm</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {foods.length} món trong database · Dùng để tạo thực đơn AI và tìm kiếm thủ công
          </p>
        </div>
        <button
          onClick={openAdd}
          className="ml-auto flex items-center gap-1.5 h-9 px-4 rounded-xl text-white text-sm font-bold flex-shrink-0"
          style={{ backgroundColor: "#f15b5c" }}
        >
          <Plus className="w-4 h-4" /> Thêm thực phẩm
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Tìm theo tên..."
            className="w-full h-9 rounded-xl border border-gray-200 bg-white pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
          className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
        >
          <option value="">Tất cả mục đích</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterMeal}
          onChange={(e) => { setFilterMeal(e.target.value); setPage(1); }}
          className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
        >
          <option value="">Tất cả bữa</option>
          {MEAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-[#f15b5c] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-3 py-2.5 font-bold text-gray-600 whitespace-nowrap">Tên món</th>
                <th className="text-right px-3 py-2.5 font-bold text-gray-600 whitespace-nowrap">Cal</th>
                <th className="text-right px-3 py-2.5 font-bold text-gray-600 whitespace-nowrap">P(g)</th>
                <th className="text-right px-3 py-2.5 font-bold text-gray-600 whitespace-nowrap">C(g)</th>
                <th className="text-right px-3 py-2.5 font-bold text-gray-600 whitespace-nowrap">F(g)</th>
                <th className="text-right px-3 py-2.5 font-bold text-gray-600 whitespace-nowrap">Định lượng</th>
                <th className="text-left px-3 py-2.5 font-bold text-gray-600 whitespace-nowrap">Mục đích</th>
                <th className="text-left px-3 py-2.5 font-bold text-gray-600 whitespace-nowrap">Bữa</th>
                <th className="text-center px-3 py-2.5 font-bold text-gray-600 whitespace-nowrap">Sửa/Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-400 text-sm">
                    Không tìm thấy thực phẩm nào
                  </td>
                </tr>
              ) : (
                paged.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-3 py-2 font-semibold text-gray-800 max-w-[200px] truncate">{f.name}</td>
                    <td className="px-3 py-2 text-right text-red-600 font-bold">{f.calories}</td>
                    <td className="px-3 py-2 text-right text-blue-600">{f.protein}</td>
                    <td className="px-3 py-2 text-right text-green-600">{f.carbs}</td>
                    <td className="px-3 py-2 text-right text-yellow-600">{f.fat}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{f.weight_g}g</td>
                    <td className="px-3 py-2">
                      {f.category ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          f.category === "Tăng cơ" ? "bg-blue-100 text-blue-700" :
                          f.category === "Giảm mỡ" ? "bg-red-100 text-red-700" :
                          "bg-green-100 text-green-700"
                        }`}>{f.category}</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {f.meal_type ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                          {f.meal_type}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(f)}
                          className="text-gray-400 hover:text-blue-500 transition-colors"
                          title="Sửa"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(f.id)}
                          disabled={deletingId === f.id}
                          className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            ← Trước
          </button>
          <span className="text-xs text-gray-500">
            Trang {page}/{totalPages} · {filtered.length} kết quả
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            Sau →
          </button>
        </div>
      )}

      {/* Modal Add/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h3 className="font-extrabold text-gray-800">
                {editing ? "Sửa thực phẩm" : "Thêm thực phẩm mới"}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">Tên món ăn *</label>
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="VD: Ức gà nướng sả 150g"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Calo (kcal)", key: "calories" as const },
                  { label: "Protein (g)", key: "protein" as const },
                  { label: "Carbs (g)", key: "carbs" as const },
                  { label: "Fat (g)", key: "fat" as const },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">{label}</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      className={inputCls}
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: num(e.target.value) })}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">Định lượng (gram)</label>
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={form.weight_g}
                  onChange={(e) => setForm({ ...form, weight_g: num(e.target.value) || 100 })}
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Mặc định 100g (tức là chỉ số per 100g)</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Phân loại mục đích</label>
                  <select
                    className={inputCls}
                    value={form.category ?? ""}
                    onChange={(e) => setForm({ ...form, category: e.target.value || null })}
                  >
                    <option value="">— Chưa phân loại —</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Loại bữa ăn</label>
                  <select
                    className={inputCls}
                    value={form.meal_type ?? ""}
                    onChange={(e) => setForm({ ...form, meal_type: e.target.value || null })}
                  >
                    <option value="">— Tất cả bữa —</option>
                    {MEAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-500 font-semibold bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>

            <div className="px-5 pb-5 flex gap-2 justify-end">
              <button
                onClick={closeModal}
                className="px-4 h-9 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 h-9 rounded-xl text-white text-sm font-bold disabled:opacity-60"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
