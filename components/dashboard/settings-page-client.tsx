"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlideOver } from "@/components/ui/slide-over";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";

type BranchRow = {
  id: string;
  name: string;
  address: string | null;
  _count: { users: number; clients: number };
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold text-gray-700">{label}</Label>
      {children}
    </div>
  );
}

export function SettingsPageClient({
  initialBranches,
  canAddBranch = true,
  canDeleteBranch = true,
}: {
  initialBranches: BranchRow[];
  canAddBranch?: boolean;
  canDeleteBranch?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [deleting, setDeleting] = useState<BranchRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  function openAdd() { setEditing(null); setError(""); setOpen(true); }
  function openEdit(b: BranchRow) { setEditing(b); setError(""); setOpen(true); }
  function closePanel() { setOpen(false); setEditing(null); setError(""); }
  function openDelete(b: BranchRow) { setDeleting(b); setDeleteError(""); }
  function closeDelete() { setDeleting(null); setDeleteError(""); }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const body = { name: fd.get("name") as string, address: fd.get("address") as string };

    try {
      const res = await fetch(editing ? `/api/branches/${editing.id}` : "/api/branches", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Có lỗi xảy ra");
      }
      closePanel();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setLoading(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/branches/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Có lỗi xảy ra");
      }
      closeDelete();
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      setLoading(false);
    }
  }

  const hasAssigned = deleting
    ? deleting._count.users > 0 || deleting._count.clients > 0
    : false;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Quản lý Cơ sở</h1>
          <p className="text-sm text-gray-400 mt-0.5">{initialBranches.length} cơ sở</p>
        </div>
        {canAddBranch && (
          <Button
            onClick={openAdd}
            className="gap-2 rounded-xl text-white font-semibold shadow-sm"
            style={{ backgroundColor: "#f15b5c" }}
          >
            <Plus className="w-4 h-4" />
            Thêm cơ sở
          </Button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {initialBranches.length === 0 ? (
          <div className="py-20 flex items-center justify-center">
            <p className="text-sm text-gray-300 font-semibold">Chưa có cơ sở nào</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {["STT", "Tên cơ sở", "Địa chỉ", "Số PT", "Số KH", "Hành động"].map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide ${
                      i < 2 ? "text-left" : i < 4 ? "text-center" : "text-left"
                    } ${i === 5 ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialBranches.map((b, idx) => (
                <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
                  <td className="px-5 py-3.5 text-sm text-gray-400 font-semibold">{idx + 1}</td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-gray-800">{b.name}</p>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">{b.address ?? "—"}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="text-sm font-bold text-gray-800">{b._count.users}</span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="text-sm font-bold text-gray-800">{b._count.clients}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => openEdit(b)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-[#f15b5c] transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Sửa
                      </button>
                      {canDeleteBranch && (
                        <button
                          onClick={() => openDelete(b)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Xóa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit slide-over */}
      <SlideOver open={open} onClose={closePanel} title={editing ? "Chỉnh sửa cơ sở" : "Thêm cơ sở mới"}>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label="Tên cơ sở *">
            <Input
              name="name"
              required
              defaultValue={editing?.name ?? ""}
              placeholder="Ladysfit Nguyễn Xiển"
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Địa chỉ">
            <Input
              name="address"
              defaultValue={editing?.address ?? ""}
              placeholder="123 Nguyễn Xiển, Hà Nội"
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
              disabled={loading}
              className="flex-1 h-11 rounded-xl text-white font-semibold"
              style={{ backgroundColor: "#f15b5c" }}
            >
              {loading ? "Đang lưu..." : editing ? "Cập nhật" : "Thêm mới"}
            </Button>
            <Button type="button" variant="outline" onClick={closePanel} className="h-11 rounded-xl px-5">
              Hủy
            </Button>
          </div>
        </form>
      </SlideOver>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleting}
        onClose={closeDelete}
        variant="danger"
        title={`Xóa cơ sở`}
        description={
          deleteError
            ? deleteError
            : hasAssigned
            ? `Cơ sở "${deleting?.name}" đang có ${deleting?._count.users} nhân sự và ${deleting?._count.clients} khách hàng.\nVui lòng chuyển họ sang cơ sở khác trước khi xóa.`
            : `Bạn có chắc muốn xóa cơ sở "${deleting?.name}"?\nHành động này không thể hoàn tác.`
        }
        confirmLabel={hasAssigned || deleteError ? undefined : "Xóa"}
        onConfirm={hasAssigned || deleteError ? closeDelete : handleDelete}
        cancelLabel={hasAssigned || deleteError ? "Đóng" : "Hủy"}
        loading={loading}
      />
    </>
  );
}
