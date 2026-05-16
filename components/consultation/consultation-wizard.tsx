"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Step1Info } from "./steps/step1-info";
import { Step2Assessment } from "./steps/step2-assessment";
import { Step3Workout } from "./steps/step3-workout";
import { Step4Diet } from "./steps/step4-diet";
import { Step5Sales } from "./steps/step5-sales";

const STEP_LABELS = [
  "CIF",
  "Thẩm định",
  "Chương trình tập",
  "Chế độ ăn",
  "Tư vấn lộ trình",
];

export type ConsultationData = {
  id: string;
  status: "DRAFT" | "COMPLETED";
  currentStep: number;
  createdById: string;
  branchId: string;
  convertedClientId: string | null;
  createdBy: { id: string; name: string | null; email: string; branchId: string | null };
  branch: { id: string; name: string };
  info: Record<string, unknown> | null;
  assessment: Record<string, unknown> | null;
  packages: Array<Record<string, unknown>>;
  workoutDesign: Record<string, unknown> | null;
};

type Branch = { id: string; name: string };
type Staff = { id: string; name: string | null; email: string; branchId: string | null; role: string; managedBranches?: { branchId: string }[] };

export function ConsultationWizard({
  consultation: initial,
  branches,
  staff,
  isAdmin,
  isFM = false,
  userRole,
  enableLevelSystem = true,
}: {
  consultation: ConsultationData;
  branches: Branch[];
  staff: Staff[];
  isAdmin: boolean;
  isFM?: boolean;
  currentUserId: string;
  userRole?: string;
  enableLevelSystem?: boolean;
}) {
  const router = useRouter();
  const [consultation, setConsultation] = useState(initial);
  const [step, setStep] = useState(initial.currentStep);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const isReadOnly = consultation.status === "COMPLETED";

  const save = useCallback(async (payload: Record<string, unknown>, nextStep?: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/consultation/${consultation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, step: nextStep ?? step }),
      });
      const data = await res.json();
      if (res.ok) {
        setConsultation((prev) => ({ ...prev, ...data }));
        setSavedAt(new Date());
        if (nextStep) setStep(nextStep);
      }
    } finally {
      setSaving(false);
    }
  }, [consultation.id, step]);

  async function handleDraft(payload: Record<string, unknown>) {
    await save(payload);
  }

  async function handleNext(payload: Record<string, unknown>) {
    const next = Math.min(step + 1, 5);
    await save(payload, next);
  }

  function handlePrev() {
    setStep((s) => Math.max(s - 1, 1));
  }

  return (
    <div className="max-w-3xl">
      {/* Back link */}
      <button
        onClick={() => router.push("/dashboard/consultation")}
        className="inline-flex items-center gap-1 text-sm font-semibold text-gray-400 hover:text-[#f15b5c] transition-colors mb-5"
      >
        <ChevronLeft className="w-4 h-4" />
        Danh sách tư vấn
      </button>

      {/* Title + auto-save indicator */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-extrabold text-gray-900">
          {consultation.info?.fullName
            ? `Tư vấn: ${consultation.info.fullName as string}`
            : "Hồ sơ tư vấn mới"}
        </h1>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-400 font-semibold">Đang lưu...</span>}
          {!saving && savedAt && (
            <span className="text-xs text-gray-400 font-semibold">
              Đã lưu nháp {savedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {isReadOnly && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
              ✓ Hoàn thành
            </span>
          )}
        </div>
      </div>

      {/* Step progress bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-0">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const isDone = n < step;
            const isActive = n === step;
            const isLocked = !isReadOnly && n > consultation.currentStep;
            const isAccessible = isReadOnly || n <= consultation.currentStep;
            return (
              <div key={n} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => isAccessible && setStep(n)}
                  title={isLocked ? "Hoàn thành bước trước để tiếp tục" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1.5 flex-shrink-0",
                    isAccessible ? "cursor-pointer" : "cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold transition-all",
                    isDone ? "bg-green-500 text-white" :
                    isActive ? "bg-[#f15b5c] text-white shadow-md shadow-[#f15b5c]/30" :
                    isLocked ? "bg-gray-100 text-gray-300" :
                    "bg-gray-100 text-gray-400"
                  )}>
                    {isDone ? <Check className="w-4 h-4" /> :
                     isLocked ? <Lock className="w-3.5 h-3.5" /> :
                     n}
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold text-center leading-tight hidden sm:block",
                    isActive ? "text-[#f15b5c]" : isDone ? "text-green-600" : "text-gray-400"
                  )}>
                    {label}
                  </span>
                </button>
                {i < STEP_LABELS.length - 1 && (
                  <div className={cn(
                    "flex-1 h-0.5 mx-1",
                    n < step ? "bg-green-400" : "bg-gray-100"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        {step === 1 && (
          <Step1Info
            consultation={consultation}
            branches={branches}
            staff={staff}
            isAdmin={isAdmin}
            isFM={isFM}
            isReadOnly={isReadOnly}
            onDraft={handleDraft}
            onNext={handleNext}
          />
        )}
        {step === 2 && (
          <Step2Assessment
            consultation={consultation}
            isReadOnly={isReadOnly}
            onDraft={handleDraft}
            onNext={handleNext}
            onPrev={handlePrev}
          />
        )}
        {step === 3 && (
          <Step3Workout
            onNext={handleNext}
            onPrev={handlePrev}
            isReadOnly={isReadOnly}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            workoutDesign={consultation.workoutDesign as any}
            userRole={userRole}
            enableLevelSystem={enableLevelSystem}
          />
        )}
        {step === 4 && (
          <Step4Diet
            consultation={consultation}
            onNext={handleNext}
            onPrev={handlePrev}
            isReadOnly={isReadOnly}
          />
        )}
        {step === 5 && (
          <Step5Sales
            consultation={consultation}
            isReadOnly={isReadOnly}
            onDraft={handleDraft}
            onPrev={handlePrev}
            onComplete={() => router.push("/dashboard/consultation")}
          />
        )}
      </div>
    </div>
  );
}
