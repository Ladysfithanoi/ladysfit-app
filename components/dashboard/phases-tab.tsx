"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { SlideOver } from "@/components/ui/slide-over";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Phase = {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  _count: { programs: number };
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold text-gray-700">{label}</Label>
      {children}
    </div>
  );
}

export function PhasesTab() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Phase | null>(null);
  const [deleting, setDeleting] = useState<Phase | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/phases");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPhases(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Phases load error:", err);
      setPhases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setError(""); setOpen(true); }
  function openEdit(p: Phase) { setEditing(p); setError(""); setOpen(true); }
  function closePanel() { setOpen(false); setEditing(null); setError(""); }
  function openDelete(p: Phase) { setDeleting(p); setDeleteError(""); }
  function closeDelete() { setDeleting(null); setDeleteError(""); }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const body = { name: fd.get("name") as string, order: Number(fd.get("order")) };

    try {
      const res = await fetch(editing ? `/api/admin/phases/${editing.id}` : "/api/admin/phases", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Có lỗi xảy ra");
      }
      closePanel();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setFormLoading(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/admin/phases/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Có lỗi xảy ra");
      }
      closeDelete();
      load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      setFormLoading(false);
    }
  }

  async function toggleActive(p: Phase) {
    await fetch(`/api/admin/phases/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    load();
  }

  const canDelete = deleting ? deleting._count.programs === 0 : false;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Giai đoạn tập luyện</h1>
          <p className="text-sm text-gray-400 mt-0.5">{phases.length} giai đoạn</p>
        </div>
        <Button
          onClick={openAdd}
          className="gap-2 rounded-xl text-white font-semibold shadow-sm"
          style={{ backgroundColor: "#f15b5c" }}
        >
          <Plus className="w-4 h-4" />
          Thêm giai đoạn
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <p className="text-sm text-gray-300 font-semibold">Đang tải...</p>
          </div>
        ) : phases.length === 0 ? (
          <div className="py-20 flex items-center justify-center">
            <p className="text-sm text-gray-300 font-semibold">Chưa có giai đoạn nào</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {["STT", "Tên giai đoạn", "Thứ tự", "Số CT", "Trạng thái", "Hành động"].map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide ${
                      i === 0 || i === 2 || i === 3 ? "text-center" : i === 5 ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {phases.map((p, idx) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
                  <td className="px-5 py-3.5 text-sm text-gray-400 font-semibold text-center">{idx + 1}</td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="text-sm text-gray-500">{p.order}</span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="text-sm font-bold text-gray-800">{p._count.programs}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => toggleActive(p)} className="flex items-center gap-1.5">
                      {p.isActive ? (
                        <>
                          <ToggleRight className="w-5 h-5 text-[#f15b5c]" />
                          <span className="text-xs font-semibold text-[#f15b5c]">Hoạt động</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-5 h-5 text-gray-300" />
                          <span className="text-xs font-semibold text-gray-400">Tạm dừng</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => openEdit(p)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-[#f15b5c] transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Sửa
                      </button>
                      <button
                        onClick={() => openDelete(p)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SlideOver open={open} onClose={closePanel} title={editing ? "Chỉnh sửa giai đoạn" : "Thêm giai đoạn mới"} width="sm">
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label="Tên giai đoạn *">
            <Input
              name="name"
              required
              defaultValue={editing?.name ?? ""}
              placeholder="VD: Giai đoạn 1"
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Thứ tự hiển thị *">
            <Input
              name="order"
              type="number"
              required
              defaultValue={editing?.order ?? phases.length + 1}
              placeholder="1"
              min={1}
              onFocus={(e) => e.target.select()}
              className="h-11 rounded-xl"
            />
          </Field>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-[#f15b5c] font-medium">{error}</p>
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <Button
              type="submit"
              disabled={formLoading}
              className="flex-1 h-11 rounded-xl text-white font-semibold"
              style={{ backgroundColor: "#f15b5c" }}
            >
              {formLoading ? "Đang lưu..." : editing ? "Cập nhật" : "Thêm mới"}
            </Button>
            <Button type="button" variant="outline" onClick={closePanel} className="h-11 rounded-xl px-5">
              Hủy
            </Button>
          </div>
        </form>
      </SlideOver>

      <AlertDialog
        open={!!deleting}
        onClose={closeDelete}
        variant="danger"
        title="Xóa giai đoạn"
        description={
          deleteError
            ? deleteError
            : !canDelete
            ? `Giai đoạn "${deleting?.name}" đang có ${deleting?._count.programs} chương trình, không thể xóa.`
            : `Bạn có chắc muốn xóa giai đoạn "${deleting?.name}"?\nHành động này không thể hoàn tác.`
        }
        confirmLabel={!canDelete || !!deleteError ? undefined : "Xóa"}
        onConfirm={!canDelete || !!deleteError ? closeDelete : handleDelete}
        cancelLabel={!canDelete || !!deleteError ? "Đóng" : "Hủy"}
        loading={formLoading}
      />
    </>
  );
}
