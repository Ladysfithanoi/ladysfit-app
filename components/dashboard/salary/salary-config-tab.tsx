"use client";

import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { DateMaskInput } from "@/components/ui/date-mask-input";
import type { Branch, StaffMember } from "./salary-page";

/**
 * Cấu hình lương của từng nhân sự.
 *
 * HAI MỐC NGÀY TÁCH RỜI, đừng gộp lại:
 *   • Ngày làm chính thức — lương thâm niên bắt đầu đếm từ đây.
 *   • Ngày nhận bảo hiểm  — BHXH bắt đầu từ đây, thường muộn hơn vì còn thử việc.
 *
 * Ngày BẮT ĐẦU LÀM VIỆC (mốc của lịch nghỉ) không nằm ở đây mà ở thông tin nhân
 * sự — xem `User.employmentStartDate` và lib/leave-days.ts.
 */
type Config = {
  baseSalary:         string;
  seniorityYears:     number;
  officialStartDate:  string;
  insuranceStartDate: string;
  effectiveFrom:      string;
  saving:             boolean;
};

type Props = {
  branches: Branch[];
  staffList: StaffMember[];
  currentFMId: string;
  currentFMName: string;
};

const FM_BASE         = 5_500_000;
const FM_LUNCH        = 2_600_000;
const FM_PHONE        = 900_000;
const FM_TRANSPORT    = 500_000;
const FM_FIXED_TOTAL  = FM_BASE + FM_LUNCH + FM_PHONE + FM_TRANSPORT;
const PT_DEFAULT_BASE = 5_310_000;

/** Thưởng thâm niên mỗi năm và số năm được tính tối đa. */
const FM_PER_YEAR   = 9_000_000;
const PT_PER_YEAR   = 6_000_000;
const MAX_SENIORITY = 4;

const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";

const PT_TIERS = [
  { label: "Dưới 38M",    rate: "1%"   },
  { label: "38M – 59.9M", rate: "2.5%" },
  { label: "60M – 85.9M", rate: "3.5%" },
  { label: "86M trở lên", rate: "4%"   },
];

const FM_TIERS = [
  { label: "Dưới 100M",     rate: "0%"   },
  { label: "100M – 139.9M", rate: "1%"   },
  { label: "140M – 199.9M", rate: "1.5%" },
  { label: "200M trở lên",  rate: "2%"   },
];

/**
 * Lương cơ bản mặc định khi chưa cấu hình. Nhân sự STAFF (lao công, marketing…)
 * mỗi chức vụ một mức nên để 0 — FM phải tự nhập, không lấy nhầm mức lương PT.
 */
function defaultBase(isFM: boolean, isStaff = false): number {
  return isFM ? FM_BASE : isStaff ? 0 : PT_DEFAULT_BASE;
}

function makeDefault(isFM: boolean, isStaff = false): Config {
  return {
    baseSalary:         String(defaultBase(isFM, isStaff)),
    seniorityYears:     0,
    officialStartDate:  "",
    insuranceStartDate: "",
    effectiveFrom:      new Date().toISOString().split("T")[0],
    saving:             false,
  };
}

/**
 * Số năm TRÒN từ một mốc ngày tới hôm nay. Chưa tới ngày kỷ niệm trong năm thì
 * chưa được tính thêm năm — đó là cách "tính thâm niên từ ngày làm chính thức".
 * Ô trống hoặc ngày chưa gõ xong trả `null`.
 */
function yearsSince(ymd: string): number | null {
  if (!ymd) return null;
  const from = new Date(`${ymd}T00:00:00.000Z`);
  if (isNaN(from.getTime())) return null;

  const now = new Date();
  const beforeAnniversary =
    now.getUTCMonth() < from.getUTCMonth() ||
    (now.getUTCMonth() === from.getUTCMonth() && now.getUTCDate() < from.getUTCDate());
  return Math.max(0, now.getUTCFullYear() - from.getUTCFullYear() - (beforeAnniversary ? 1 : 0));
}

const inputCls   = "h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 w-full";
const roFieldCls = "h-9 flex items-center px-3 text-sm font-semibold text-gray-700 bg-gray-50 rounded-xl border border-gray-100";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">{children}</p>
  );
}

function FieldBox({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1 min-w-0">
      <label className="text-xs font-semibold text-gray-500">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 leading-snug">{hint}</p>}
    </div>
  );
}

/** Hai mốc ngày của bảng lương — dùng chung cho cả thẻ FM lẫn thẻ PT. */
function MilestoneFields({
  cfg,
  onPatch,
}: {
  cfg: Config;
  onPatch: (update: Partial<Config>) => void;
}) {
  const years = yearsSince(cfg.officialStartDate);

  // Gõ xong ngày làm chính thức thì điền luôn số năm thâm niên tương ứng, để
  // hai ô không nói hai chuyện khác nhau. Vẫn sửa tay đè lên được — có trường
  // hợp thâm niên được công nhận khác với thời gian thực tế trên giấy tờ.
  function setOfficial(value: string) {
    const computed = yearsSince(value);
    onPatch({
      officialStartDate: value,
      ...(computed === null ? {} : { seniorityYears: Math.min(computed, MAX_SENIORITY) }),
    });
  }

  return (
    <div>
      <SectionTitle>Mốc thời gian</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <FieldBox
          label="Ngày làm chính thức"
          hint={
            years === null
              ? "Lương thâm niên bắt đầu tính từ mốc này."
              : `Lương thâm niên tính từ mốc này — tới nay là ${years} năm.`
          }
        >
          <DateMaskInput
            value={cfg.officialStartDate}
            onChange={setOfficial}
            className={inputCls}
          />
        </FieldBox>
        <FieldBox label="Ngày nhận bảo hiểm" hint="Bắt đầu đóng và hưởng BHXH từ mốc này.">
          <DateMaskInput
            value={cfg.insuranceStartDate}
            onChange={v => onPatch({ insuranceStartDate: v })}
            className={inputCls}
          />
        </FieldBox>
      </div>
    </div>
  );
}

/** Số năm thâm niên và khoản thưởng đi kèm. */
function SeniorityFields({
  cfg,
  perYear,
  onPatch,
}: {
  cfg: Config;
  perYear: number;
  onPatch: (update: Partial<Config>) => void;
}) {
  return (
    <div>
      <SectionTitle>Thâm niên</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <FieldBox label={`Số năm thâm niên (0–${MAX_SENIORITY})`}>
          <select
            value={cfg.seniorityYears}
            onChange={e => onPatch({ seniorityYears: Number(e.target.value) })}
            className={inputCls}
          >
            {Array.from({ length: MAX_SENIORITY + 1 }, (_, y) => (
              <option key={y} value={y}>
                {y} năm{y > 0 ? ` (+${vnd(y * perYear)})` : ""}
              </option>
            ))}
          </select>
        </FieldBox>
        <FieldBox label="Thưởng thâm niên">
          <div className={roFieldCls}>
            {cfg.seniorityYears > 0
              ? vnd(Math.min(cfg.seniorityYears, MAX_SENIORITY) * perYear)
              : "—"}
          </div>
        </FieldBox>
      </div>
    </div>
  );
}

function TierTable({ tiers, note }: { tiers: { label: string; rate: string }[]; note: string }) {
  return (
    <div>
      <SectionTitle>Chính sách hoa hồng (toàn công ty)</SectionTitle>
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[#f5f5f5] border-b border-gray-200">
              <th className="px-3 py-2 text-left font-bold text-gray-400 border-r border-gray-200">Doanh số</th>
              <th className="px-3 py-2 text-left font-bold text-gray-400">% Hoa hồng</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t, i) => (
              <tr key={i} className="border-b border-gray-100 last:border-0 divide-x divide-gray-100">
                <td className="px-3 py-2 text-gray-600">{t.label}</td>
                <td className="px-3 py-2 font-semibold text-gray-700">{t.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-400 italic mt-1.5">{note}</p>
    </div>
  );
}

/** Khung thẻ cấu hình của một người: tên, nhãn vai trò, nội dung, nút lưu. */
function ConfigCard({
  name,
  badge,
  badgeCls,
  saving,
  onSave,
  children,
}: {
  name: string;
  badge: string;
  badgeCls: string;
  saving: boolean;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold text-gray-700 truncate">{name}</p>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${badgeCls}`}>
          {badge}
        </span>
      </div>
      <div className="p-4 sm:p-5 space-y-5">
        {children}
        <div className="flex justify-stretch sm:justify-end pt-3 border-t border-gray-100">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60"
            style={{ backgroundColor: "#f15b5c" }}
          >
            <Save className="w-4 h-4" />
            {saving ? "Đang lưu..." : "Lưu cấu hình"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SalaryConfigTab({ branches, staffList, currentFMId, currentFMName }: Props) {
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id ?? "");
  const [configs, setConfigs] = useState<Record<string, Config>>({});
  const [toast, setToast] = useState("");

  const branchPTs = staffList.filter(s => s.branchId === selectedBranchId && s.id !== currentFMId && s.role !== "ADMIN");

  useEffect(() => {
    async function loadOne(userId: string, isFM: boolean, isStaff = false) {
      try {
        const res = await fetch(`/api/salary/config?userId=${userId}`);
        if (!res.ok) { setConfigs(prev => ({ ...prev, [userId]: makeDefault(isFM, isStaff) })); return; }
        const data = await res.json() as {
          baseSalary: number; seniorityYears: number;
          officialStartDate: string | null; insuranceStartDate: string | null;
          effectiveFrom: string;
        } | null;
        const ymd = (iso: string | null | undefined) =>
          iso ? new Date(iso).toISOString().split("T")[0] : "";
        setConfigs(prev => ({
          ...prev,
          [userId]: {
            baseSalary:         String(data ? data.baseSalary : defaultBase(isFM, isStaff)),
            seniorityYears:     data?.seniorityYears ?? 0,
            officialStartDate:  ymd(data?.officialStartDate),
            insuranceStartDate: ymd(data?.insuranceStartDate),
            effectiveFrom:      data?.effectiveFrom
              ? new Date(data.effectiveFrom).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0],
            saving: false,
          },
        }));
      } catch { /* ignore */ }
    }

    loadOne(currentFMId, true);
    staffList
      .filter(s => s.branchId === selectedBranchId && s.id !== currentFMId && s.role !== "ADMIN")
      .forEach(s => loadOne(s.id, false, s.role === "STAFF"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

  function getCfg(userId: string, isFM = false, isStaff = false): Config {
    return configs[userId] ?? makeDefault(isFM, isStaff);
  }

  function patch(userId: string, update: Partial<Config>) {
    setConfigs(prev => ({ ...prev, [userId]: { ...(prev[userId] ?? makeDefault(false)), ...update } }));
  }

  async function handleSave(userId: string, isFM: boolean) {
    const isStaff = staffList.find(s => s.id === userId)?.role === "STAFF";
    const cfg = getCfg(userId, isFM, isStaff);
    const branchId = isFM
      ? selectedBranchId
      : (staffList.find(s => s.id === userId)?.branchId ?? selectedBranchId);
    patch(userId, { saving: true });
    try {
      const body: Record<string, unknown> = {
        userId,
        branchId,
        baseSalary:         isFM ? FM_BASE : (parseFloat(cfg.baseSalary) || defaultBase(false, isStaff)),
        // STAFF không có thưởng thâm niên.
        seniorityYears:     isStaff ? 0 : cfg.seniorityYears,
        officialStartDate:  cfg.officialStartDate  || null,
        insuranceStartDate: cfg.insuranceStartDate || null,
        effectiveFrom:      cfg.effectiveFrom,
        ...(isFM ? { lunchAllowance: FM_LUNCH, phoneAllowance: FM_PHONE, transportAllowance: FM_TRANSPORT } : {}),
      };
      const res = await fetch("/api/salary/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setToast("Đã lưu cấu hình ✓");
        setTimeout(() => setToast(""), 3000);
      }
    } finally {
      patch(userId, { saving: false });
    }
  }

  const fmCfg = getCfg(currentFMId, true);

  return (
    <div className="space-y-5 max-w-3xl">
      {branches.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Chi nhánh:</label>
          <select
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
            className="h-9 min-w-0 flex-1 sm:flex-none sm:w-64 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
          >
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {/* ── FM own config ── */}
      <ConfigCard
        name={currentFMName}
        badge="FM"
        badgeCls="bg-[#f15b5c]/10 text-[#f15b5c]"
        saving={fmCfg.saving}
        onSave={() => handleSave(currentFMId, true)}
      >
        <div>
          <SectionTitle>Lương &amp; phụ cấp cố định</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: "Lương cơ bản",       val: FM_BASE      },
              { label: "Phụ cấp ăn trưa",    val: FM_LUNCH     },
              { label: "Phụ cấp điện thoại", val: FM_PHONE     },
              { label: "Phụ cấp xăng xe",    val: FM_TRANSPORT },
            ].map(({ label, val }) => (
              <FieldBox key={label} label={label}>
                <div className={roFieldCls}>{vnd(val)}</div>
              </FieldBox>
            ))}
            <FieldBox label="Tổng cố định">
              <div className={roFieldCls} style={{ color: "#f15b5c", fontWeight: 800 }}>
                {vnd(FM_FIXED_TOTAL)}
              </div>
            </FieldBox>
          </div>
        </div>

        <MilestoneFields cfg={fmCfg} onPatch={u => patch(currentFMId, u)} />
        <SeniorityFields cfg={fmCfg} perYear={FM_PER_YEAR} onPatch={u => patch(currentFMId, u)} />
        <TierTable tiers={FM_TIERS} note="* Tính trên tổng doanh thu chi nhánh trong tháng" />
      </ConfigCard>

      {/* ── PT config cards ── */}
      {branchPTs.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400 italic">
          Không có nhân sự trong chi nhánh này
        </div>
      ) : (
        branchPTs.map(staff => {
          const isStaff = staff.role === "STAFF";
          const cfg = getCfg(staff.id, false, isStaff);
          return (
            <ConfigCard
              key={staff.id}
              name={staff.name ?? staff.email}
              badge={isStaff ? (staff.positionName ?? "Nhân sự") : "PT"}
              badgeCls={isStaff ? "bg-gray-100 text-gray-600" : "bg-blue-50 text-blue-500"}
              saving={cfg.saving}
              onSave={() => handleSave(staff.id, false)}
            >
              <div>
                <SectionTitle>Lương cơ bản</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <FieldBox label="Lương cơ bản" hint={vnd(parseFloat(cfg.baseSalary) || 0)}>
                    <input
                      type="number"
                      step="10000"
                      inputMode="numeric"
                      value={cfg.baseSalary}
                      onFocus={e => e.target.select()}
                      onChange={e => patch(staff.id, { baseSalary: e.target.value })}
                      className={inputCls}
                    />
                  </FieldBox>
                </div>
              </div>

              <MilestoneFields cfg={cfg} onPatch={u => patch(staff.id, u)} />
              {/* STAFF chỉ có lương cứng theo ngày công — không thâm niên, không hoa hồng. */}
              {!isStaff && (
                <>
                  <SeniorityFields cfg={cfg} perYear={PT_PER_YEAR} onPatch={u => patch(staff.id, u)} />
                  <TierTable tiers={PT_TIERS} note="* % áp dụng theo bậc toàn bộ doanh số tháng" />
                </>
              )}
            </ConfigCard>
          );
        })
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
