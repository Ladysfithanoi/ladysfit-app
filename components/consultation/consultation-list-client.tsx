"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ChevronRight, ClipboardList, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AlertDialog } from "@/components/ui/alert-dialog";

type Branch = { id: string; name: string };
type Staff = { id: string; name: string | null; email: string };
type ConsultationRow = {
  id: string;
  status: "DRAFT" | "COMPLETED";
  currentStep: number;
  createdAt: string;
  updatedAt: string;
  convertedClientId: string | null;
  createdBy: { id: string; name: string | null; email: string };
  branch: { id: string; name: string };
  info: { fullName: string; phone: string } | null;
};

const STEP_LABELS = ["CIF", "Thẩm định", "Chương trình", "Chế độ ăn", "Lộ trình"];
void STEP_LABELS;

function StepBadge({ step }: { step: number }) {
  const pct = Math.round((step / 5) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-gray-700 whitespace-nowrap">Bước {step}/5</span>
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "#f15b5c" }} />
      </div>
    </div>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function dmyToDate(dmy: string): Date | null {
  if (!dmy) return null;
  const parts = dmy.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (!d || !m || !y || y.length !== 4) return null;
  const date = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
  return isNaN(date.getTime()) ? null : date;
}

const inputCls =
  "h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

export function ConsultationListClient({
  consultations: initial,
  branches,
  staff,
  isAdmin,
  isFM = false,
  currentUserBranchId,
  managedBranchIds = [],
}: {
  consultations: ConsultationRow[];
  branches: Branch[];
  staff: Staff[];
  isAdmin: boolean;
  isFM?: boolean;
  currentUserId?: string;
  currentUserBranchId: string | null;
  managedBranchIds?: string[];
}) {
  const router = useRouter();
  const [consultations, setConsultations] = useState(initial);
  const [tab, setTab] = useState<"DRAFT" | "COMPLETED">("DRAFT");
  const [creating, setCreating] = useState(false);

  // Filters
  const [phoneSearch, setPhoneSearch] = useState("");
  const [ptFilter, setPtFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Delete
  const [deletingRow, setDeletingRow] = useState<ConsultationRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const showPtFilter = isAdmin || isFM;
  const showBranchFilter = isAdmin || isFM;
  const hasFilters = !!(phoneSearch || ptFilter || branchFilter || dateFrom || dateTo);

  // Branches visible in the dropdown: all for ADMIN, managed-only for FM
  const visibleBranches = isAdmin
    ? branches
    : branches.filter((b) => managedBranchIds.includes(b.id));

  function clearFilters() {
    setPhoneSearch("");
    setPtFilter("");
    setBranchFilter("");
    setDateFrom("");
    setDateTo("");
  }

  const filtered = useMemo(() => {
    return consultations.filter((c) => {
      if (phoneSearch && !(c.info?.phone ?? "").includes(phoneSearch)) return false;
      if (ptFilter && c.createdBy.id !== ptFilter) return false;
      if (branchFilter && c.branch.id !== branchFilter) return false;
      if (dateFrom) {
        const from = dmyToDate(dateFrom);
        if (from) {
          from.setHours(0, 0, 0, 0);
          if (new Date(c.createdAt) < from) return false;
        }
      }
      if (dateTo) {
        const to = dmyToDate(dateTo);
        if (to) {
          to.setHours(23, 59, 59, 999);
          if (new Date(c.createdAt) > to) return false;
        }
      }
      return true;
    });
  }, [consultations, phoneSearch, ptFilter, branchFilter, dateFrom, dateTo]);

  const displayed = filtered.filter((c) => c.status === tab);
  const draftCount = filtered.filter((c) => c.status === "DRAFT").length;
  const completedCount = filtered.filter((c) => c.status === "COMPLETED").length;

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: currentUserBranchId }),
      });
      const data = await res.json();
      if (res.ok) router.push(`/dashboard/consultation/${data.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deletingRow) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/consultation/${deletingRow.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Có lỗi xảy ra");
      setConsultations((prev) => prev.filter((c) => c.id !== deletingRow.id));
      setDeletingRow(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setDeleteLoading(false);
    }
  }

  const deleteDescription = deletingRow
    ? [
        `Bạn có chắc muốn xóa hồ sơ tư vấn của ${deletingRow.info?.fullName || "khách hàng này"}?\nHành động này không thể hoàn tác.`,
        deletingRow.convertedClientId
          ? "\nHồ sơ này đã được chuyển thành khách hàng. Xóa hồ sơ tư vấn sẽ không xóa thông tin khách hàng."
          : "",
      ]
        .filter(Boolean)
        .join("")
    : "";

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Tư vấn</h1>
          <p className="text-sm text-gray-400 mt-0.5">{consultations.length} hồ sơ</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-white text-sm font-bold disabled:opacity-60"
          style={{ backgroundColor: "#f15b5c" }}
        >
          <Plus className="w-4 h-4" />
          {creating ? "Đang tạo..." : "Tạo hồ sơ tư vấn"}
        </button>
      </div>

      {/* Filter bar */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Phone search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm theo số điện thoại..."
              value={phoneSearch}
              onChange={(e) => setPhoneSearch(e.target.value)}
              className={cn(inputCls, "pl-9 w-52")}
            />
          </div>

          {/* PT filter — admin & FM only */}
          {showPtFilter && (
            <select
              value={ptFilter}
              onChange={(e) => setPtFilter(e.target.value)}
              className={cn(inputCls, "min-w-[160px]")}
            >
              <option value="">Tất cả PT</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name ?? s.email}</option>
              ))}
            </select>
          )}

          {/* Branch filter — admin & FM only */}
          {showBranchFilter && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className={cn(inputCls, "min-w-[180px]")}
            >
              <option value="">Tất cả cơ sở</option>
              {visibleBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}

          {/* Date range — dd/mm/yyyy */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-semibold whitespace-nowrap">Từ ngày</span>
            <input
              type="text"
              placeholder="dd/mm/yyyy"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={cn(inputCls, "w-32")}
            />
            <span className="text-xs text-gray-400 font-semibold">→</span>
            <span className="text-xs text-gray-400 font-semibold whitespace-nowrap">Đến ngày</span>
            <input
              type="text"
              placeholder="dd/mm/yyyy"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={cn(inputCls, "w-32")}
            />
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Xóa bộ lọc
            </button>
          )}
        </div>

        <p className="text-xs text-gray-400 font-semibold">
          Hiển thị{" "}
          <span className="text-gray-700 font-bold">{filtered.length}</span>
          {" / "}
          <span className="text-gray-700">{consultations.length}</span>
          {" "}hồ sơ
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        {(["DRAFT", "COMPLETED"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t === "DRAFT" ? `Đang tư vấn (${draftCount})` : `Đã hoàn thành (${completedCount})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {displayed.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <ClipboardList className="w-10 h-10 text-gray-200" />
            <p className="text-sm text-gray-300 font-semibold">
              {hasFilters
                ? "Không có kết quả phù hợp với bộ lọc"
                : tab === "DRAFT"
                ? "Chưa có hồ sơ tư vấn nào"
                : "Chưa có hồ sơ hoàn thành"}
            </p>
            {tab === "DRAFT" && !hasFilters && (
              <button
                onClick={handleCreate}
                disabled={creating}
                className="text-sm font-bold px-4 py-2 rounded-xl text-white disabled:opacity-60"
                style={{ backgroundColor: "#f15b5c" }}
              >
                Tạo hồ sơ đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Tên KH", "SĐT", "PT tư vấn", "Cơ sở", "Bước hiện tại", "Ngày tạo", "Hành động"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#f15b5c]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-extrabold text-[#f15b5c]">
                            {(c.info?.fullName || "?")[0].toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800">
                          {c.info?.fullName || <span className="text-gray-300 italic">Chưa có tên</span>}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{c.info?.phone || "—"}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{c.createdBy.name ?? c.createdBy.email}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{c.branch.name}</td>
                    <td className="px-5 py-3.5"><StepBadge step={c.currentStep} /></td>
                    <td className="px-5 py-3.5 text-sm text-gray-400">{fmtDate(c.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/consultation/${c.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#f15b5c] hover:text-[#d94a4b] transition-colors"
                        >
                          {c.status === "DRAFT" ? "Tiếp tục" : "Xem"}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => { setDeleteError(""); setDeletingRow(c); }}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Xóa hồ sơ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deletingRow}
        onClose={() => { if (!deleteLoading) setDeletingRow(null); }}
        title="Xóa hồ sơ tư vấn"
        description={deleteError || deleteDescription}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </>
  );
}
