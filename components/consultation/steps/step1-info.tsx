"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ConsultationData } from "../consultation-wizard";

type Branch = { id: string; name: string };
type Staff = { id: string; name: string | null; email: string; branchId: string | null; role: string; managedBranches?: { branchId: string }[] };

const inputCls = "w-full h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-white";
const selectCls = "w-full h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-white";
const textareaCls = "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-white resize-none";

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#f15b5c] px-5 py-2.5 -mx-0 rounded-t-xl">
      <p className="text-sm font-extrabold text-white uppercase tracking-wide">{children}</p>
    </div>
  );
}

function Row({ children, half }: { children: React.ReactNode; half?: boolean }) {
  return (
    <div className={cn("grid gap-3", half ? "grid-cols-2" : "grid-cols-1")}>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-gray-600">
        {label}{required && <span className="text-[#f15b5c] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Slider({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range" min={1} max={10} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="flex-1 accent-[#f15b5c]"
      />
      <span className="w-8 text-center text-sm font-extrabold text-[#f15b5c]">{value}</span>
    </div>
  );
}

function isoToDMY(iso: string | undefined): string {
  if (!iso) return "";
  const datePart = iso.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

function dmyToISO(dmy: string): string | null {
  if (!dmy) return null;
  const parts = dmy.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (!d || !m || !y || y.length !== 4) return null;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return isNaN(date.getTime()) ? null : date.toISOString();
}

export function Step1Info({
  consultation, branches, staff, isAdmin, isFM = false, isReadOnly, onDraft, onNext,
}: {
  consultation: ConsultationData;
  branches: Branch[];
  staff: Staff[];
  isAdmin: boolean;
  isFM?: boolean;
  isReadOnly: boolean;
  onDraft: (payload: Record<string, unknown>) => Promise<void>;
  onNext: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const info = consultation.info as Record<string, unknown> | null;
  const formRef = useRef<HTMLFormElement>(null);

  const [branchId, setBranchId] = useState(consultation.branchId ?? "");
  const [createdById, setCreatedById] = useState(consultation.createdById ?? "");
  const [height, setHeight] = useState<string>((info?.height as string | number | undefined)?.toString() ?? "");
  const [motivationLevel, setMotivationLevel] = useState((info?.motivationLevel as number) ?? 7);
  const [stressLevel, setStressLevel] = useState((info?.stressLevel as number) ?? 5);

  const filteredStaff = branchId
    ? staff.filter((s) =>
        s.branchId === branchId ||
        (s.role === "FM" && s.managedBranches?.some((mb) => mb.branchId === branchId))
      )
    : staff;

  const idealLow = height ? ((Number(height) - 100) * 0.9 - 5).toFixed(1) : null;
  const idealHigh = height ? ((Number(height) - 100) * 0.9 + 5).toFixed(1) : null;

  function buildPayload() {
    const fd = new FormData(formRef.current!);
    const g = (k: string) => (fd.get(k) as string | null) ?? "";
    return {
      createdById,
      branchId,
      info: {
        fullName: g("fullName"),
        phone: g("phone"),
        address: g("address"),
        email: g("email"),
        dateOfBirth: dmyToISO(g("dateOfBirth")),
        consultDate: dmyToISO(g("consultDate")) || new Date().toISOString(),
        knowLDFVia: g("knowLDFVia"),
        familyStatus: g("familyStatus"),
        height: height ? Number(height) : 0,
        currentWeight: g("currentWeight") ? Number(g("currentWeight")) : 0,
        goalDescription: g("goalDescription"),
        targetWeight: g("targetWeight") ? Number(g("targetWeight")) : 0,
        timeToAchieve: g("timeToAchieve"),
        previousAttempts: g("previousAttempts"),
        currentFeeling: g("currentFeeling"),
        whyNow: g("whyNow"),
        familySupport: g("familySupport"),
        motivationLevel,
        barriers: g("barriers"),
        exerciseExperience: g("exerciseExperience"),
        currentDiet: g("currentDiet"),
        mealsPerDay: g("mealsPerDay") ? Number(g("mealsPerDay")) : null,
        typicalMeals: g("typicalMeals"),
        snacking: g("snacking"),
        diningOut: g("diningOut"),
        foodPreferences: g("foodPreferences"),
        foodAllergies: g("foodAllergies"),
        workoutsPerWeek: g("workoutsPerWeek") ? Number(g("workoutsPerWeek")) : null,
        availableTime: g("availableTime"),
        healthConditions: g("healthConditions"),
        injuries: g("injuries"),
        stressLevel,
        sleepQuality: g("sleepQuality"),
        desiredPackage: g("desiredPackage"),
        budget: g("budget"),
        whoPaysBill: g("whoPaysBill"),
      },
    };
  }

  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");

  async function handleNext() {
    const fd = new FormData(formRef.current!);
    if (!fd.get("fullName") || !fd.get("phone")) {
      setValidationError("Vui lòng điền họ tên và số điện thoại");
      return;
    }
    setValidationError("");
    setSubmitting(true);
    await onNext(buildPayload());
    setSubmitting(false);
  }

  async function handleDraft() {
    setSubmitting(true);
    await onDraft(buildPayload());
    setSubmitting(false);
  }

  const defaultConsultDate = info?.consultDate
    ? isoToDMY(info.consultDate as string)
    : isoToDMY(new Date().toISOString());

  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="divide-y divide-gray-50">
      {/* PT + Branch selection */}
      <div className="p-5 space-y-3">
        <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Phân công</p>
        <Row half>
          <Field label="Cơ sở đăng ký" required>
            <select value={branchId} onChange={(e) => { setBranchId(e.target.value); setCreatedById(""); }} disabled={isReadOnly} className={selectCls}>
              <option value="">— Chọn cơ sở —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Nhân sự phụ trách" required>
            <select value={createdById} onChange={(e) => setCreatedById(e.target.value)} disabled={(!isAdmin && !isFM) || isReadOnly} className={selectCls}>
              <option value="">— Chọn nhân sự —</option>
              {filteredStaff.map((s) => <option key={s.id} value={s.id}>{s.name ?? s.email}</option>)}
            </select>
          </Field>
        </Row>
      </div>

      {/* Section 1 */}
      <div className="overflow-hidden rounded-none">
        <SectionHeader>Thông tin cá nhân</SectionHeader>
        <div className="p-5 space-y-3">
          <Row half>
            <Field label="Họ & tên" required>
              <input name="fullName" defaultValue={(info?.fullName as string) ?? ""} disabled={isReadOnly} placeholder="Nguyễn Thị A" className={inputCls} />
            </Field>
            <Field label="Điện thoại" required>
              <input name="phone" defaultValue={(info?.phone as string) ?? ""} disabled={isReadOnly} placeholder="09xxxxxxxx" className={inputCls} />
            </Field>
          </Row>
          <Row half>
            <Field label="Địa chỉ">
              <input name="address" defaultValue={(info?.address as string) ?? ""} disabled={isReadOnly} placeholder="Số nhà, đường, quận..." className={inputCls} />
            </Field>
            <Field label="Email">
              <input name="email" type="email" defaultValue={(info?.email as string) ?? ""} disabled={isReadOnly} placeholder="khachhang@email.com" className={inputCls} />
            </Field>
          </Row>
          <Row half>
            <Field label="Ngày sinh (dd/mm/yyyy)">
              <input name="dateOfBirth" defaultValue={isoToDMY(info?.dateOfBirth as string | undefined)} disabled={isReadOnly} placeholder="dd/mm/yyyy" className={inputCls} />
            </Field>
            <Field label="Ngày tư vấn (dd/mm/yyyy)">
              <input name="consultDate" defaultValue={defaultConsultDate} disabled={isReadOnly} placeholder="dd/mm/yyyy" className={inputCls} />
            </Field>
          </Row>
        </div>
      </div>

      {/* Section 2 */}
      <div>
        <div className="bg-gray-50 px-5 py-2.5">
          <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Thông tin thêm</p>
        </div>
        <div className="p-5 space-y-3">
          <Row half>
            <Field label="Biết LDF qua đâu?">
              <select name="knowLDFVia" defaultValue={(info?.knowLDFVia as string) ?? ""} disabled={isReadOnly} className={selectCls}>
                <option value="">— Chọn —</option>
                {["Bạn bè", "Tivi", "Hội viên cũ", "Website", "Báo, tạp chí", "Biển hiệu", "Facebook", "Tờ rơi", "Tiktok", "Instagram", "Thread", "Referral.PT"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Tình trạng gia đình">
              <select name="familyStatus" defaultValue={(info?.familyStatus as string) ?? ""} disabled={isReadOnly} className={selectCls}>
                <option value="">— Chọn —</option>
                {["Độc thân", "Đã lập gia đình nhưng chưa có con", "Đã lập gia đình và đã có con"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </Field>
          </Row>
        </div>
      </div>

      {/* Section 3 */}
      <div className="overflow-hidden">
        <SectionHeader>Mục tiêu tập luyện</SectionHeader>
        <div className="p-5 space-y-3">
          <Row half>
            <Field label="Chiều cao (cm)" required>
              <input
                type="number" step="0.1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                disabled={isReadOnly}
                placeholder="158"
                className={inputCls}
              />
            </Field>
            <Field label="Cân nặng hiện tại (kg)" required>
              <input name="currentWeight" type="number" step="0.1" defaultValue={(info?.currentWeight as string | number | undefined)?.toString() ?? ""} disabled={isReadOnly} placeholder="68" className={inputCls} />
            </Field>
          </Row>
          {idealLow && (
            <p className="text-xs text-blue-500 font-semibold">
              Cân nặng lý tưởng: {idealLow} – {idealHigh} kg
            </p>
          )}
          <Field label="Mục tiêu của bạn">
            <input name="goalDescription" defaultValue={(info?.goalDescription as string) ?? ""} disabled={isReadOnly} placeholder="VD: Giảm 20kg, Săn chắc cơ thể, Cải thiện sức khỏe..." className={inputCls} />
          </Field>
          <Row half>
            <Field label="Cân nặng mục tiêu (kg)">
              <input name="targetWeight" type="number" step="0.1" defaultValue={(info?.targetWeight as string | number | undefined)?.toString() ?? ""} disabled={isReadOnly} placeholder="55" className={inputCls} />
            </Field>
            <Field label="Bạn muốn đạt mục tiêu này trong vòng bao lâu?">
              <input name="timeToAchieve" defaultValue={(info?.timeToAchieve as string) ?? ""} disabled={isReadOnly} placeholder="3 tháng, 6 tháng..." className={inputCls} />
            </Field>
          </Row>
          <Field label="Bạn đã suy nghĩ về mục tiêu này bao lâu rồi mà chưa đạt được?">
            <input name="previousAttempts" defaultValue={(info?.previousAttempts as string) ?? ""} disabled={isReadOnly} className={inputCls} />
          </Field>
          <Field label="Cảm xúc của bạn thế nào về cân nặng hiện tại?">
            <textarea name="currentFeeling" rows={2} defaultValue={(info?.currentFeeling as string) ?? ""} disabled={isReadOnly} className={textareaCls} />
          </Field>
        </div>
      </div>

      {/* Section 4 */}
      <div>
        <div className="bg-gray-50 px-5 py-2.5">
          <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Động lực tập luyện</p>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Tại sao bạn quyết định tập để thay đổi vóc dáng vào thời điểm này?">
            <textarea name="whyNow" rows={2} defaultValue={(info?.whyNow as string) ?? ""} disabled={isReadOnly} className={textareaCls} />
          </Field>
          <Field label="Gia đình có ủng hộ mình thay đổi vóc dáng không?">
            <select name="familySupport" defaultValue={(info?.familySupport as string) ?? ""} disabled={isReadOnly} className={selectCls}>
              <option value="">— Chọn —</option>
              {["Có", "Không", "Chưa biết"].map((v) => <option key={v}>{v}</option>)}
            </select>
          </Field>
          <Field label={`Mức độ quyết tâm thay đổi vóc dáng: ${motivationLevel}/10`}>
            <Slider value={motivationLevel} onChange={setMotivationLevel} disabled={isReadOnly} />
          </Field>
          <Field label="Có rào cản nào ngăn cản bạn đến với việc tập luyện không?">
            <textarea name="barriers" rows={2} defaultValue={(info?.barriers as string) ?? ""} disabled={isReadOnly} className={textareaCls} />
          </Field>
        </div>
      </div>

      {/* Section 5 */}
      <div>
        <div className="bg-gray-50 px-5 py-2.5">
          <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Kinh nghiệm tập luyện & ăn uống</p>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Kinh nghiệm tập luyện">
            <textarea name="exerciseExperience" rows={2} defaultValue={(info?.exerciseExperience as string) ?? ""} disabled={isReadOnly} className={textareaCls} />
          </Field>
          <Field label="Chế độ ăn đang áp dụng">
            <input name="currentDiet" defaultValue={(info?.currentDiet as string) ?? ""} disabled={isReadOnly} className={inputCls} />
          </Field>
          <Row half>
            <Field label="Số bữa ăn/ngày">
              <input name="mealsPerDay" type="number" min={1} max={10} defaultValue={(info?.mealsPerDay as string | number | undefined)?.toString() ?? ""} disabled={isReadOnly} placeholder="3" className={inputCls} />
            </Field>
            <Field label="Số buổi tập/tuần">
              <input name="workoutsPerWeek" type="number" min={0} max={14} defaultValue={(info?.workoutsPerWeek as string | number | undefined)?.toString() ?? ""} disabled={isReadOnly} placeholder="4" className={inputCls} />
            </Field>
          </Row>
          <Field label="Những bữa đó thường ăn gì?">
            <textarea name="typicalMeals" rows={2} defaultValue={(info?.typicalMeals as string) ?? ""} disabled={isReadOnly} className={textareaCls} />
          </Field>
          <Field label="Ngoài bữa chính thì có ăn gì khác không?">
            <input name="snacking" defaultValue={(info?.snacking as string) ?? ""} disabled={isReadOnly} className={inputCls} />
          </Field>
          <Field label="Có hay đi ăn ngoài không?">
            <input name="diningOut" defaultValue={(info?.diningOut as string) ?? ""} disabled={isReadOnly} className={inputCls} />
          </Field>
          <Field label="Thích hoặc ghét món ăn nào?">
            <input name="foodPreferences" defaultValue={(info?.foodPreferences as string) ?? ""} disabled={isReadOnly} className={inputCls} />
          </Field>
          <Field label="Dị ứng thực phẩm?">
            <input name="foodAllergies" defaultValue={(info?.foodAllergies as string) ?? ""} disabled={isReadOnly} className={inputCls} />
          </Field>
          <Field label="Có thể tập vào thời gian nào?">
            <input name="availableTime" defaultValue={(info?.availableTime as string) ?? ""} disabled={isReadOnly} placeholder="Sáng sớm, buổi tối..." className={inputCls} />
          </Field>
        </div>
      </div>

      {/* Section 6 */}
      <div className="overflow-hidden">
        <SectionHeader>Đặc điểm công việc, lối sống & bệnh lý</SectionHeader>
        <div className="p-5 space-y-3">
          <Field label="Bệnh lý cần lưu tâm (huyết áp, tim mạch, xương khớp...)">
            <textarea name="healthConditions" rows={2} defaultValue={(info?.healthConditions as string) ?? ""} disabled={isReadOnly} className={textareaCls} />
          </Field>
          <Field label="Chấn thương (đau mỏi gáy, thắt lưng, giãn tĩnh mạch...)">
            <textarea name="injuries" rows={2} defaultValue={(info?.injuries as string) ?? ""} disabled={isReadOnly} className={textareaCls} />
          </Field>
          <Field label={`Mức độ căng thẳng trong cuộc sống: ${stressLevel}/10`}>
            <Slider value={stressLevel} onChange={setStressLevel} disabled={isReadOnly} />
          </Field>
          <Field label="Chất lượng giấc ngủ">
            <select name="sleepQuality" defaultValue={(info?.sleepQuality as string) ?? ""} disabled={isReadOnly} className={selectCls}>
              <option value="">— Chọn —</option>
              {["Tốt", "Bình thường", "Khó ngủ", "Mất ngủ"].map((v) => <option key={v}>{v}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {/* Section 7 */}
      <div className="overflow-hidden">
        <SectionHeader>Mong muốn của bản thân</SectionHeader>
        <div className="p-5 space-y-3">
          <Field label="Bạn đang mong muốn gì ở một gói tập PT hiện tại?">
            <select name="desiredPackage" defaultValue={(info?.desiredPackage as string) ?? ""} disabled={isReadOnly} className={selectCls}>
              <option value="">— Chọn —</option>
              {["Tập PT từ đầu đến lúc đẹp", "Tập PT một thời gian rồi sau tự tập", "Tập một gói tập tiết kiệm nhất có thể"].map((v) => <option key={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Gói tập sẽ tự chi trả hay được gia đình hỗ trợ?">
            <select name="whoPaysBill" defaultValue={(info?.whoPaysBill as string) ?? ""} disabled={isReadOnly} className={selectCls}>
              <option value="">— Chọn —</option>
              {["Tự chi trả", "Gia đình hỗ trợ một phần", "Gia đình hỗ trợ toàn phần"].map((v) => <option key={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Mức chi phí mong muốn">
            <select name="budget" defaultValue={(info?.budget as string) ?? ""} disabled={isReadOnly} className={selectCls}>
              <option value="">— Chọn —</option>
              {["Dưới 10 triệu", "10–20 triệu", "20–30 triệu", "30–50 triệu", "Trên 50 triệu"].map((v) => <option key={v}>{v}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {/* Validation error */}
      {validationError && (
        <div className="px-5 pt-4">
          <p className="text-sm text-[#f15b5c] font-semibold">{validationError}</p>
        </div>
      )}

      {/* Actions */}
      {!isReadOnly && (
        <div className="p-5 flex gap-3">
          <button
            type="button"
            onClick={handleDraft}
            disabled={submitting}
            className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Lưu nháp
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={submitting}
            className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: "#f15b5c" }}
          >
            {submitting ? "Đang lưu..." : "Lưu & Tiếp tục →"}
          </button>
        </div>
      )}
    </form>
  );
}
