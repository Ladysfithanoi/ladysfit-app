"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SlideOver } from "@/components/ui/slide-over";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Search, Key, Copy, Check, ChevronDown, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { AlertDialog } from "@/components/ui/alert-dialog";

type Branch = { id: string; name: string };
type FMAssignment = { branchId: string; branch: { id: string; name: string } };
type PTLevel = { id: string; name: string; color: string; isActive: boolean };
type StaffMember = {
  id: string;
  name: string | null;
  email: string;
  role: "ADMIN" | "FM" | "CEO_FITPARTNER" | "COO" | "PT";
  branchId: string | null;
  dateOfBirth: Date | null;
  ptLevelId: string | null;
  ptLevel: { id: string; name: string; color: string } | null;
  branch: Branch | null;
  managedBranches: FMAssignment[];
  _count: { clients: number };
};

const ROLE_STYLE: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  FM: "bg-indigo-100 text-indigo-700",
  CEO_FITPARTNER: "bg-amber-100 text-amber-700",
  COO: "bg-orange-100 text-orange-700",
  PT: "bg-blue-100 text-blue-700",
};
const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  FM: "FM (Fitness Manager)",
  CEO_FITPARTNER: "CEO Fitpartner",
  COO: "COO",
  PT: "Huấn luyện viên",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold text-gray-700">{label}</Label>
      {children}
    </div>
  );
}

function BranchMultiSelect({
  branches,
  selected,
  onChange,
}: {
  branches: Branch[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else if (selected.length < 5) {
      onChange([...selected, id]);
    }
  }

  const selectedNames = branches.filter((b) => selected.includes(b.id)).map((b) => b.name);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 pr-9 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/40 flex items-center"
      >
        <span className={cn("flex-1 truncate", selected.length === 0 && "text-gray-400")}>
          {selected.length === 0
            ? "— Chọn cơ sở —"
            : selectedNames.length <= 2
            ? selectedNames.join(", ")
            : `${selectedNames.slice(0, 2).join(", ")} +${selectedNames.length - 2}`}
        </span>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-56 overflow-y-auto">
          {branches.map((b) => {
            const checked = selected.includes(b.id);
            const disabled = !checked && selected.length >= 5;
            return (
              <label
                key={b.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors",
                  disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(b.id)}
                  className="w-4 h-4 rounded accent-indigo-600"
                />
                <span className="text-sm text-gray-800">{b.name}</span>
              </label>
            );
          })}
        </div>
      )}

      <p className="mt-1.5 text-xs text-gray-400 font-medium">
        Chọn tối thiểu 1, tối đa 5 cơ sở &nbsp;·&nbsp;
        <span className={cn("font-semibold", selected.length >= 5 ? "text-indigo-600" : "text-gray-500")}>
          Đã chọn {selected.length}/5 cơ sở
        </span>
      </p>
    </div>
  );
}

export function StaffPageClient({
  initialStaff,
  branches,
  isAdmin,
  isFM = false,
  managedBranchIds = [],
}: {
  initialStaff: StaffMember[];
  branches: Branch[];
  isAdmin: boolean;
  isFM?: boolean;
  managedBranchIds?: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [deleting, setDeleting] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [resetting, setResetting] = useState<StaffMember | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetShowPw, setResetShowPw] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form state
  const [selectedRole, setSelectedRole] = useState<string>("PT");
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [ptLevels, setPtLevels] = useState<PTLevel[]>([]);
  const [selectedPtLevelId, setSelectedPtLevelId] = useState<string>("");
  const [birthDateVal, setBirthDateVal] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (open && selectedRole === "PT") {
      fetch("/api/admin/pt-levels")
        .then((r) => r.json())
        .then((data: unknown) => {
          if (Array.isArray(data)) setPtLevels((data as PTLevel[]).filter((l) => l.isActive));
        })
        .catch(() => setPtLevels([]));
    }
  }, [open, selectedRole]);

  const canManage = isAdmin || isFM;

  const filtered = useMemo(() => {
    return initialStaff.filter((s) => {
      const matchBranch = !branchFilter || s.branchId === branchFilter ||
        s.managedBranches.some((m) => m.branchId === branchFilter);
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        (s.name ?? "").toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q);
      return matchBranch && matchSearch;
    });
  }, [initialStaff, branchFilter, search]);

  function isoToYMD(iso: Date | string | null): string {
    if (!iso) return "";
    const s = typeof iso === "string" ? iso : iso.toISOString();
    return s.split("T")[0]; // "YYYY-MM-DD" for type="date"
  }

  function openAdd() {
    setEditing(null);
    setError("");
    setSelectedRole("PT");
    setSelectedBranchIds([]);
    setSelectedPtLevelId("");
    setBirthDateVal("");
    setShowPassword(false);
    setOpen(true);
  }
  function openEdit(s: StaffMember) {
    setEditing(s);
    setError("");
    const uiRole = s.role === "PT" ? "PT" : s.role;
    setSelectedRole(uiRole);
    setSelectedBranchIds(s.managedBranches.map((m) => m.branchId));
    setSelectedPtLevelId(s.ptLevelId ?? "");
    setBirthDateVal(isoToYMD(s.dateOfBirth));
    setShowPassword(false);
    setOpen(true);
  }
  function closePanel() { setOpen(false); setEditing(null); setError(""); }
  function openDelete(s: StaffMember) { setDeleting(s); setDeleteError(""); }
  function closeDelete() { setDeleting(null); setDeleteError(""); }
  function openReset(s: StaffMember) {
    setResetting(s);
    setResetPw("");
    setResetShowPw(false);
    setResetError("");
    setResetSuccess(false);
    setCopied(false);
  }
  function closeReset() { setResetting(null); setResetError(""); setResetSuccess(false); }
  function generateResetPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    setResetPw(Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
    setResetShowPw(true);
    setCopied(false);
  }
  async function copyResetPw() {
    await navigator.clipboard.writeText(resetPw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  async function handleReset() {
    if (!resetting) return;
    if (!resetPw || resetPw.length < 6) {
      setResetError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }
    setResetLoading(true);
    setResetError("");
    try {
      const res = await fetch(`/api/staff/${resetting.id}/reset-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Có lỗi xảy ra");
      setResetSuccess(true);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setResetLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);

    if (selectedRole === "FM" && selectedBranchIds.length === 0) {
      setError("FM phải có ít nhất 1 cơ sở quản lý");
      setLoading(false);
      return;
    }

    const actualRole = selectedRole;

    const body: Record<string, unknown> = {
      name: fd.get("name") as string,
      email: fd.get("email") as string,
      role: actualRole,
      dateOfBirth: birthDateVal ? new Date(birthDateVal + "T00:00:00.000Z").toISOString() : null,
    };

    if (selectedRole === "FM") {
      body.managedBranchIds = selectedBranchIds;
    } else {
      body.branchId = fd.get("branchId") as string;
    }

    if (selectedRole === "PT") {
      body.ptLevelId = selectedPtLevelId || null;
    } else {
      body.ptLevelId = null;
    }

    const pw = fd.get("password") as string;
    if (pw) body.password = pw;

    try {
      const res = await fetch(editing ? `/api/staff/${editing.id}` : "/api/staff", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let errMsg = "Có lỗi xảy ra";
        try {
          const err = await res.json();
          errMsg = err.error ?? errMsg;
          if (err.code) errMsg += ` (${err.code})`;
        } catch {}
        throw new Error(errMsg);
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
      const res = await fetch(`/api/staff/${deleting.id}`, { method: "DELETE" });
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

  // Branches available for FM role selection (FM can only assign staff to their own managed branches if FM is editing)
  const availableBranches = isFM
    ? branches.filter((b) => managedBranchIds.includes(b.id))
    : branches;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Quản lý Nhân sự</h1>
          <p className="text-sm text-gray-400 mt-0.5">{initialStaff.length} nhân viên</p>
        </div>
        {canManage && (
          <Button
            onClick={openAdd}
            className="gap-2 rounded-xl text-white font-semibold shadow-sm"
            style={{ backgroundColor: "#f15b5c" }}
          >
            <Plus className="w-4 h-4" />
            Thêm nhân sự
          </Button>
        )}
      </div>

      {/* Filter bar */}
      {canManage && (
        <div className="mb-4 space-y-2">
          <div className="flex gap-3">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 min-w-[180px]"
            >
              <option value="">Tất cả cơ sở</option>
              {availableBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm theo tên hoặc email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-white"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 font-semibold">
            Hiển thị{" "}
            <span className="text-gray-700">{filtered.length}</span>
            {" / "}
            <span className="text-gray-700">{initialStaff.length}</span>
            {" "}nhân viên
          </p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-2">
            <p className="text-sm text-gray-300 font-semibold">
              {initialStaff.length === 0 ? "Chưa có nhân sự" : "Không tìm thấy kết quả"}
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {(canManage
                  ? ["Họ tên", "Cơ sở", "Cấp độ", "Số KH", "Hành động"]
                  : ["Họ tên", "Cơ sở", "Cấp độ", "Số KH"]
                ).map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide",
                      i < 3 ? "text-left" : i === 3 ? "text-center" : "text-right"
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#f15b5c]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-extrabold text-[#f15b5c]">
                          {(s.name ?? s.email)[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{s.name ?? "—"}</p>
                        <p className="text-xs text-gray-400">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {s.role === "FM" && s.managedBranches.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {s.managedBranches.slice(0, 2).map((m) => (
                          <span
                            key={m.branchId}
                            className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold"
                          >
                            {m.branch.name}
                          </span>
                        ))}
                        {s.managedBranches.length > 2 && (
                          <span
                            className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold"
                            title={s.managedBranches.slice(2).map((m) => m.branch.name).join(", ")}
                          >
                            +{s.managedBranches.length - 2} cơ sở
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-600">{s.branch?.name ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {s.role === "PT" && s.ptLevel ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold w-fit" style={{ backgroundColor: s.ptLevel.color + "22", color: s.ptLevel.color }}>
                        {s.ptLevel.name}
                      </span>
                    ) : (
                      <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold", ROLE_STYLE[s.role])}>
                        {ROLE_LABEL[s.role]}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="text-sm font-bold text-gray-800">{s._count.clients}</span>
                  </td>
                  {canManage && (
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => openEdit(s)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-[#f15b5c] transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Sửa
                        </button>
                        {s.role !== "ADMIN" && !(isFM && s.role === "FM") && (
                          <>
                            <button
                              onClick={() => openDelete(s)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Xóa
                            </button>
                            <button
                              onClick={() => openReset(s)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-amber-500 transition-colors"
                            >
                              <Key className="w-3.5 h-3.5" /> Reset MK
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleting}
        onClose={closeDelete}
        variant="danger"
        title="Xóa nhân sự"
        description={
          deleteError
            ? deleteError
            : `Bạn có chắc muốn xóa nhân sự "${deleting?.name ?? deleting?.email}"?\nHành động này không thể hoàn tác.`
        }
        confirmLabel={deleteError ? undefined : "Xóa"}
        onConfirm={deleteError ? closeDelete : handleDelete}
        cancelLabel={deleteError ? "Đóng" : "Hủy"}
        loading={loading}
      />

      {/* Reset password modal */}
      {resetting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeReset} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-extrabold text-gray-900">
              Reset mật khẩu cho{" "}
              <span className="text-[#f15b5c]">{resetting.name ?? resetting.email}</span>
            </h2>

            {resetSuccess ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-sm font-bold text-green-700">✓ Đã reset mật khẩu thành công</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1">
                  <p className="text-xs font-bold text-amber-700">Mật khẩu mới — chia sẻ với nhân sự:</p>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-mono font-extrabold text-amber-900 tracking-widest flex-1">{resetPw}</p>
                    <button
                      onClick={copyResetPw}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-700 transition-colors flex-shrink-0"
                    >
                      {copied ? <><Check className="w-3 h-3" /> Đã copy</> : <><Copy className="w-3 h-3" /> Copy</>}
                    </button>
                  </div>
                </div>
                <button
                  onClick={closeReset}
                  className="w-full h-10 rounded-xl text-white font-bold text-sm"
                  style={{ backgroundColor: "#f15b5c" }}
                >
                  Đóng
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={generateResetPassword}
                  className="w-full h-10 rounded-xl border-2 border-dashed border-amber-300 text-amber-600 text-sm font-bold hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Key className="w-4 h-4" />
                  Tạo mật khẩu ngẫu nhiên
                </button>

                <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold">
                  <div className="flex-1 h-px bg-gray-100" />
                  hoặc nhập thủ công
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                <div className="relative">
                  <input
                    type={resetShowPw ? "text" : "password"}
                    value={resetPw}
                    onChange={(e) => { setResetPw(e.target.value); setCopied(false); }}
                    placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                    className="w-full h-11 rounded-xl border border-gray-200 px-4 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => setResetShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {resetShowPw
                      ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" /></svg>
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    }
                  </button>
                </div>

                {resetPw && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
                    <p className="text-sm font-mono font-extrabold text-amber-900 tracking-widest flex-1 break-all">{resetPw}</p>
                    <button
                      type="button"
                      onClick={copyResetPw}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-700 transition-colors flex-shrink-0"
                    >
                      {copied ? <><Check className="w-3 h-3" /> Đã copy</> : <><Copy className="w-3 h-3" /> Copy</>}
                    </button>
                  </div>
                )}

                <p className="text-xs text-gray-400 font-semibold text-center">
                  ⚠️ Hãy chia sẻ mật khẩu mới với nhân sự này
                </p>

                {resetError && (
                  <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                    <p className="text-sm text-[#f15b5c] font-semibold">{resetError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={resetLoading || !resetPw}
                    className="flex-1 h-10 rounded-xl text-white font-bold text-sm disabled:opacity-50"
                    style={{ backgroundColor: "#f15b5c" }}
                  >
                    {resetLoading ? "Đang lưu..." : "Xác nhận reset"}
                  </button>
                  <button
                    type="button"
                    onClick={closeReset}
                    disabled={resetLoading}
                    className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slide-over form */}
      <SlideOver
        open={open}
        onClose={closePanel}
        title={editing ? "Chỉnh sửa nhân sự" : "Thêm nhân sự mới"}
      >
        <form key={editing?.id ?? "new"} onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label="Họ tên *">
            <Input
              name="name"
              required
              defaultValue={editing?.name ?? ""}
              placeholder="Nguyễn Thị A"
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Email *">
            <Input
              name="email"
              type="email"
              required
              defaultValue={editing?.email ?? ""}
              placeholder="pt@ladysfit.vn"
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Ngày sinh">
            <input
              type="date"
              value={birthDateVal}
              onChange={(e) => setBirthDateVal(e.target.value)}
              className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/40"
            />
          </Field>
          <Field label={editing ? "Mật khẩu mới (bỏ trống để giữ nguyên)" : "Mật khẩu *"}>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required={!editing}
                placeholder="••••••••"
                className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 pr-11 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          <Field label="Chức vụ *">
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setSelectedBranchIds([]);
                setSelectedPtLevelId("");
              }}
              className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/40"
            >
              {isAdmin && <option value="ADMIN">Admin</option>}
              {isAdmin && <option value="FM">FM (Fitness Manager)</option>}
              {isAdmin && <option value="CEO_FITPARTNER">CEO</option>}
              {isAdmin && <option value="COO">COO</option>}
              <option value="PT">PT (Personal Trainer)</option>
            </select>
          </Field>

          {selectedRole === "PT" && (
            <Field label="Cấp độ PT">
              <select
                value={selectedPtLevelId}
                onChange={(e) => setSelectedPtLevelId(e.target.value)}
                className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/40"
              >
                <option value="">— Không có cấp độ —</option>
                {ptLevels.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </Field>
          )}

          {selectedRole === "FM" ? (
            <Field label="Cơ sở quản lý *">
              <BranchMultiSelect
                branches={availableBranches}
                selected={selectedBranchIds}
                onChange={setSelectedBranchIds}
              />
            </Field>
          ) : selectedRole === "ADMIN" ? (
            <Field label="Cơ sở làm việc (tùy chọn)">
              <select
                name="branchId"
                defaultValue={editing?.branchId ?? ""}
                className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/40"
              >
                <option value="">— Không chỉ định —</option>
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>
          ) : selectedRole !== "CEO_FITPARTNER" && selectedRole !== "COO" ? (
            <Field label="Cơ sở *">
              <select
                name="branchId"
                required
                defaultValue={editing?.branchId ?? ""}
                className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/40"
              >
                <option value="">— Chọn cơ sở —</option>
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>
          ) : null}

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
            <Button
              type="button"
              variant="outline"
              onClick={closePanel}
              className="h-11 rounded-xl px-5"
            >
              Hủy
            </Button>
          </div>
        </form>
      </SlideOver>
    </>
  );
}
