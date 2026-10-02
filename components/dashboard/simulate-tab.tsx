"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, FlaskConical, Eye, RefreshCw, Search, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ── Cài đặt → Giả lập ────────────────────────────────────────────────────────
 *
 * Admin đóng vai một tài khoản FM/PT để xem đúng giao diện người đó thấy.
 * Thoát bằng thanh "Đang giả lập" ở đầu mọi trang. Cơ chế: lib/simulate.ts.
 */

type Row = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  branches: string[];
  isTest: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  FM: "FM",
  PT: "PT",
  CEO_FITPARTNER: "CEO FitPartner",
  COO: "COO",
  STAFF: "Nhân sự",
};

export function SimulateTab() {
  const { update } = useSession();
  const [rows, setRows]       = useState<Row[] | null>(null);
  const [error, setError]     = useState("");
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [switching, setSwitching] = useState<string | null>(null);
  const [q, setQ]             = useState("");
  const [picked, setPicked]   = useState<Row | null>(null);

  const load = useCallback(async () => {
    setError("");
    const res = await fetch("/api/admin/simulate");
    if (!res.ok) { setError("Không tải được danh sách tài khoản"); setRows([]); return; }
    setRows(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function seed() {
    setSeeding(true); setSeedMsg(""); setError("");
    const res = await fetch("/api/admin/simulate", { method: "POST" });
    setSeeding(false);
    if (!res.ok) { setError((await res.json().catch(() => null))?.error ?? "Có lỗi xảy ra"); return; }
    setSeedMsg("Đã tạo / làm mới dữ liệu test: 1 cơ sở, 1 FM, 1 PT, 3 khách.");
    load();
  }

  async function simulate(id: string) {
    setSwitching(id);
    const s = await update({ simulateUserId: id });
    if (!s?.user.impersonator) {
      setSwitching(null);
      setPicked(null);
      setError("Không đóng vai được tài khoản này");
      return;
    }
    // Tải lại hẳn để mọi màn server render lại theo tài khoản mới.
    window.location.href = "/dashboard";
  }

  const filtered = useMemo(() => {
    if (!rows) return [];
    const k = q.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter((r) =>
      [r.name, r.email, ...r.branches].some((v) => v?.toLowerCase().includes(k)));
  }, [rows, q]);

  const tests = filtered.filter((r) => r.isTest);
  const real  = filtered.filter((r) => !r.isTest);

  return (
    <div className="space-y-6">
      {/* Dữ liệu test */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f15b5c]/10 flex items-center justify-center flex-shrink-0">
            <FlaskConical className="w-5 h-5 text-[#f15b5c]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800">Dữ liệu test</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Tạo sẵn cơ sở <b>🧪 Cơ sở Giả lập</b> với 1 FM, 1 PT và 3 khách: đang tập L1,
              chưa tới ngày tập L2, tái ký L3. Bấm lại bất cứ lúc nào để đưa khách test về
              trạng thái ban đầu (xoá hết buổi tập, cân nặng… đã thử).
            </p>
          </div>
        </div>
        <button
          onClick={seed}
          disabled={seeding}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#f15b5c] text-white text-sm font-semibold disabled:opacity-60"
        >
          {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Tạo / làm mới dữ liệu test
        </button>
        {seedMsg && <p className="text-sm text-emerald-600">{seedMsg}</p>}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Danh sách tài khoản */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <p className="font-bold text-gray-800">Đóng vai tài khoản</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Xem và thao tác đúng như tài khoản đó. Thoát bằng nút <b>Thoát giả lập</b> ở đầu trang.
            Thao tác trên tài khoản thật là thao tác thật — nên thử trên tài khoản 🧪.
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên, email, cơ sở…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#f15b5c]"
          />
        </div>

        {rows === null ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <>
            {tests.length > 0 && (
              <Group title="Tài khoản test" rows={tests} switching={switching} onPick={setPicked} />
            )}
            {rows.every((r) => !r.isTest) && (
              <p className="text-sm text-gray-400">Chưa có tài khoản test — bấm “Tạo / làm mới dữ liệu test” ở trên.</p>
            )}
            <Group title="Tài khoản thật" rows={real} switching={switching} onPick={setPicked} />
          </>
        )}
      </div>

      {picked && (
        <ConfirmModal
          row={picked}
          busy={switching === picked.id}
          onClose={() => { if (!switching) setPicked(null); }}
          onConfirm={() => simulate(picked.id)}
        />
      )}
    </div>
  );
}

/** Xác nhận trước khi đóng vai: ai, cơ sở nào, có gì để thử, và cảnh báo nếu là tài khoản thật. */
function ConfirmModal({
  row, busy, onClose, onConfirm,
}: {
  row: Row;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f15b5c]/10 flex items-center justify-center flex-shrink-0">
            <Eye className="w-5 h-5 text-[#f15b5c]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800">Giả lập {ROLE_LABEL[row.role] ?? row.role}</p>
            <p className="text-sm text-gray-500 truncate">{row.name ?? row.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <dl className="text-sm grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5">
          <dt className="text-gray-400">Email</dt>
          <dd className="text-gray-700 truncate">{row.email}</dd>
          <dt className="text-gray-400">Cơ sở</dt>
          <dd className="text-gray-700">{row.branches.join(", ") || "—"}</dd>
        </dl>

        {row.isTest ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-800 space-y-1">
            <p className="font-semibold">Có sẵn để thử:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>🧪 Khách A — đang tập L1 (bắt đầu 7 ngày trước)</li>
              <li>🧪 Khách B — L2 chưa tới ngày tập</li>
              <li>🧪 Khách C — xong L1, đang tập L3 tái ký</li>
            </ul>
            <p className="text-xs text-emerald-700 pt-1">Thử xong, bấm “Tạo / làm mới dữ liệu test” để đưa về ban đầu.</p>
          </div>
        ) : (
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm text-amber-800 flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>Đây là <b>tài khoản thật</b>. Thao tác khi giả lập (check-in, sửa khách, nộp báo cáo…) được ghi thật như người này làm. Chỉ nên xem.</p>
          </div>
        )}

        <p className="text-xs text-gray-400">
          Cả trang sẽ chuyển sang giao diện của tài khoản này. Thoát bằng nút “Thoát giả lập” ở đầu trang.
        </p>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100">
            Huỷ
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#f15b5c] text-white text-sm font-semibold disabled:opacity-60"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Bắt đầu giả lập
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({
  title, rows, switching, onPick,
}: {
  title: string;
  rows: Row[];
  switching: string | null;
  onPick: (row: Row) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{r.name ?? r.email}</p>
              <p className="text-xs text-gray-400 truncate">
                {r.email}{r.branches.length > 0 && ` · ${r.branches.join(", ")}`}
              </p>
            </div>
            <span className={cn(
              "text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0",
              r.role === "FM" ? "bg-violet-50 text-violet-600"
                : r.role === "PT" ? "bg-sky-50 text-sky-600"
                : "bg-gray-100 text-gray-500",
            )}>
              {ROLE_LABEL[r.role] ?? r.role}
            </span>
            <button
              onClick={() => onPick(r)}
              disabled={switching !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:border-[#f15b5c] hover:text-[#f15b5c] disabled:opacity-50 flex-shrink-0"
            >
              {switching === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
              Giả lập
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
