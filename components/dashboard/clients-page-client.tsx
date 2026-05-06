"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, ChevronRight, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AlertDialog } from "@/components/ui/alert-dialog";

type Branch = { id: string; name: string };
type PT = { id: string; name: string | null; branchId: string | null };

type ActivePackage = {
  packageName: string;
  sessions: number;
  sessionsUsed: number;
  startDate: string | null;
  endDate: string | null;
};

type ClientRow = {
  id: string;
  fullName: string;
  phone: string;
  height: number;
  initialWeight: number;
  currentWeight: number;
  targetWeight: number;
  status: "ACTIVE" | "PAUSED" | "RESERVED";
  createdAt: string;
  assignedPT: { id: string; name: string | null };
  branch: Branch;
  activePackage: ActivePackage | null;
  packageNames: string[];
  foodLogToday: boolean;
  foodLogStale: boolean;
  selfMeasuredThisWeek: boolean;
};

const STATUS_STYLE = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-yellow-100 text-yellow-700",
  RESERVED: "bg-gray-100 text-gray-500",
};
const STATUS_LABEL = {
  ACTIVE: "Đang tập",
  PAUSED: "Nghỉ tập",
  RESERVED: "Bảo lưu",
};

const TABS = [
  { key: "ALL", label: "Tất cả" },
  { key: "ACTIVE", label: "Đang tập" },
  { key: "PAUSED", label: "Nghỉ tập" },
  { key: "RESERVED", label: "Bảo lưu" },
] as const;

const PACKAGE_OPTIONS = [
  { value: "", label: "Tất cả lộ trình" },
  { value: "L1", label: "L1" },
  { value: "L2", label: "L2" },
  { value: "L3", label: "L3" },
  { value: "L4", label: "L4" },
  { value: "L5", label: "L5" },
  { value: "Loyalfit", label: "Loyalfit" },
  { value: "NONE", label: "Chưa có lộ trình" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
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

export function ClientsPageClient({
  initialClients,
  branches,
  staffList,
  isAdmin,
  isFM = false,
  currentUserBranchId,
  managedBranchIds = [],
}: {
  initialClients: ClientRow[];
  branches?: Branch[];
  staffList?: PT[];
  isAdmin?: boolean;
  isFM?: boolean;
  currentUserBranchId?: string | null;
  managedBranchIds?: string[];
}) {
  const [clients, setClients] = useState<ClientRow[]>(initialClients);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "PAUSED" | "RESERVED">("ALL");
  const [ptFilter, setPtFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [pkgFilter, setPkgFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setClients(prev => prev.filter(c => c.id !== deleteTarget.id));
      showToast(`Đã xóa hồ sơ ${deleteTarget.fullName}`);
      setDeleteTarget(null);
    } catch {
      showToast("Xóa thất bại. Vui lòng thử lại.");
    } finally {
      setDeleting(false);
    }
  }

  const isPrivileged = isAdmin || isFM;
  const canDelete = isAdmin || isFM;
  const hasFilters = !!(search || ptFilter || branchFilter || pkgFilter || dateFrom || dateTo);

  // Branches shown in filter dropdown: all for ADMIN, managed-only for FM
  const visibleBranches = useMemo(
    () =>
      !branches
        ? []
        : isAdmin
        ? branches
        : branches.filter((b) => managedBranchIds.includes(b.id)),
    [branches, isAdmin, managedBranchIds]
  );

  function clearFilters() {
    setSearch("");
    setPtFilter("");
    setBranchFilter("");
    setPkgFilter("");
    setDateFrom("");
    setDateTo("");
  }

  // Staff visible in PT dropdown
  const visibleStaff = useMemo(() => {
    if (!staffList) return [];
    if (isPrivileged) return staffList; // server already scoped to managed branches for FM
    return staffList.filter((s) => s.branchId === currentUserBranchId);
  }, [staffList, isPrivileged, currentUserBranchId]);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      // Status tab
      if (activeTab !== "ALL" && c.status !== activeTab) return false;

      // Name / phone search
      if (search) {
        const q = search.toLowerCase();
        if (!c.fullName.toLowerCase().includes(q) && !c.phone.includes(search)) return false;
      }

      // PT filter
      if (ptFilter && c.assignedPT.id !== ptFilter) return false;

      // Branch filter
      if (branchFilter && c.branch.id !== branchFilter) return false;

      // Package filter
      if (pkgFilter) {
        if (pkgFilter === "NONE") {
          if (c.packageNames.length > 0) return false;
        } else {
          if (!c.packageNames.includes(pkgFilter)) return false;
        }
      }

      // Date from
      if (dateFrom) {
        const from = dmyToDate(dateFrom);
        if (from) {
          from.setHours(0, 0, 0, 0);
          if (new Date(c.createdAt) < from) return false;
        }
      }

      // Date to
      if (dateTo) {
        const to = dmyToDate(dateTo);
        if (to) {
          to.setHours(23, 59, 59, 999);
          if (new Date(c.createdAt) > to) return false;
        }
      }

      return true;
    });
  }, [clients, activeTab, search, ptFilter, branchFilter, pkgFilter, dateFrom, dateTo]);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Khách hàng</h1>
          <p className="text-sm text-gray-400 mt-0.5">{clients.length} khách hàng</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Name / phone search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm tên hoặc số điện thoại..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(inputCls, "pl-9 w-56")}
            />
          </div>

          {/* PT filter — privileged only */}
          {isPrivileged && visibleStaff.length > 0 && (
            <select
              value={ptFilter}
              onChange={(e) => setPtFilter(e.target.value)}
              className={cn(inputCls, "min-w-[160px]")}
            >
              <option value="">Tất cả PT</option>
              {isAdmin && branches && branches.length > 0 ? (
                branches.map((b) => {
                  const branchPTs = visibleStaff.filter((s) => s.branchId === b.id);
                  if (branchPTs.length === 0) return null;
                  return (
                    <optgroup key={b.id} label={b.name}>
                      {branchPTs.map((s) => (
                        <option key={s.id} value={s.id}>{s.name ?? `(${s.id.slice(0, 6)})`}</option>
                      ))}
                    </optgroup>
                  );
                })
              ) : (
                visibleStaff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name ?? `(${s.id.slice(0, 6)})`}</option>
                ))
              )}
            </select>
          )}

          {/* Branch filter — privileged only */}
          {isPrivileged && visibleBranches.length > 0 && (
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

          {/* Package / lộ trình filter */}
          <select
            value={pkgFilter}
            onChange={(e) => setPkgFilter(e.target.value)}
            className={cn(inputCls, "min-w-[160px]")}
          >
            {PACKAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

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

          {/* Clear */}
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
          <span className="text-gray-700">{initialClients.length}</span>
          {" "}khách hàng
        </p>
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors",
              activeTab === tab.key
                ? "bg-[#f15b5c] text-white"
                : "text-gray-500 hover:bg-gray-100"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-2">
            <p className="text-sm text-gray-300 font-semibold">
              {hasFilters ? "Không có kết quả phù hợp với bộ lọc" : "Không có khách hàng nào"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Họ tên", "PT phụ trách", "Cơ sở", "Chiều cao", "Lộ trình", "Cân nặng", "Tình trạng", "Trạng thái", ""].map((h) => (
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
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#f15b5c]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-extrabold text-[#f15b5c]">
                            {c.fullName[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{c.fullName}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {c.foodLogToday && (
                              <span title="Đã ghi nhật ký ăn uống hôm nay" className="text-xs leading-none">🍽️</span>
                            )}
                            {!c.foodLogToday && c.foodLogStale && (
                              <span title="Chưa ghi nhật ký ăn uống 3+ ngày" className="text-xs leading-none">⚠️</span>
                            )}
                            {c.selfMeasuredThisWeek && (
                              <span title="Khách tự cập nhật số đo tuần này" className="text-xs leading-none">📏</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{c.assignedPT.name ?? "—"}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{c.branch.name}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">{c.height} cm</td>
                    <td className="px-5 py-3.5">
                      {c.activePackage ? (
                        <div className="space-y-0.5">
                          <span
                            className="inline-block px-2 py-0.5 rounded-md text-xs font-extrabold text-white"
                            style={{ backgroundColor: "#f15b5c" }}
                          >
                            {c.activePackage.packageName}
                          </span>
                          <p className="text-xs font-semibold text-gray-600">
                            {c.activePackage.sessionsUsed}/{c.activePackage.sessions} buổi
                          </p>
                          <p className="text-xs text-gray-400">
                            {c.activePackage.startDate
                              ? `HSD: ${fmtDate(c.activePackage.endDate)}`
                              : "Chưa bắt đầu"}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 italic">Chưa có lộ trình</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-sm text-gray-500">{c.initialWeight}</span>
                      <span className="text-gray-300 mx-1.5">→</span>
                      <span className={cn("text-sm font-semibold", c.currentWeight < c.initialWeight ? "text-[#f15b5c]" : "text-gray-800")}>
                        {c.currentWeight} kg
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {c.initialWeight - c.currentWeight >= 7 ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-[#f15b5c]/10 text-[#f15b5c]">
                          Đã Transform
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn("inline-block px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap", STATUS_STYLE[c.status])}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/clients/${c.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-[#f15b5c] transition-colors"
                        >
                          Xem <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                        {canDelete && (
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Xóa khách hàng"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Xóa khách hàng"
        description={deleteTarget
          ? `Bạn có chắc muốn xóa hồ sơ của ${deleteTarget.fullName}?\n\nTất cả dữ liệu liên quan sẽ bị xóa bao gồm:\n- Lịch sử cân nặng\n- Lịch sử buổi tập\n- Chương trình tập\n- Chế độ ăn\n- Lộ trình đăng ký\n\nHành động này không thể hoàn tác.`
          : ""}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
