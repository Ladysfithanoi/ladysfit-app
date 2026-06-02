"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateMaskInput } from "@/components/ui/date-mask-input";
import { Label } from "@/components/ui/label";
import { SlideOver } from "@/components/ui/slide-over";
import { Popover } from "@/components/ui/popover";
import { MiniWeightChart, DetailWeightChart, ChartPoint } from "@/components/dashboard/weight-log-charts";
import {
  ChevronLeft, ChevronDown, Star, Pencil, Plus, Scale,
  Salad, User, Heart, BarChart2, Info,
  TrendingDown, TrendingUp, Package, Trash2, Dumbbell, Footprints, Timer, RefreshCw, Loader2,
} from "lucide-react";
import { WorkoutTab, type WorkoutProgram, type WorkoutLogRow } from "@/components/dashboard/workout-tab";
import { NutritionTab } from "@/components/dashboard/nutrition-tab";
import type { MealPlanRow } from "@/components/dashboard/nutrition-designer";
import { StepsBarChart, MinutesBarChart, type ActivityChartPoint } from "@/components/dashboard/activity-log-charts";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { BodyMeasurementsSection } from "@/components/dashboard/body-measurements-section";
import { PACKAGES } from "@/lib/packages";
import { cn } from "@/lib/utils";

type Branch = { id: string; name: string };
type PT = { id: string; name: string | null; email: string; branchId?: string | null; role?: string };
type WeightLog = { id: string; date: string; weight: number; note: string | null };
type ActivityLogItem = { id: string; date: string; steps: number | null; minutesActive: number | null; note: string | null };
type PackageEnrollment = {
  id: string;
  packageName: string;
  packageStage: string;
  sessions: number;
  sessionsUsed: number;
  startDate: string | null;
  endDate: string | null;
  durationDays: number;
  reservedDays: number;
  extensionDays: number;
  price: number;
  contractType: "NORMAL" | "KOC" | "KOL";
  status: "ACTIVE" | "COMPLETED" | "PAUSED" | "EXPIRED";
  notes: string | null;
  contractCode: string | null;
  createdAt: string;
};

type ClientDetail = {
  id: string;
  clientCode: string | null;
  fullName: string;
  phone: string;
  email: string | null;
  passwordSetAt: string | null;
  dateOfBirth: string | null;
  initialWeight: number;
  currentWeight: number;
  targetWeight: number;
  height: number;
  initialWaist: number | null;
  initialHip: number | null;
  healthConditions: string | null;
  injuries: string | null;
  targetDate: string | null;
  goalNote: string | null;
  myPlateImageUrl: string | null;
  myPlateNote: string | null;
  avatarUrl: string | null;
  dietPhase: string;
  status: "ACTIVE" | "PAUSED" | "RESERVED";
  createdAt: string;
  assignedPT: PT;
  branch: Branch;
  weightLogs: WeightLog[];
};

type FoodScanLogItem = {
  id: string;
  scanDate: string;
  foodName: string;
  quantity: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
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

const PKG_STATUS_STYLE = {
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  PAUSED: "bg-yellow-100 text-yellow-700",
  EXPIRED: "bg-red-100 text-red-700",
};
const PKG_STATUS_LABEL = {
  ACTIVE: "Đang tập",
  COMPLETED: "Hoàn thành",
  PAUSED: "Tạm dừng",
  EXPIRED: "Hết hạn",
};

// Real-time status override: if DB says ACTIVE but endDate has passed → EXPIRED
function getEffectiveStatus(pkg: PackageEnrollment): "ACTIVE" | "COMPLETED" | "PAUSED" | "EXPIRED" {
  if (pkg.status === "ACTIVE" && pkg.endDate) {
    if (Date.now() > new Date(pkg.endDate).getTime()) return "EXPIRED";
  }
  return pkg.status;
}

function formatPrice(n: number) {
  return (n / 1_000_000).toFixed(0) + " triệu";
}

function getBMIInfo(bmi: number) {
  if (bmi < 18.5) return { label: "Thiếu cân", color: "text-blue-500" };
  if (bmi < 25)   return { label: "Bình thường", color: "text-green-600" };
  if (bmi < 30)   return { label: "Thừa cân", color: "text-orange-500" };
  return { label: "Béo phì", color: "text-red-500" };
}

function getWHRInfo(whr: number) {
  if (whr < 0.80)  return { label: "An toàn", color: "text-green-600" };
  if (whr <= 0.85) return { label: "Nguy cơ", color: "text-orange-500" };
  return { label: "Nguy hiểm", color: "text-red-500" };
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  // Parse date-only part directly to avoid UTC↔local timezone offset
  const datePart = iso.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return "—";
  const [y, m, d] = parts;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function dmyToISO(dmy: string): string {
  const parts = dmy.split("/");
  if (parts.length !== 3) return "";
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function maskDate(value: string): string {
  let clean = value.replace(/\D/g, "");
  if (clean.length > 8) clean = clean.slice(0, 8);
  if (clean.length > 4) return clean.slice(0, 2) + "/" + clean.slice(2, 4) + "/" + clean.slice(4);
  if (clean.length > 2) return clean.slice(0, 2) + "/" + clean.slice(2);
  return clean;
}

function isoToDmy(iso: string | null): string {
  if (!iso) return "";
  const date = iso.split("T")[0];
  const [y, m, d] = date.split("-");
  return d && m && y ? `${d}/${m}/${y}` : "";
}

function isoToYMD(iso: string | null): string {
  if (!iso) return "";
  return iso.split("T")[0]; // "YYYY-MM-DD" for type="date"
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0 gap-4">
      <span className="text-xs text-gray-400 font-semibold shrink-0">{label}</span>
      <span className="text-sm font-semibold text-gray-800 text-right">{value ?? "—"}</span>
    </div>
  );
}

function getAvailablePackages(
  currentWeight: number,
  height: number,
  existingPackages: PackageEnrollment[]
): { names: string[]; note: string; noteOk: boolean } {
  const hasL1orL2 = existingPackages.some((p) => p.packageName === "L1" || p.packageName === "L2");
  const hasAny = existingPackages.length > 0;

  const weightDiff = currentWeight - (height - 100);
  const eligibleL2 = weightDiff > 6;
  const eligibleL1 = weightDiff > 3 && weightDiff <= 6;

  let names: string[] = ["L3", "L4", "L5"];
  if (hasAny) names.push("Loyalfit");
  names.push("KOC");

  let note: string;
  let noteOk = false;

  if (hasL1orL2) {
    note = "ℹ️ Đã sử dụng gói Giai đoạn 1";
  } else if (eligibleL2) {
    names = ["L1", "L2", ...names];
    note = `✓ Đủ điều kiện L2 (${currentWeight} − ${height} + 100 = ${weightDiff.toFixed(1)} kg > 6 kg) — có thể chọn L1 hoặc L2`;
    noteOk = true;
  } else if (eligibleL1) {
    names = ["L1", ...names];
    note = `✓ Đủ điều kiện L1 (${currentWeight} − ${height} + 100 = ${weightDiff.toFixed(1)} kg > 3 kg)`;
    noteOk = true;
  } else {
    note = `ℹ️ Không đủ điều kiện L1/L2, bắt đầu từ Giai đoạn 2 (${currentWeight} − ${height} + 100 = ${weightDiff.toFixed(1)} kg ≤ 3 kg)`;
  }

  return { names, note, noteOk };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest pt-2 pb-1 border-b border-gray-100">
      {children}
    </p>
  );
}

function Field({ label, children, half }: { label: string; children: React.ReactNode; half?: boolean }) {
  return (
    <div className={cn("space-y-1.5", half && "flex-1")}>
      <Label className="text-sm font-semibold text-gray-700">{label}</Label>
      {children}
    </div>
  );
}

export function ClientDetailPage({
  client,
  branches,
  staffList,
  packages: initialPackages,
  workoutPrograms: initialWorkoutPrograms,
  workoutLogs: initialWorkoutLogs,
  mealPlans: initialMealPlans,
  activityLogs: initialActivityLogs = [],
  userRole,
  currentUserId,
  isSubstitute,
  enableLevelSystem = true,
}: {
  client: ClientDetail;
  branches: Branch[];
  staffList: PT[];
  packages: PackageEnrollment[];
  workoutPrograms: WorkoutProgram[];
  workoutLogs?: WorkoutLogRow[];
  mealPlans?: MealPlanRow[];
  activityLogs?: ActivityLogItem[];
  userRole?: string;
  currentUserId?: string;
  isSubstitute?: boolean;
  enableLevelSystem?: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<"overview" | "detail" | "workout" | "nutrition">("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [weightError, setWeightError] = useState("");
  const [editError, setEditError] = useState("");
  const [editGeneration, setEditGeneration] = useState(0);
  const [accountEmail, setAccountEmail] = useState(client.email ?? "");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [savedPassword, setSavedPassword] = useState("");
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(client.avatarUrl ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [accountSuccess, setAccountSuccess] = useState(false);
  const [packages, setPackages] = useState<PackageEnrollment[]>(initialPackages);
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [pkgStartDate, setPkgStartDate] = useState("");
  const [pkgUpdateLoading, setPkgUpdateLoading] = useState(false);
  const [addPkgName, setAddPkgName] = useState("");
  const [addPkgLoading, setAddPkgLoading] = useState(false);
  const [addPkgError, setAddPkgError] = useState("");
  const [deletingPkgId, setDeletingPkgId] = useState<string | null>(null);
  const [deletePkgLoading, setDeletePkgLoading] = useState(false);
  const [deletePkgError, setDeletePkgError] = useState("");
  const [pkgContractInputs, setPkgContractInputs] = useState<Partial<Record<string, string>>>({});
  const [savingContractId, setSavingContractId] = useState<string | null>(null);
  const [pkgStartDateInputs, setPkgStartDateInputs] = useState<Record<string, string>>({});
  const [savingStartDateId, setSavingStartDateId] = useState<string | null>(null);
  const [pkgSessionsInputs, setPkgSessionsInputs] = useState<Record<string, string>>({});
  const [savingSessionsId, setSavingSessionsId] = useState<string | null>(null);
  const [pkgReservedInputs, setPkgReservedInputs] = useState<Record<string, string>>({});
  const [pkgExtensionInputs, setPkgExtensionInputs] = useState<Record<string, string>>({});
  const [savingReservedExtId, setSavingReservedExtId] = useState<string | null>(null);
  const [addPkgContractCode, setAddPkgContractCode] = useState("");
  const [addPkgContractType, setAddPkgContractType] = useState<"NORMAL" | "KOC" | "KOL">("NORMAL");
  const [addPkgStartWeight, setAddPkgStartWeight] = useState("");
  const [addPkgFMConfirmed, setAddPkgFMConfirmed] = useState(false);
  const [addKolSponsoredPkg, setAddKolSponsoredPkg] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Weight logs local state — allows optimistic updates after add/edit/delete
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>(client.weightLogs);

  // Edit weight log modal
  const [editingWeightLog, setEditingWeightLog] = useState<WeightLog | null>(null);
  const [editWeightDate, setEditWeightDate] = useState("");
  const [editWeightValue, setEditWeightValue] = useState("");
  const [editWeightNote, setEditWeightNote] = useState("");
  const [editWeightLoading, setEditWeightLoading] = useState(false);
  const [editWeightError, setEditWeightError] = useState("");

  // Delete weight log confirm
  const [deletingWeightLogId, setDeletingWeightLogId] = useState<string | null>(null);
  const [deleteWeightLoading, setDeleteWeightLoading] = useState(false);

  // Local workout programs state so new programs appear without page reload
  const [workoutProgs, setWorkoutProgs] = useState<WorkoutProgram[]>(initialWorkoutPrograms);

  // Create workout program modal
  const [createProgOpen, setCreateProgOpen] = useState(false);
  const [createProgPhases, setCreateProgPhases] = useState<{ id: string; name: string }[]>([]);
  const [createProgForm, setCreateProgForm] = useState({
    phaseId: "", sessionsPerWeek: 4, currentWeek: 1, workoutType: "", notes: "",
  });
  const [createProgSaving, setCreateProgSaving] = useState(false);
  const [createProgError, setCreateProgError] = useState("");

  function openCreateProg() {
    if (createProgPhases.length === 0) {
      fetch("/api/admin/phases")
        .then((r) => r.json())
        .then((data: { id: string; name: string; isActive: boolean }[]) =>
          setCreateProgPhases(data.filter((p) => p.isActive))
        )
        .catch(() => {});
    }
    setCreateProgForm({ phaseId: "", sessionsPerWeek: 4, currentWeek: 1, workoutType: "", notes: "" });
    setCreateProgError("");
    setCreateProgOpen(true);
  }

  async function handleCreateProg() {
    const selectedPhase = createProgPhases.find((p) => p.id === createProgForm.phaseId);
    if (!selectedPhase) { setCreateProgError("Vui lòng chọn giai đoạn"); return; }
    setCreateProgSaving(true);
    setCreateProgError("");
    try {
      const res = await fetch(`/api/clients/${client.id}/programs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: selectedPhase.name,
          phaseId: createProgForm.phaseId,
          sessionsPerWeek: createProgForm.sessionsPerWeek,
          currentWeek: createProgForm.currentWeek,
          workoutType: createProgForm.workoutType || undefined,
          notes: createProgForm.notes || undefined,
          sessions: [],
        }),
      });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Có lỗi xảy ra");
      const created = await res.json() as WorkoutProgram;
      setWorkoutProgs((prev) => [created, ...prev]);
      setCreateProgOpen(false);
    } catch (err) {
      setCreateProgError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setCreateProgSaving(false);
    }
  }

  const canEditSessions = userRole === "ADMIN" || userRole === "FM";

  // Substitute modal state
  const [subOpen, setSubOpen] = useState(false);
  const [subSubstituteId, setSubSubstituteId] = useState("");
  const [subType, setSubType] = useState<"SHORT_TERM" | "LONG_TERM">("SHORT_TERM");
  const [subDays, setSubDays] = useState("7");
  const [subNotes, setSubNotes] = useState("");
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState("");
  const [subSuccess, setSubSuccess] = useState(false);

  async function handleSubstituteSubmit() {
    setSubError("");
    if (!subSubstituteId) { setSubError("Vui lòng chọn PT hỗ trợ"); return; }
    if (subType === "SHORT_TERM" && (!subDays || parseInt(subDays) < 1)) {
      setSubError("Vui lòng nhập số ngày hỗ trợ"); return;
    }
    setSubLoading(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/substitute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          substituteId: subSubstituteId,
          type: subType,
          durationDays: subType === "SHORT_TERM" ? parseInt(subDays) : undefined,
          notes: subNotes || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Có lỗi xảy ra");
      }
      setSubSuccess(true);
      router.refresh();
    } catch (err) {
      setSubError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSubLoading(false);
    }
  }

  // PTs available for substitute selection
  const substitutablePTs = staffList.filter((pt) => {
    // Exclude management-only roles that don't teach
    if (!pt.role || pt.role === "COO" || pt.role === "CEO_FITPARTNER") return false;
    // Exclude self
    if (pt.id === currentUserId) return false;
    // Always restrict to client's branch — substitutes must be at the same branch
    if (pt.branchId !== client.branch?.id) return false;
    return true;
  });

  // Food scan logs (loaded client-side for detail view)
  const [foodLogs, setFoodLogs] = useState<FoodScanLogItem[]>([]);
  const [foodLogsLoaded, setFoodLogsLoaded] = useState(false);
  const [foodLogsLoading, setFoodLogsLoading] = useState(false);
  const [expandedFoodDays, setExpandedFoodDays] = useState<Set<string>>(new Set());
  const [showAllFoodDays, setShowAllFoodDays] = useState(false);

  useEffect(() => {
    if (view === "detail" && !foodLogsLoaded && !foodLogsLoading) {
      setFoodLogsLoading(true);
      fetch(`/api/clients/${client.id}/food-logs`)
        .then((r) => r.json())
        .then((data: FoodScanLogItem[]) => {
          setFoodLogs(Array.isArray(data) ? data : []);
          setFoodLogsLoaded(true);
          setFoodLogsLoading(false);
        })
        .catch(() => {
          setFoodLogsLoaded(true);
          setFoodLogsLoading(false);
        });
    }
  }, [view, foodLogsLoaded, foodLogsLoading, client.id]);

  // Sort logs (uses local state so updates immediately on edit/delete)
  const sortedLogsAsc = [...weightLogs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const sortedLogsDesc = [...sortedLogsAsc].reverse();

  // Chart data
  const chartData: ChartPoint[] = sortedLogsAsc.map((log) => ({
    date: new Date(log.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
    weight: log.weight,
  }));
  const last14 = chartData.slice(-14);

  // Active meal plan for overview card
  const activeMealPlan = (initialMealPlans ?? []).find((p) => p.status === "ACTIVE") ?? null;

  // Food logs grouped by date (YYYY-MM-DD), sorted desc
  const foodLogsByDate = useMemo(() => {
    const map = new Map<string, FoodScanLogItem[]>();
    for (const log of foodLogs) {
      const dateKey = log.scanDate.split("T")[0];
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(log);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [foodLogs]);

  // Activity log derived values
  function localDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const actNow = new Date();
  const actTodayStr = localDateStr(actNow);
  const actToday = initialActivityLogs.find((l) => l.date.startsWith(actTodayStr)) ?? null;

  const actDow = actNow.getDay();
  const actMonday = new Date(actNow);
  actMonday.setDate(actNow.getDate() - (actDow === 0 ? 6 : actDow - 1));
  actMonday.setHours(0, 0, 0, 0);

  const actWeekLogs = initialActivityLogs.filter((l) => new Date(l.date) >= actMonday);
  const actWeekSteps = actWeekLogs.reduce((s, l) => s + (l.steps ?? 0), 0);
  const actWeekAvgMin = actWeekLogs.length > 0
    ? Math.round(actWeekLogs.reduce((s, l) => s + (l.minutesActive ?? 0), 0) / actWeekLogs.length)
    : 0;

  const actThisMonth = actNow.getMonth();
  const actThisYear = actNow.getFullYear();
  const actMonthLogs = initialActivityLogs.filter((l) => {
    const d = new Date(l.date);
    return d.getMonth() === actThisMonth && d.getFullYear() === actThisYear;
  });
  const actMonthAvgSteps = actMonthLogs.length > 0
    ? Math.round(actMonthLogs.reduce((s, l) => s + (l.steps ?? 0), 0) / actMonthLogs.length)
    : 0;

  const ACT_DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const actWeekChartData: ActivityChartPoint[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(actMonday);
    d.setDate(actMonday.getDate() + i);
    const ds = localDateStr(d);
    const log = initialActivityLogs.find((l) => l.date.startsWith(ds));
    return { day: ACT_DAY_LABELS[i], steps: log?.steps ?? 0, minutes: log?.minutesActive ?? 0 };
  });

  // Progress
  const lostKg = Math.max(0, client.initialWeight - client.currentWeight);
  const remainingKg = Math.max(0, client.currentWeight - client.targetWeight);
  const totalToLose = client.initialWeight - client.targetWeight;
  const progressPct = totalToLose > 0
    ? Math.min(100, Math.max(0, Math.round((lostKg / totalToLose) * 100)))
    : 0;
  const isTransformed = client.initialWeight - client.currentWeight >= 7;

  // BMI / WHR
  const bmi = client.height > 0
    ? client.currentWeight / Math.pow(client.height / 100, 2)
    : null;
  const whr = client.initialWaist && client.initialHip
    ? client.initialWaist / client.initialHip
    : null;

  // Weekly stats
  const now = new Date();
  const monday = getMonday(now);
  const lastMonday = new Date(monday);
  lastMonday.setDate(monday.getDate() - 7);

  const thisWeekLogs = sortedLogsAsc.filter((l) => new Date(l.date) >= monday);
  const lastWeekLogs = sortedLogsAsc.filter((l) => {
    const d = new Date(l.date);
    return d >= lastMonday && d < monday;
  });
  const avg = (arr: WeightLog[]) =>
    arr.length ? arr.reduce((s, l) => s + l.weight, 0) / arr.length : null;
  const thisWeekAvg = avg(thisWeekLogs);
  const lastWeekAvg = avg(lastWeekLogs);
  const weekChange =
    thisWeekAvg !== null && lastWeekAvg !== null ? thisWeekAvg - lastWeekAvg : null;

  const lossRate = (() => {
    if (sortedLogsAsc.length < 2) return null;
    const first = sortedLogsAsc[0];
    const last = sortedLogsAsc[sortedLogsAsc.length - 1];
    const weeks =
      (new Date(last.date).getTime() - new Date(first.date).getTime()) /
      (7 * 24 * 60 * 60 * 1000);
    if (weeks < 0.5) return null;
    return (first.weight - last.weight) / weeks;
  })();

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }

  async function handlePkgStartDate(pkgId: string) {
    if (!pkgStartDate || pkgStartDate.length < 10) return;
    const iso = dmyToISO(pkgStartDate);
    if (!iso) return;
    setPkgUpdateLoading(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/packages/${pkgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: iso }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPackages((prev) =>
          prev.map((p) =>
            p.id === pkgId
              ? { ...p, startDate: updated.startDate, endDate: updated.endDate }
              : p
          )
        );
        setEditingPkgId(null);
        setPkgStartDate("");
      }
    } finally {
      setPkgUpdateLoading(false);
    }
  }

  async function handleSaveContractCode(pkgId: string) {
    setSavingContractId(pkgId);
    try {
      const contractCode = pkgContractInputs[pkgId] ?? packages.find((p) => p.id === pkgId)?.contractCode ?? "";
      const res = await fetch(`/api/clients/${client.id}/packages/${pkgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractCode }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setPackages((prev) => prev.map((p) => p.id === pkgId ? { ...p, contractCode: updated.contractCode ?? null } : p));
      setPkgContractInputs((prev) => { const next = { ...prev }; delete next[pkgId]; return next; });
      setToastMsg("Đã lưu mã hợp đồng thành công ✓");
      setTimeout(() => setToastMsg(null), 3000);
    } catch {
      // silent
    } finally {
      setSavingContractId(null);
    }
  }

  async function handleSaveStartDate(pkgId: string) {
    const raw = pkgStartDateInputs[pkgId] ?? isoToDmy(packages.find((p) => p.id === pkgId)?.startDate ?? null);
    if (!raw || raw.length < 10) return;
    const iso = dmyToISO(raw);
    if (!iso) return;
    setSavingStartDateId(pkgId);
    try {
      const res = await fetch(`/api/clients/${client.id}/packages/${pkgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: iso }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setPackages((prev) =>
        prev.map((p) =>
          p.id === pkgId ? { ...p, startDate: updated.startDate, endDate: updated.endDate } : p
        )
      );
      setPkgStartDateInputs((prev) => { const next = { ...prev }; delete next[pkgId]; return next; });
      setToastMsg("Đã lưu ngày bắt đầu ✓");
      setTimeout(() => setToastMsg(null), 3000);
    } catch {
      // silent
    } finally {
      setSavingStartDateId(null);
    }
  }

  async function handleSaveSessionsUsed(pkgId: string) {
    const pkg = packages.find((p) => p.id === pkgId);
    if (!pkg) return;
    const val = pkgSessionsInputs[pkgId];
    if (val === undefined) return;
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0) return;
    setSavingSessionsId(pkgId);
    try {
      const newStatus = num >= pkg.sessions ? "COMPLETED" : pkg.status === "COMPLETED" ? "ACTIVE" : pkg.status;
      const res = await fetch(`/api/clients/${client.id}/packages/${pkgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionsUsed: num, status: newStatus }),
      });
      if (!res.ok) throw new Error();
      setPackages((prev) =>
        prev.map((p) => p.id === pkgId ? { ...p, sessionsUsed: num, status: newStatus as PackageEnrollment["status"] } : p)
      );
      setPkgSessionsInputs((prev) => { const next = { ...prev }; delete next[pkgId]; return next; });
      setToastMsg("Đã lưu số buổi tập ✓");
      setTimeout(() => setToastMsg(null), 3000);
    } catch {
      // silent
    } finally {
      setSavingSessionsId(null);
    }
  }

  async function handleSaveReservedExt(pkgId: string) {
    const pkg = packages.find((p) => p.id === pkgId);
    if (!pkg) return;
    const reserved = parseInt(pkgReservedInputs[pkgId] ?? String(pkg.reservedDays), 10);
    const extension = parseInt(pkgExtensionInputs[pkgId] ?? String(pkg.extensionDays), 10);
    if (isNaN(reserved) || isNaN(extension) || reserved < 0 || extension < 0) return;
    setSavingReservedExtId(pkgId);
    try {
      const res = await fetch(`/api/clients/${client.id}/packages/${pkgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservedDays: reserved, extensionDays: extension }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setPackages((prev) =>
        prev.map((p) =>
          p.id === pkgId
            ? { ...p, reservedDays: updated.reservedDays, extensionDays: updated.extensionDays, endDate: updated.endDate }
            : p
        )
      );
      setPkgReservedInputs((prev) => { const next = { ...prev }; delete next[pkgId]; return next; });
      setPkgExtensionInputs((prev) => { const next = { ...prev }; delete next[pkgId]; return next; });
      setToastMsg("Đã lưu bảo lưu/gia hạn ✓");
      setTimeout(() => setToastMsg(null), 3000);
    } catch {
      // silent
    } finally {
      setSavingReservedExtId(null);
    }
  }

  async function handleAddPackage() {
    if (!addPkgName) return;
    const isKOCPkg = addPkgName === "KOC";
    const isKOLPkg = addPkgName === "KOL";
    // For KOL, the dropdown value is "KOL" but the actual package is addKolSponsoredPkg
    const pkgKey = isKOLPkg ? addKolSponsoredPkg : addPkgName;
    const def = PACKAGES[pkgKey];
    if (!def) return;
    const resolvedContractType = isKOCPkg ? "KOC" : isKOLPkg ? "KOL" : addPkgContractType;
    setAddPkgLoading(true);
    setAddPkgError("");
    try {
      const res = await fetch(`/api/clients/${client.id}/packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageName: def.name,
          packageStage: def.stageLabel,
          sessions: def.sessions,
          durationDays: def.durationDays,
          price: (isKOCPkg || isKOLPkg) ? 0 : (def.discountedPrice ?? def.price),
          contractCode: addPkgContractCode || undefined,
          contractType: resolvedContractType,
          startWeight: resolvedContractType === "KOC" ? parseFloat(addPkgStartWeight) || undefined : undefined,
          startWeightConfirmed: resolvedContractType === "KOC" ? addPkgFMConfirmed : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Có lỗi xảy ra");
      const created = await res.json();
      setPackages((prev) => [...prev, {
        id: created.id,
        packageName: created.packageName,
        packageStage: created.packageStage,
        sessions: created.sessions,
        sessionsUsed: created.sessionsUsed,
        startDate: created.startDate ?? null,
        endDate: created.endDate ?? null,
        durationDays: created.durationDays,
        price: created.price,
        contractType: (created.contractType ?? resolvedContractType) as "NORMAL" | "KOC" | "KOL",
        status: created.status,
        notes: created.notes ?? null,
        contractCode: created.contractCode ?? null,
        reservedDays: created.reservedDays ?? 0,
        extensionDays: created.extensionDays ?? 0,
        createdAt: created.createdAt,
      }]);
      setAddPkgName("");
      setAddPkgContractCode("");
      setAddPkgContractType("NORMAL");
      setAddPkgStartWeight("");
      setAddPkgFMConfirmed(false);
      setAddKolSponsoredPkg("");
    } catch (err) {
      setAddPkgError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setAddPkgLoading(false);
    }
  }

  async function handleDeletePackage() {
    if (!deletingPkgId) return;
    setDeletePkgLoading(true);
    setDeletePkgError("");
    try {
      const res = await fetch(`/api/clients/${client.id}/packages/${deletingPkgId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Có lỗi xảy ra");
      setPackages((prev) => prev.filter((p) => p.id !== deletingPkgId));
      setDeletingPkgId(null);
    } catch (err) {
      setDeletePkgError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setDeletePkgLoading(false);
    }
  }

  async function handleAccountSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAccountLoading(true);
    setAccountError("");
    setAccountSuccess(false);
    try {
      const res = await fetch(`/api/clients/${client.id}/account`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: accountEmail, password: generatedPassword || undefined }),
      });
      if (!res.ok) {
        // Server may return a non-JSON error page; fall back to a friendly message.
        let msg = "Không thể lưu tài khoản. Vui lòng thử lại.";
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch { /* response body was not JSON */ }
        throw new Error(msg);
      }
      setSavedPassword(generatedPassword);
      setGeneratedPassword("");
      setAccountSuccess(true);
      router.refresh();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setAccountLoading(false);
    }
  }

  const inputCls = "h-11 rounded-xl";
  const selectCls =
    "w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/40";

  async function handleWeightSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setWeightError("");
    const fd = new FormData(e.currentTarget);
    const dateStr = fd.get("date") as string;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      setWeightError("Vui lòng nhập ngày hợp lệ (dd/mm/yyyy) trước khi lưu");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/clients/${client.id}/weight-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          weight: fd.get("weight"),
          note: fd.get("note") || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Có lỗi xảy ra");
      const newLog = data as WeightLog;
      setWeightLogs((prev) =>
        [...prev, { id: newLog.id, date: newLog.date, weight: newLog.weight, note: newLog.note }]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
      setWeightOpen(false);
      router.refresh();
    } catch (err) {
      setWeightError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  function openEditWeightLog(log: WeightLog) {
    setEditingWeightLog(log);
    setEditWeightDate(log.date.split("T")[0]);
    setEditWeightValue(String(log.weight));
    setEditWeightNote(log.note ?? "");
    setEditWeightError("");
  }

  async function handleEditWeightLog() {
    if (!editingWeightLog) return;
    const w = parseFloat(editWeightValue);
    if (isNaN(w) || w <= 0) { setEditWeightError("Cân nặng không hợp lệ"); return; }
    setEditWeightLoading(true);
    setEditWeightError("");
    try {
      const res = await fetch(`/api/clients/${client.id}/weight-logs/${editingWeightLog.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editWeightDate, weight: w, note: editWeightNote || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Có lỗi xảy ra");
      const updated = data as WeightLog;
      setWeightLogs((prev) =>
        prev
          .map((l) => l.id === updated.id ? { ...l, date: updated.date, weight: updated.weight, note: updated.note } : l)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
      setEditingWeightLog(null);
      setToastMsg("Đã cập nhật cân nặng ✓");
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      setEditWeightError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setEditWeightLoading(false);
    }
  }

  async function handleDeleteWeightLog() {
    if (!deletingWeightLogId) return;
    setDeleteWeightLoading(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/weight-logs/${deletingWeightLogId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error((d as { error?: string }).error ?? "Có lỗi xảy ra");
      }
      setWeightLogs((prev) => prev.filter((l) => l.id !== deletingWeightLogId));
      setDeletingWeightLogId(null);
      setToastMsg("Đã xóa bản ghi ✓");
      setTimeout(() => setToastMsg(null), 3000);
    } catch {
      // silent — keep dialog open so user sees it failed
    } finally {
      setDeleteWeightLoading(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload thất bại");
      setPendingAvatarUrl(data.url);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Upload ảnh thất bại");
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setEditError("");
    const body: Record<string, unknown> = Object.fromEntries(new FormData(e.currentTarget).entries());
    // dateOfBirth comes as "YYYY-MM-DD" from type="date" — no conversion needed
    if (body.targetDate) body.targetDate = dmyToISO(body.targetDate as string) || "";
    body.avatarUrl = pendingAvatarUrl ?? null;
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Có lỗi xảy ra");
      setEditOpen(false);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row items-start justify-between mb-6 gap-4">
        <div className="flex flex-col gap-2 min-w-0">
          <Link
            href="/dashboard/clients"
            className="inline-flex items-center gap-1 text-sm font-semibold text-gray-400 hover:text-[#f15b5c] transition-colors w-fit"
          >
            <ChevronLeft className="w-4 h-4" />
            Khách hàng
          </Link>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-[#f15b5c]/10 flex items-center justify-center">
              {client.avatarUrl ? (
                <img src={client.avatarUrl} alt={client.fullName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-extrabold text-[#f15b5c]">
                  {client.fullName[0].toUpperCase()}
                </span>
              )}
            </div>
            <h1 className="text-xl font-extrabold text-gray-900">{client.fullName}</h1>
            <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap", STATUS_STYLE[client.status])}>
              {STATUS_LABEL[client.status]}
            </span>
            {isTransformed && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-[#f15b5c]/10 text-[#f15b5c]">
                <Star className="w-3 h-3 fill-[#f15b5c]" />
                Đã Transform
              </span>
            )}
            {client.clientCode && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
                Mã KH: {client.clientCode}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-shrink-0 sm:pt-7 w-full sm:w-auto">
          {/* Mobile: dropdown */}
          <div className="relative block sm:hidden w-full">
            <select
              value={view}
              onChange={(e) => setView(e.target.value as "overview" | "detail" | "workout" | "nutrition")}
              className="w-full h-10 rounded-xl border border-gray-200 bg-white pl-3 pr-9 text-sm font-semibold text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
            >
              <option value="overview">Tổng quan</option>
              <option value="detail">Chi tiết</option>
              <option value="workout">CT Tập</option>
              <option value="nutrition">Chế độ ăn</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          {/* Desktop: tab bar */}
          <div className="hidden sm:block overflow-x-auto -mx-1 px-1 flex-none">
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1 min-w-max">
              {(["overview", "detail", "workout", "nutrition"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
                    view === v
                      ? "bg-[#f15b5c] text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {v === "overview" ? "Tổng quan" : v === "detail" ? "Chi tiết" : v === "workout" ? "CT Tập" : "Chế độ ăn"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setSubOpen(true);
                setSubSubstituteId("");
                setSubType("SHORT_TERM");
                setSubDays("7");
                setSubNotes("");
                setSubError("");
                setSubSuccess(false);
              }}
              variant="outline"
              className="gap-1.5 rounded-xl text-sm font-semibold h-9 border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nhờ dạy hộ</span>
            </Button>
            <Button
              onClick={() => {
                setEditError("");
                setEditGeneration((g) => g + 1);
                setPendingAvatarUrl(client.avatarUrl ?? null);
                setEditOpen(true);
              }}
              variant="outline"
              className="gap-1.5 rounded-xl text-sm font-semibold h-9 border-[#f15b5c] text-[#f15b5c] hover:bg-[#f15b5c]/5"
            >
              <Pencil className="w-3.5 h-3.5" />
              Chỉnh sửa
            </Button>
          </div>
        </div>
      </div>

      {/* ── VIEW 1: OVERVIEW ── */}
      {view === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1 */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-blue-50">
                <Scale className="w-4 h-4 text-blue-500" />
              </div>
              <h3 className="text-sm font-bold text-gray-700">Chiều cao & Cân nặng</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: "Chiều cao", value: `${client.height} cm`, cls: "text-gray-800" },
                { label: "Cân nặng ban đầu", value: `${client.initialWeight} kg`, cls: "text-gray-800" },
                { label: "Cân nặng hiện tại", value: `${client.currentWeight} kg`, cls: "text-[#f15b5c]" },
                { label: "Cân nặng mục tiêu", value: `${client.targetWeight} kg`, cls: "text-emerald-600" },
              ].map((r) => (
                <div key={r.label} className="flex justify-between items-center">
                  <span className="text-sm text-gray-400 font-medium">{r.label}</span>
                  <span className={cn("text-sm font-bold", r.cls)}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2 — Progress */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-[#f15b5c]/10">
                <TrendingDown className="w-4 h-4 text-[#f15b5c]" />
              </div>
              <h3 className="text-sm font-bold text-gray-700">Tiến độ giảm cân</h3>
            </div>
            <div className="mb-3">
              <div className="flex justify-between mb-1.5">
                <span className={cn("text-xs font-semibold", lostKg > 0 ? "text-emerald-600" : "text-gray-400")}>
                  Đã giảm: {lostKg.toFixed(1)} kg
                </span>
                <span className="text-xs font-bold text-[#f15b5c]">{progressPct}%</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#f15b5c] rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-300">{client.initialWeight} kg</span>
                <span className="text-xs text-gray-400 font-semibold">
                  Còn lại: {remainingKg.toFixed(1)} kg
                </span>
              </div>
            </div>
            {sortedLogsAsc.length === 0 ? (
              <div className="h-[120px] flex items-center justify-center border-2 border-dashed border-gray-100 rounded-xl">
                <p className="text-xs text-gray-300 font-semibold">Chưa có dữ liệu cân nặng</p>
              </div>
            ) : (
              <MiniWeightChart data={last14} height={120} />
            )}
          </div>

          {/* Card 3 — Workout */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-50">
                  <Dumbbell className="w-4 h-4 text-orange-500" />
                </div>
                <h3 className="text-sm font-bold text-gray-700">Chương trình tập</h3>
              </div>
              <button
                onClick={() => setView("workout")}
                className="text-xs font-semibold text-[#f15b5c] hover:underline"
              >
                Xem tất cả →
              </button>
            </div>
            {workoutProgs.filter((p) => p.status === "ACTIVE").length === 0 ? (
              <div className="h-28 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl gap-2">
                <Dumbbell className="w-6 h-6 text-gray-200" />
                <p className="text-xs text-gray-300 font-semibold">Chưa có chương trình tập</p>
                <button
                  onClick={openCreateProg}
                  className="text-xs font-semibold text-[#f15b5c] border border-[#f15b5c]/30 rounded-lg px-3 py-1 hover:bg-[#f15b5c]/5 transition-colors"
                >
                  Tạo chương trình tập
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {workoutProgs.filter((p) => p.status === "ACTIVE").slice(0, 2).map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                    <div>
                      <p className="text-xs font-bold text-gray-800">{p.phase} · {p.workoutType}</p>
                      <p className="text-xs text-gray-400">{p.sessionsPerWeek} buổi/tuần</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Đang tập</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 4 — Diet */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-green-50">
                <Salad className="w-4 h-4 text-green-500" />
              </div>
              <h3 className="text-sm font-bold text-gray-700">Chế độ ăn</h3>
            </div>
            {activeMealPlan ? (
              <div className="space-y-3">
                {/* DER */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">DER mục tiêu</span>
                  <span className="text-sm font-extrabold text-[#f15b5c]">{Math.round(activeMealPlan.der)} kcal</span>
                </div>
                {/* Macros */}
                <div className="flex flex-wrap gap-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                    P {Math.round(activeMealPlan.protein)}g
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-50 text-yellow-700">
                    F {Math.round(activeMealPlan.fat)}g
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700">
                    C {Math.round(activeMealPlan.carbs)}g
                  </span>
                </div>
                {/* Meal names */}
                {activeMealPlan.days[0]?.meals?.length > 0 && (
                  <ul className="space-y-1">
                    {activeMealPlan.days[0].meals.map((meal, i) => (
                      <li key={i} className="text-xs text-gray-600 truncate">
                        · {meal.mealName}
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  onClick={() => setView("nutrition")}
                  className="text-xs font-semibold text-[#f15b5c] hover:underline"
                >
                  Xem chi tiết →
                </button>
              </div>
            ) : (
              <div className="h-28 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl gap-2">
                <Salad className="w-6 h-6 text-gray-200" />
                <p className="text-xs text-gray-300 font-semibold">Chưa có chế độ ăn</p>
                <button
                  onClick={() => setView("nutrition")}
                  className="text-xs font-semibold text-[#f15b5c] border border-[#f15b5c]/30 rounded-lg px-3 py-1 hover:bg-[#f15b5c]/5 transition-colors"
                >
                  Tạo chế độ ăn
                </button>
              </div>
            )}
          </div>

          {/* Activity today card */}
          <div className="md:col-span-2 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50">
                  <Footprints className="w-4 h-4 text-blue-500" />
                </div>
                <h3 className="text-sm font-bold text-gray-700">Vận động hôm nay</h3>
              </div>
              <button onClick={() => setView("detail")} className="text-xs font-semibold text-[#f15b5c] hover:underline">
                Xem lịch sử →
              </button>
            </div>
            {actToday ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Footprints className="w-3.5 h-3.5 text-blue-400" />
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Bước chân</p>
                  </div>
                  <p className="text-xl font-extrabold text-blue-600">{(actToday.steps ?? 0).toLocaleString()}</p>
                  <div className="mt-2 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full"
                      style={{ width: `${Math.min(100, ((actToday.steps ?? 0) / 8000) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-blue-300 mt-1">{Math.min(100, Math.round(((actToday.steps ?? 0) / 8000) * 100))}% mục tiêu 8k</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Timer className="w-3.5 h-3.5 text-green-400" />
                    <p className="text-[10px] font-bold text-green-400 uppercase tracking-wide">Phút vận động</p>
                  </div>
                  <p className="text-xl font-extrabold text-green-600">{actToday.minutesActive ?? 0}</p>
                  {actToday.note && <p className="text-xs text-gray-400 mt-2 truncate">{actToday.note}</p>}
                </div>
              </div>
            ) : (
              <div className="h-16 flex items-center justify-center border-2 border-dashed border-gray-100 rounded-xl">
                <p className="text-xs text-gray-300 font-semibold">Khách hàng chưa cập nhật hôm nay</p>
              </div>
            )}
          </div>

          {/* Package cards */}
          {packages.length > 0 && (
            <div className="md:col-span-2 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-purple-50">
                  <Package className="w-4 h-4 text-purple-500" />
                </div>
                <h3 className="text-sm font-bold text-gray-700">Lộ trình đăng ký</h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {packages.map((pkg) => {
                  const pct = Math.round((pkg.sessionsUsed / pkg.sessions) * 100);
                  const isKOC = pkg.contractType === "KOC" || pkg.packageName === "KOC";
                  const isKOL = pkg.contractType === "KOL";

                  // Days remaining for KOC
                  const daysLeft = pkg.endDate
                    ? Math.max(0, Math.ceil((new Date(pkg.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                    : null;

                  if (isKOC) {
                    return (
                      <div key={pkg.id} className="flex-1 min-w-[220px] border border-amber-200 rounded-xl p-4 bg-amber-50/40">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-extrabold text-amber-800">KOC</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-700">Lộ trình tặng</span>
                          </div>
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", PKG_STATUS_STYLE[getEffectiveStatus(pkg)])}>
                            {PKG_STATUS_LABEL[getEffectiveStatus(pkg)]}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-600 mb-2">60 buổi / 60 ngày · Miễn phí</p>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-1.5 bg-amber-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">
                            {pkg.sessionsUsed}/{pkg.sessions} buổi
                          </span>
                        </div>
                        <div className="text-[11px] text-amber-700 space-y-0.5 mt-1">
                          {pkg.startDate ? (
                            <>
                              <div>Ngày BĐ: <span className="font-semibold">{formatDate(pkg.startDate)}</span></div>
                              {pkg.endDate && (
                                <div>Ngày KT: <span className="font-semibold">{formatDate(pkg.endDate)}</span>
                                  {daysLeft != null && daysLeft > 0 && (
                                    <span className="ml-1 text-[10px] text-amber-500">({daysLeft} ngày nữa)</span>
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="italic text-amber-500">Chưa bắt đầu</span>
                          )}
                          {pkg.status === "ACTIVE" && (
                            <div className="mt-1 text-[10px] font-semibold text-amber-600 italic">
                              {pkg.sessionsUsed < pkg.sessions ? "Chờ xác nhận kết quả" : "Đã hoàn thành buổi dạy"}
                            </div>
                          )}
                        </div>
                        {pkg.contractCode && (
                          <p className="text-[10px] text-amber-500 mt-1">HĐ: {pkg.contractCode}</p>
                        )}
                      </div>
                    );
                  }

                  const barColor =
                    pct >= 100 ? "bg-green-500" :
                    pct > 80   ? "bg-orange-400" :
                    pct >= 50  ? "bg-blue-400" :
                                 "bg-gray-400";
                  const countColor =
                    pct >= 100 ? "text-green-600" :
                    pct > 80   ? "text-orange-500" :
                    pct >= 50  ? "text-blue-600" :
                                 "text-gray-600";
                  return (
                    <div key={pkg.id} className={cn(
                      "flex-1 min-w-[220px] border rounded-xl p-4 bg-gray-50/50",
                      isKOL ? "border-blue-200 bg-blue-50/20" : "border-gray-100"
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-extrabold text-gray-900">{pkg.packageName}</span>
                          {isKOL && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">KOL</span>
                          )}
                        </div>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", PKG_STATUS_STYLE[getEffectiveStatus(pkg)])}>
                          {PKG_STATUS_LABEL[getEffectiveStatus(pkg)]}
                        </span>
                      </div>
                      {isKOL
                        ? <p className="text-[11px] text-blue-600 mb-2">Được tài trợ · 60,000đ/buổi</p>
                        : <p className="text-xs text-gray-400 mb-2">{pkg.packageStage}</p>
                      }
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
                        </div>
                        {pct >= 100
                          ? <span className={cn("text-xs font-bold whitespace-nowrap", countColor)}>Hoàn thành ✓</span>
                          : <span className={cn("text-xs font-semibold whitespace-nowrap", countColor)}>{pkg.sessionsUsed}/{pkg.sessions} buổi</span>
                        }
                      </div>
                      <div className="text-xs text-gray-400 space-y-0.5 mt-1">
                        {pkg.startDate ? (
                          <>
                            <div>Ngày BĐ: <span className="text-gray-600">{formatDate(pkg.startDate)}</span></div>
                            {pkg.endDate && (
                              <div>
                                Ngày KT: <span className="text-gray-600">{formatDate(pkg.endDate)}</span>
                                {(pkg.reservedDays > 0 || pkg.extensionDays > 0) && (
                                  <span className="ml-1 text-[10px] text-purple-500">
                                    (bao gồm {[
                                      pkg.reservedDays > 0 && `${pkg.reservedDays}ng BL`,
                                      pkg.extensionDays > 0 && `${pkg.extensionDays}ng GH`,
                                    ].filter(Boolean).join(" + ")})
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="italic">Chưa bắt đầu</span>
                        )}
                      </div>
                      {pkg.contractCode && (
                        <p className="text-xs text-gray-400 mt-1">HĐ: {pkg.contractCode}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 2: DETAIL ── */}
      {view === "detail" && (
        <div className="space-y-4">
          {/* Row 1: Personal + Body metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Personal */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-xl bg-blue-50">
                  <User className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">
                  Thông tin cá nhân
                </h3>
              </div>
              {client.clientCode && <InfoRow label="Mã khách hàng" value={client.clientCode} />}
              <InfoRow label="Họ tên" value={client.fullName} />
              <InfoRow label="SĐT" value={client.phone} />
              <InfoRow label="Ngày sinh" value={formatDate(client.dateOfBirth)} />
              <InfoRow label="Nhân sự phụ trách" value={client.assignedPT.name ?? client.assignedPT.email} />
              <InfoRow label="Cơ sở" value={client.branch.name} />
              <InfoRow label="Ngày bắt đầu" value={formatDate(client.createdAt)} />
            </div>

            {/* Body metrics */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-xl bg-[#f15b5c]/10">
                  <Scale className="w-3.5 h-3.5 text-[#f15b5c]" />
                </div>
                <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">
                  Chỉ số cơ thể
                </h3>
              </div>

              {bmi !== null && (
                <div className="flex justify-between items-start py-2 border-b border-gray-50 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 font-semibold">BMI</p>
                    <Popover
                      trigger={
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors mt-0.5">
                          <Info className="w-3 h-3" /> BMI là gì?
                        </span>
                      }
                    >
                      <div className="space-y-2">
                        <p className="font-bold text-gray-700 text-xs">BMI (Chỉ số Khối cơ thể)</p>
                        <p className="text-xs text-gray-500">
                          Đo tỉ lệ giữa cân nặng và bình phương chiều cao, giúp đánh giá sơ bộ
                          mức độ thừa/thiếu cân.
                        </p>
                        <div className="space-y-0.5 text-xs text-gray-500">
                          <p>• Dưới 18.5 → <span className="text-blue-500 font-semibold">Thiếu cân</span></p>
                          <p>• 18.5 – 24.9 → <span className="text-green-600 font-semibold">Bình thường</span></p>
                          <p>• 25.0 – 29.9 → <span className="text-orange-500 font-semibold">Thừa cân</span></p>
                          <p>• Từ 30 → <span className="text-red-500 font-semibold">Béo phì</span></p>
                        </div>
                        <p className="text-xs text-gray-400 italic">
                          Lưu ý: BMI chỉ mang tính tham khảo, không phân biệt cơ và mỡ.
                        </p>
                      </div>
                    </Popover>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800">{bmi.toFixed(1)}</p>
                    <p className={cn("text-xs font-semibold", getBMIInfo(bmi).color)}>
                      {getBMIInfo(bmi).label}
                    </p>
                  </div>
                </div>
              )}

              {whr !== null ? (
                <div className="flex justify-between items-start py-2 border-b border-gray-50 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 font-semibold">WHR</p>
                    <Popover
                      trigger={
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors mt-0.5">
                          <Info className="w-3 h-3" /> WHR là gì?
                        </span>
                      }
                    >
                      <div className="space-y-2">
                        <p className="font-bold text-gray-700 text-xs">WHR (Tỉ lệ Eo/Hông)</p>
                        <p className="text-xs text-gray-500">
                          Phản ánh lượng mỡ tích tụ ở vùng bụng so với hông.
                        </p>
                        <div className="space-y-0.5 text-xs text-gray-500">
                          <p className="font-semibold text-gray-600">Với phụ nữ:</p>
                          <p>• Dưới 0.80 → <span className="text-green-600 font-semibold">An toàn</span></p>
                          <p>• 0.80 – 0.85 → <span className="text-orange-500 font-semibold">Nguy cơ</span></p>
                          <p>• Trên 0.85 → <span className="text-red-500 font-semibold">Nguy hiểm</span></p>
                        </div>
                        <p className="text-xs text-gray-400 italic">
                          WHR cao liên quan đến nguy cơ bệnh tim mạch và tiểu đường.
                        </p>
                      </div>
                    </Popover>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800">{whr.toFixed(2)}</p>
                    <p className={cn("text-xs font-semibold", getWHRInfo(whr).color)}>
                      {getWHRInfo(whr).label}
                    </p>
                  </div>
                </div>
              ) : (
                <InfoRow label="WHR" value="Chưa có số đo" />
              )}

              <InfoRow
                label="Cần giảm"
                value={`${(client.initialWeight - client.targetWeight).toFixed(1)} kg`}
              />
              <InfoRow label="Ngày mục tiêu" value={formatDate(client.targetDate)} />
            </div>
          </div>

          {/* Row 2: Health */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-xl bg-red-50">
                <Heart className="w-3.5 h-3.5 text-red-400" />
              </div>
              <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">
                Sức khỏe & Mục tiêu
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              {[
                { label: "Tiền sử bệnh lý", value: client.healthConditions },
                { label: "Tiền sử chấn thương", value: client.injuries },
                { label: "Ghi chú mục tiêu", value: client.goalNote },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-gray-400 font-semibold mb-1.5">{item.label}</p>
                  <p className="text-sm text-gray-700 font-medium leading-relaxed">
                    {item.value || "Không có"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Food log section */}
          {(() => {
            const todayKey = new Date().toISOString().split("T")[0];
            const visibleDays = showAllFoodDays ? foodLogsByDate : foodLogsByDate.slice(0, 7);
            function fmtDayHeader(dateKey: string) {
              const [y, m, d] = dateKey.split("-");
              const label = `${d}/${m}/${y}`;
              return dateKey === todayKey ? `Hôm nay - ${label}` : label;
            }
            function fmtTime(iso: string) {
              const d = new Date(iso);
              return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            }
            return (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-xl bg-orange-50">
                    <Salad className="w-3.5 h-3.5 text-orange-500" />
                  </div>
                  <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">
                    Nhật ký ăn uống
                  </h3>
                  {activeMealPlan?.der && (
                    <span className="ml-auto text-xs text-gray-400 font-semibold">
                      Mục tiêu DER: <span className="text-orange-500 font-bold">{activeMealPlan.der} kcal</span>
                    </span>
                  )}
                </div>

                {foodLogsLoading && (
                  <p className="text-xs text-gray-400 py-4 text-center">Đang tải...</p>
                )}

                {foodLogsLoaded && foodLogsByDate.length === 0 && (
                  <p className="text-xs text-gray-400 py-4 text-center italic">Chưa có nhật ký ăn uống</p>
                )}

                {foodLogsLoaded && foodLogsByDate.length > 0 && (
                  <div className="space-y-3">
                    {visibleDays.map(([dateKey, logs]) => {
                      const isToday = dateKey === todayKey;
                      const isExpanded = isToday || expandedFoodDays.has(dateKey);
                      const totalCal = logs.reduce((s, l) => s + l.calories, 0);
                      const totalP = logs.reduce((s, l) => s + l.protein, 0);
                      const totalF = logs.reduce((s, l) => s + l.fat, 0);
                      const totalC = logs.reduce((s, l) => s + l.carbs, 0);
                      return (
                        <div key={dateKey} className="border border-gray-100 rounded-xl overflow-hidden">
                          <button
                            onClick={() => {
                              if (isToday) return;
                              setExpandedFoodDays((prev) => {
                                const next = new Set(prev);
                                if (next.has(dateKey)) { next.delete(dateKey); } else { next.add(dateKey); }
                                return next;
                              });
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-4 py-2.5 text-left",
                              isToday ? "bg-orange-50/60 cursor-default" : "hover:bg-gray-50/80 cursor-pointer"
                            )}
                          >
                            <span className={cn("text-xs font-bold", isToday ? "text-orange-600" : "text-gray-700")}>
                              {fmtDayHeader(dateKey)}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-500 font-semibold">
                                {Math.round(totalCal)} kcal
                              </span>
                              {!isToday && (
                                <span className="text-gray-300 text-xs">
                                  {isExpanded ? "▲" : "▼"}
                                </span>
                              )}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-3 pt-1">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-100">
                                    <th className="py-1.5 text-left font-bold text-gray-400 pr-3">Món ăn</th>
                                    <th className="py-1.5 text-right font-bold text-gray-400 px-2">Kcal</th>
                                    <th className="py-1.5 text-right font-bold text-gray-400 px-2">P</th>
                                    <th className="py-1.5 text-right font-bold text-gray-400 px-2">F</th>
                                    <th className="py-1.5 text-right font-bold text-gray-400 px-2">C</th>
                                    <th className="py-1.5 text-right font-bold text-gray-400 pl-2">Giờ</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {logs.map((log) => (
                                    <tr key={log.id} className="border-b border-gray-50 last:border-0">
                                      <td className="py-2 pr-3">
                                        <p className="font-semibold text-gray-800">{log.foodName}</p>
                                        {log.quantity && (
                                          <p className="text-gray-400">{log.quantity}</p>
                                        )}
                                      </td>
                                      <td className="py-2 text-right px-2 text-gray-700 font-semibold">{Math.round(log.calories)}</td>
                                      <td className="py-2 text-right px-2 text-gray-600">{log.protein.toFixed(1)}g</td>
                                      <td className="py-2 text-right px-2 text-gray-600">{log.fat.toFixed(1)}g</td>
                                      <td className="py-2 text-right px-2 text-gray-600">{log.carbs.toFixed(1)}g</td>
                                      <td className="py-2 text-right pl-2 text-gray-400">{fmtTime(log.scanDate)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-3 text-xs font-bold text-gray-600">
                                <span>Tổng: <span className="text-orange-500">{Math.round(totalCal)} kcal</span></span>
                                <span>P: {totalP.toFixed(1)}g</span>
                                <span>F: {totalF.toFixed(1)}g</span>
                                <span>C: {totalC.toFixed(1)}g</span>
                                {activeMealPlan?.der && (
                                  <span className="ml-auto text-gray-400 font-semibold">
                                    / {activeMealPlan.der} kcal mục tiêu
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {foodLogsByDate.length > 7 && !showAllFoodDays && (
                      <button
                        onClick={() => setShowAllFoodDays(true)}
                        className="w-full text-xs font-semibold text-[#f15b5c] hover:opacity-80 py-2 text-center transition-opacity"
                      >
                        Xem thêm ({foodLogsByDate.length - 7} ngày)
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Row 3: Package Enrollments */}
          {packages.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-xl bg-purple-50">
                  <Package className="w-3.5 h-3.5 text-purple-500" />
                </div>
                <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">
                  Lộ trình đăng ký
                </h3>
              </div>
              <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      {["Tên gói", "Mã HĐ", "Giai đoạn", "Số buổi", "Ngày bắt đầu", "Ngày kết thúc", "Trạng thái"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-bold text-gray-400 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg) => {
                      const pct = Math.round((pkg.sessionsUsed / pkg.sessions) * 100);
                      return (
                        <tr key={pkg.id} className="border-b border-gray-50 last:border-0">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-extrabold text-gray-900">{pkg.packageName}</span>
                              {(pkg.contractType === "KOC" || pkg.packageName === "KOC") && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">KOC</span>
                              )}
                              {pkg.contractType === "KOL" && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">KOL</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {(pkg.contractType === "KOC" || pkg.packageName === "KOC" || pkg.contractType === "KOL") ? "Miễn phí" : formatPrice(pkg.price)}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">
                            {pkg.contractCode ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{pkg.packageStage}</td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-bold text-gray-800 mb-1">
                              {pkg.sessionsUsed}/{pkg.sessions} buổi
                            </p>
                            <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#f15b5c]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {editingPkgId === pkg.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="dd/mm/yyyy"
                                  value={pkgStartDate}
                                  maxLength={10}
                                  onChange={(e) => setPkgStartDate(maskDate(e.target.value))}
                                  className="w-28 h-8 rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                                />
                                <button
                                  onClick={() => handlePkgStartDate(pkg.id)}
                                  disabled={pkgUpdateLoading || !pkgStartDate}
                                  className="h-8 px-3 rounded-lg text-white text-xs font-bold disabled:opacity-50"
                                  style={{ backgroundColor: "#f15b5c" }}
                                >
                                  {pkgUpdateLoading ? "..." : "Lưu"}
                                </button>
                                <button
                                  onClick={() => setEditingPkgId(null)}
                                  className="h-8 px-2 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : pkg.startDate ? (
                              <button
                                onClick={() => { setEditingPkgId(pkg.id); setPkgStartDate(formatDate(pkg.startDate)); }}
                                className="text-xs text-gray-600 hover:text-[#f15b5c] transition-colors"
                              >
                                {formatDate(pkg.startDate)}
                              </button>
                            ) : (
                              <button
                                onClick={() => { setEditingPkgId(pkg.id); setPkgStartDate(""); }}
                                className="text-xs italic text-gray-400 hover:text-[#f15b5c] transition-colors"
                              >
                                Chưa bắt đầu
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {pkg.endDate ? (
                              <>
                                {formatDate(pkg.endDate)}
                                {(pkg.reservedDays > 0 || pkg.extensionDays > 0) && (
                                  <p className="text-[10px] text-purple-500 mt-0.5">
                                    {[
                                      pkg.reservedDays > 0 && `${pkg.reservedDays}ng BL`,
                                      pkg.extensionDays > 0 && `${pkg.extensionDays}ng GH`,
                                    ].filter(Boolean).join(" + ")}
                                  </p>
                                )}
                              </>
                            ) : (
                              <span className="italic text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap", PKG_STATUS_STYLE[getEffectiveStatus(pkg)])}>
                              {PKG_STATUS_LABEL[getEffectiveStatus(pkg)]}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Row 4: Weight tracking */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-[#f15b5c]/10">
                  <BarChart2 className="w-3.5 h-3.5 text-[#f15b5c]" />
                </div>
                <h3 className="text-sm font-extrabold text-gray-700">Nhật ký cân nặng</h3>
              </div>
              <Button
                onClick={() => { setWeightError(""); setWeightOpen(true); }}
                className="gap-1.5 h-8 px-3 rounded-xl text-xs text-white font-semibold shadow-sm"
                style={{ backgroundColor: "#f15b5c" }}
              >
                <Plus className="w-3.5 h-3.5" />
                Cập nhật cân nặng
              </Button>
            </div>

            <div className="mb-5">
              <DetailWeightChart data={chartData} targetWeight={client.targetWeight} />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 font-semibold mb-1">TB tuần này</p>
                <p className="text-lg font-extrabold text-gray-900">
                  {thisWeekAvg !== null ? `${thisWeekAvg.toFixed(1)} kg` : "—"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 font-semibold mb-1">Thay đổi</p>
                {weekChange !== null ? (
                  <div className="flex items-center gap-1">
                    {weekChange < 0
                      ? <TrendingDown className="w-4 h-4 text-emerald-500" />
                      : <TrendingUp className="w-4 h-4 text-red-400" />
                    }
                    <p className={cn(
                      "text-lg font-extrabold",
                      weekChange < 0 ? "text-emerald-500" : weekChange > 0 ? "text-red-400" : "text-gray-500"
                    )}>
                      {weekChange > 0 ? "+" : ""}{weekChange.toFixed(1)} kg
                    </p>
                  </div>
                ) : (
                  <p className="text-lg font-extrabold text-gray-300">—</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 font-semibold mb-1">Tốc độ giảm</p>
                <p className={cn(
                  "text-lg font-extrabold",
                  lossRate !== null && lossRate > 0 ? "text-emerald-500" : "text-gray-300"
                )}>
                  {lossRate !== null ? `${lossRate.toFixed(2)} kg/tuần` : "—"}
                </p>
              </div>
            </div>

            {/* Log table */}
            {sortedLogsDesc.length === 0 ? (
              <div className="h-24 flex items-center justify-center border-2 border-dashed border-gray-100 rounded-xl">
                <p className="text-sm text-gray-300 font-semibold">
                  Chưa có dữ liệu. Hãy cập nhật cân nặng đầu tiên!
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {["Ngày", "Cân nặng", "Thay đổi", "Ghi chú", "Thao tác"].map((h) => (
                        <th key={h} className="pb-2 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLogsDesc.map((log, i) => {
                      const prev = sortedLogsDesc[i + 1];
                      const change = prev ? log.weight - prev.weight : null;
                      return (
                        <tr key={log.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
                          <td className="py-2.5 text-sm text-gray-600 font-medium">{formatDate(log.date)}</td>
                          <td className="py-2.5 text-sm font-bold text-gray-800">{parseFloat(log.weight.toFixed(2))} kg</td>
                          <td className="py-2.5">
                            {change !== null ? (
                              <span className={cn(
                                "text-sm font-bold",
                                change < 0 ? "text-emerald-500" : change > 0 ? "text-red-400" : "text-gray-400"
                              )}>
                                {change < 0 ? "▼" : change > 0 ? "▲" : ""}
                                {change !== 0 ? ` ${Math.abs(change).toFixed(2)} kg` : " 0"}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-300">—</span>
                            )}
                          </td>
                          <td className="py-2.5 text-sm text-gray-400">{log.note ?? "—"}</td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditWeightLog(log)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                                title="Sửa"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingWeightLogId(log.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Xóa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Body Measurements ── */}
          <BodyMeasurementsSection clientId={client.id} canDelete={canEditSessions} />

          {/* ── Activity section ── */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-1.5 rounded-xl bg-blue-50">
                <Footprints className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <h3 className="text-sm font-extrabold text-gray-700">Vận động ngoài phòng tập</h3>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 font-semibold mb-1">Hôm nay</p>
                {actToday ? (
                  <>
                    <p className="text-base font-extrabold text-blue-600">{(actToday.steps ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">bước · {actToday.minutesActive ?? 0} phút</p>
                  </>
                ) : (
                  <p className="text-sm font-bold text-gray-300 italic">Chưa cập nhật</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 font-semibold mb-1">Tuần này</p>
                <p className="text-base font-extrabold text-gray-800">{actWeekSteps.toLocaleString()}</p>
                <p className="text-xs text-gray-400">bước · TB {actWeekAvgMin} phút/ngày</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 font-semibold mb-1">Trung bình</p>
                <p className="text-base font-extrabold text-gray-800">{actMonthAvgSteps.toLocaleString()}</p>
                <p className="text-xs text-gray-400">bước/ngày (tháng này)</p>
              </div>
            </div>

            {/* Steps chart */}
            {actWeekChartData.some((d) => d.steps > 0) && (
              <div className="mb-5">
                <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wide mb-3">
                  Số bước chân — Tuần này
                </p>
                <StepsBarChart data={actWeekChartData} />
              </div>
            )}

            {/* Minutes chart */}
            {actWeekChartData.some((d) => d.minutes > 0) && (
              <div className="mb-5">
                <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wide mb-3">
                  Phút vận động — Tuần này
                </p>
                <MinutesBarChart data={actWeekChartData} />
              </div>
            )}

            {/* History table */}
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wide mb-3">Lịch sử</p>
            {initialActivityLogs.length === 0 ? (
              <div className="h-20 flex items-center justify-center border-2 border-dashed border-gray-100 rounded-xl">
                <p className="text-xs text-gray-300 font-semibold">Khách hàng chưa cập nhật vận động</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {["Ngày", "Số bước", "Phút vận động", "Ghi chú"].map((h) => (
                        <th key={h} className="pb-2 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {initialActivityLogs.slice(0, 30).map((log) => (
                      <tr key={log.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
                        <td className="py-2.5 text-sm text-gray-600 font-medium">{formatDate(log.date)}</td>
                        <td className="py-2.5 text-sm font-bold text-blue-600">
                          {log.steps != null ? log.steps.toLocaleString() : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 text-sm text-gray-700">
                          {log.minutesActive != null ? `${log.minutesActive} phút` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 text-sm text-gray-400">{log.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VIEW 3: WORKOUT ── */}
      {view === "workout" && (
        <WorkoutTab
          clientId={client.id}
          initialPrograms={workoutProgs}
          isSubstitute={isSubstitute}
          initialLogs={initialWorkoutLogs}
          onPackageUpdated={(pkg) =>
            setPackages((prev) =>
              prev.map((p) =>
                p.id === pkg.id
                  ? { ...p, sessionsUsed: pkg.sessionsUsed, status: pkg.status as PackageEnrollment["status"] }
                  : p
              )
            )
          }
          userRole={userRole}
          enableLevelSystem={enableLevelSystem}
        />
      )}

      {/* ── VIEW 4: NUTRITION ── */}
      {view === "nutrition" && (
        <NutritionTab
          clientId={client.id}
          initialPlans={initialMealPlans ?? []}
          clientWeight={client.currentWeight}
          clientHeight={client.height}
          clientPhase={client.dietPhase}
          myPlateImageUrl={client.myPlateImageUrl}
          myPlateNote={client.myPlateNote}
          userRole={userRole}
        />
      )}

      {/* ── WEIGHT UPDATE SLIDE-OVER ── */}
      <SlideOver open={weightOpen} onClose={() => setWeightOpen(false)} title="Cập nhật cân nặng">
        <form onSubmit={handleWeightSubmit} className="px-6 py-5 space-y-4">
          <Field label="Ngày *">
            <DateMaskInput
              name="date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
              className={inputCls}
            />
          </Field>
          <Field label="Cân nặng (kg) *">
            <Input name="weight" type="number" step="0.01" required placeholder="65.50" onFocus={(e) => e.target.select()} className={inputCls} />
          </Field>
          <Field label="Ghi chú">
            <textarea
              name="note"
              rows={3}
              placeholder="Ghi chú thêm..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/40 resize-none"
            />
          </Field>
          {weightError && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-[#f15b5c] font-medium">{weightError}</p>
            </div>
          )}
          <div className="pt-2 flex gap-3">
            <Button type="submit" disabled={loading} className="flex-1 h-11 rounded-xl text-white font-semibold" style={{ backgroundColor: "#f15b5c" }}>
              {loading ? "Đang lưu..." : "Lưu"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setWeightOpen(false)} className="h-11 rounded-xl px-5">
              Hủy
            </Button>
          </div>
        </form>
      </SlideOver>

      {/* ── EDIT CLIENT SLIDE-OVER ── */}
      <SlideOver
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setAccountSuccess(false);
          setSavedPassword("");
          setAccountError("");
        }}
        title="Chỉnh sửa khách hàng"
        width="lg"
      >
        <form key={editGeneration} onSubmit={handleEditSubmit} className="px-6 py-5 space-y-4">
          {/* ── Ảnh đại diện ── */}
          <div className="flex flex-col items-center gap-3 pb-4 border-b border-gray-100">
            <div className="relative w-20 h-20 rounded-full overflow-hidden bg-[#f15b5c]/10 flex items-center justify-center flex-shrink-0">
              {pendingAvatarUrl ? (
                <img src={pendingAvatarUrl} alt={client.fullName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-extrabold text-[#f15b5c]">
                  {client.fullName[0].toUpperCase()}
                </span>
              )}
              {avatarUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 text-white animate-spin" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className={cn(
                "cursor-pointer px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors",
                avatarUploading && "opacity-50 cursor-not-allowed"
              )}>
                {avatarUploading ? "Đang xử lý..." : "Tải ảnh lên"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={avatarUploading}
                  onChange={handleAvatarChange}
                />
              </label>
              {pendingAvatarUrl && (
                <button
                  type="button"
                  onClick={() => setPendingAvatarUrl(null)}
                  className="px-4 py-2 rounded-xl border border-red-200 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
                >
                  Xóa ảnh
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400">Ảnh đại diện khách hàng (JPG, PNG)</p>
          </div>
          {client.clientCode && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 rounded-xl">
              <span className="text-xs text-gray-400 font-semibold">Mã khách hàng</span>
              <span className="text-sm font-bold text-gray-700">{client.clientCode}</span>
            </div>
          )}
          <SectionTitle>Thông tin cá nhân</SectionTitle>
          <Field label="Họ tên *">
            <Input name="fullName" required defaultValue={client.fullName} className={inputCls} />
          </Field>
          <div className="flex gap-3">
            <Field label="Số điện thoại *" half>
              <Input name="phone" required defaultValue={client.phone} className={inputCls} />
            </Field>
            <Field label="Ngày sinh" half>
              <Input name="dateOfBirth" type="date" lang="vi" defaultValue={isoToYMD(client.dateOfBirth)} className={inputCls} />
            </Field>
          </div>

          <SectionTitle>Chỉ số cơ thể</SectionTitle>
          <div className="flex gap-3">
            <Field label="Cân nặng hiện tại (kg)" half>
              <Input name="currentWeight" type="number" step="0.1" defaultValue={client.currentWeight} onFocus={(e) => e.target.select()} className={inputCls} />
            </Field>
            <Field label="Cân nặng mục tiêu (kg)" half>
              <Input name="targetWeight" type="number" step="0.1" defaultValue={client.targetWeight} onFocus={(e) => e.target.select()} className={inputCls} />
            </Field>
          </div>
          <div className="flex gap-3">
            <Field label="Chiều cao (cm)" half>
              <Input name="height" type="number" step="0.1" defaultValue={client.height} onFocus={(e) => e.target.select()} className={inputCls} />
            </Field>
            <Field label="Cân nặng ban đầu (kg)" half>
              <Input
                name="initialWeight"
                type="number"
                step="0.1"
                defaultValue={client.initialWeight}
                onFocus={(e) => e.target.select()}
                className={cn(inputCls, userRole === "PT" && "bg-gray-50 text-gray-400 cursor-not-allowed")}
                disabled={userRole === "PT"}
                title={userRole === "PT" ? "PT không được phép chỉnh sửa cân nặng ban đầu" : undefined}
              />
              {userRole === "PT" && (
                <p className="text-[10px] text-gray-400 mt-1">Chỉ Admin/FM được chỉnh sửa</p>
              )}
            </Field>
          </div>
          <div className="flex gap-3">
            <Field label="Vòng eo ban đầu (cm)" half>
              <Input name="initialWaist" type="number" step="0.1" defaultValue={client.initialWaist ?? ""} onFocus={(e) => e.target.select()} className={inputCls} />
            </Field>
            <Field label="Vòng mông ban đầu (cm)" half>
              <Input name="initialHip" type="number" step="0.1" defaultValue={client.initialHip ?? ""} onFocus={(e) => e.target.select()} className={inputCls} />
            </Field>
          </div>

          <SectionTitle>Sức khỏe & Mục tiêu</SectionTitle>
          <Field label="Tiền sử bệnh lý">
            <textarea name="healthConditions" rows={2} defaultValue={client.healthConditions ?? ""} placeholder="Tiểu đường, huyết áp cao..." className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/40 resize-none" />
          </Field>
          <Field label="Tiền sử chấn thương">
            <textarea name="injuries" rows={2} defaultValue={client.injuries ?? ""} placeholder="Đau gối trái..." className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/40 resize-none" />
          </Field>
          <div className="flex gap-3">
            <Field label="Ngày mục tiêu" half>
              <Input name="targetDate" type="text" placeholder="dd/mm/yyyy" defaultValue={isoToDmy(client.targetDate)} className={inputCls} />
            </Field>
          </div>
          <Field label="Ghi chú mục tiêu">
            <textarea name="goalNote" rows={2} defaultValue={client.goalNote ?? ""} placeholder="Muốn giảm cân trước đám cưới..." className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/40 resize-none" />
          </Field>

          <SectionTitle>Phân công</SectionTitle>
          <Field label="Nhân sự phụ trách *">
            <select name="assignedPTId" required defaultValue={client.assignedPT.id} className={selectCls}>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name ?? s.email}</option>
              ))}
            </select>
          </Field>
          <div className="flex gap-3">
            <Field label="Cơ sở *" half>
              <select name="branchId" required defaultValue={client.branch.id} className={selectCls}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Trạng thái *" half>
              <select name="status" required defaultValue={client.status} className={selectCls}>
                <option value="ACTIVE">Đang tập</option>
                <option value="PAUSED">Nghỉ tập</option>
                <option value="RESERVED">Bảo lưu</option>
              </select>
            </Field>
          </div>

          {editError && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-[#f15b5c] font-medium">{editError}</p>
            </div>
          )}
          <div className="pt-2 flex gap-3">
            <Button type="submit" disabled={loading} className="flex-1 h-11 rounded-xl text-white font-semibold" style={{ backgroundColor: "#f15b5c" }}>
              {loading ? "Đang lưu..." : "Cập nhật"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="h-11 rounded-xl px-5">
              Hủy
            </Button>
          </div>
        </form>

        {/* ── Account section (separate form) ── */}
        <div className="px-6 pb-6 pt-2 border-t border-gray-100 mt-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Tài khoản KH</p>
            {client.email && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                ✓ Đã có tài khoản
              </span>
            )}
          </div>
          <form onSubmit={handleAccountSubmit} className="space-y-3">
            <Field label="Email khách hàng *">
              <Input
                type="email"
                required
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                placeholder="khachhang@email.com"
                className={inputCls}
              />
            </Field>
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Mật khẩu</Label>
                <Input
                  readOnly
                  value={generatedPassword}
                  placeholder="Nhấn 'Tạo' để tạo mật khẩu"
                  className={cn(inputCls, "bg-gray-50 font-mono tracking-wider")}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setGeneratedPassword(generatePassword())}
                className="h-11 rounded-xl px-4 text-sm font-semibold shrink-0"
              >
                Tạo
              </Button>
            </div>
            {generatedPassword && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-amber-700 mb-0.5">Mật khẩu mới — hãy chia sẻ với KH:</p>
                <p className="text-base font-mono font-extrabold text-amber-900 tracking-widest">{generatedPassword}</p>
              </div>
            )}
            {accountError && <p className="text-sm text-[#f15b5c] font-medium">{accountError}</p>}
            {accountSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-1">
                <p className="text-sm text-green-700 font-semibold">✓ Đã cập nhật tài khoản thành công</p>
                {savedPassword && (
                  <>
                    <p className="text-xs text-green-600 font-semibold">Mật khẩu mới — chia sẻ với khách hàng:</p>
                    <p className="text-base font-mono font-extrabold text-green-800 tracking-widest">{savedPassword}</p>
                  </>
                )}
              </div>
            )}
            <Button
              type="submit"
              disabled={accountLoading}
              className="w-full h-11 rounded-xl font-semibold text-white"
              style={{ backgroundColor: "#f15b5c" }}
            >
              {accountLoading ? "Đang lưu..." : "Lưu tài khoản"}
            </Button>
          </form>
        </div>

        {/* ── Lộ trình đăng ký ── */}
        <div className="px-6 pb-6 pt-2 border-t border-gray-100 mt-2">
          <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3">Lộ trình đăng ký</p>
          {packages.length > 0 && (
            <div className="space-y-2 mb-4">
              {packages.map((pkg) => (
                <div key={pkg.id} className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-800">{pkg.packageName}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", PKG_STATUS_STYLE[getEffectiveStatus(pkg)])}>
                        {PKG_STATUS_LABEL[getEffectiveStatus(pkg)]}
                      </span>
                      <button
                        onClick={() => { setDeletePkgError(""); setDeletingPkgId(pkg.id); }}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Xóa gói tập"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{pkg.sessionsUsed}/{pkg.sessions} buổi · {(pkg.contractType === "KOC" || pkg.packageName === "KOC" || pkg.contractType === "KOL") ? "Miễn phí" : formatPrice(pkg.price)}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-16 flex-shrink-0">Số buổi đã tập:</span>
                    {canEditSessions ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="number"
                          min={0}
                          max={pkg.sessions}
                          placeholder={String(pkg.sessionsUsed)}
                          value={pkgSessionsInputs[pkg.id] ?? pkg.sessionsUsed}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setPkgSessionsInputs((prev) => ({ ...prev, [pkg.id]: e.target.value }))}
                          className="flex-1 h-7 rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                        />
                        <button
                          onClick={() => handleSaveSessionsUsed(pkg.id)}
                          disabled={savingSessionsId === pkg.id}
                          className="h-7 px-2 rounded-lg text-white text-xs font-bold disabled:opacity-50 whitespace-nowrap"
                          style={{ backgroundColor: "#f15b5c" }}
                        >
                          {savingSessionsId === pkg.id ? "..." : "Lưu"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-gray-700">
                        {pkg.sessionsUsed}/{pkg.sessions} buổi
                      </span>
                    )}
                  </div>
                  {!canEditSessions && (
                    <p className="text-[10px] text-gray-400 italic">
                      * Chỉ Admin và FM có thể chỉnh sửa số buổi đã tập
                    </p>
                  )}

                  {/* Số ngày bảo lưu / gia hạn */}
                  {canEditSessions ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-16 flex-shrink-0">Bảo lưu (ngày):</span>
                        <input
                          type="number"
                          min={0}
                          value={pkgReservedInputs[pkg.id] ?? pkg.reservedDays}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setPkgReservedInputs((prev) => ({ ...prev, [pkg.id]: e.target.value }))}
                          className="w-20 h-7 rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-16 flex-shrink-0">Gia hạn (ngày):</span>
                        <input
                          type="number"
                          min={0}
                          value={pkgExtensionInputs[pkg.id] ?? pkg.extensionDays}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setPkgExtensionInputs((prev) => ({ ...prev, [pkg.id]: e.target.value }))}
                          className="w-20 h-7 rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                        />
                        <button
                          onClick={() => handleSaveReservedExt(pkg.id)}
                          disabled={savingReservedExtId === pkg.id}
                          className="h-7 px-2 rounded-lg text-white text-xs font-bold disabled:opacity-50 whitespace-nowrap"
                          style={{ backgroundColor: "#f15b5c" }}
                        >
                          {savingReservedExtId === pkg.id ? "..." : "Lưu"}
                        </button>
                      </div>
                      {/* Calculated end date preview */}
                      {pkg.startDate && (() => {
                        const r = parseInt(pkgReservedInputs[pkg.id] ?? String(pkg.reservedDays), 10) || 0;
                        const x = parseInt(pkgExtensionInputs[pkg.id] ?? String(pkg.extensionDays), 10) || 0;
                        const d = new Date(pkg.startDate);
                        d.setDate(d.getDate() + pkg.durationDays + r + x);
                        return (
                          <p className="text-[10px] text-gray-400">
                            Ngày KT: {isoToDmy(pkg.startDate)} + {pkg.durationDays}n + {r}BL + {x}GH
                            {" = "}<span className="font-semibold text-gray-600">{formatDate(d.toISOString())}</span>
                          </p>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="text-xs text-gray-500">
                      <span>Bảo lưu: <strong>{pkg.reservedDays}</strong> ngày</span>
                      <span className="mx-2">·</span>
                      <span>Gia hạn: <strong>{pkg.extensionDays}</strong> ngày</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-16 flex-shrink-0">Ngày BĐ:</span>
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        placeholder="dd/mm/yyyy"
                        value={pkgStartDateInputs[pkg.id] ?? isoToDmy(pkg.startDate)}
                        maxLength={10}
                        onChange={(e) => setPkgStartDateInputs((prev) => ({ ...prev, [pkg.id]: maskDate(e.target.value) }))}
                        className="flex-1 h-7 rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                      />
                      <button
                        onClick={() => handleSaveStartDate(pkg.id)}
                        disabled={savingStartDateId === pkg.id}
                        className="h-7 px-2 rounded-lg text-white text-xs font-bold disabled:opacity-50 whitespace-nowrap"
                        style={{ backgroundColor: "#f15b5c" }}
                      >
                        {savingStartDateId === pkg.id ? "..." : "Lưu ngày"}
                      </button>
                    </div>
                  </div>
                  {pkg.endDate && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-16 flex-shrink-0">Ngày KT:</span>
                      <span className="text-xs text-gray-600">{formatDate(pkg.endDate)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-16 flex-shrink-0">Mã HĐ:</span>
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        placeholder="VD: HDLDF20250001"
                        value={pkgContractInputs[pkg.id] ?? pkg.contractCode ?? ""}
                        onChange={(e) => setPkgContractInputs((prev) => ({ ...prev, [pkg.id]: e.target.value }))}
                        className="flex-1 h-7 rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                      />
                      <button
                        onClick={() => handleSaveContractCode(pkg.id)}
                        disabled={savingContractId === pkg.id}
                        className="h-7 px-2 rounded-lg text-white text-xs font-bold disabled:opacity-50"
                        style={{ backgroundColor: "#f15b5c" }}
                      >
                        {savingContractId === pkg.id ? "..." : "Lưu"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500">Thêm gói tập</p>
            {(() => {
              const { names, note, noteOk } = getAvailablePackages(client.currentWeight, client.height, packages);
              return (
                <>
                  <p className={cn("text-[11px] font-semibold px-3 py-2 rounded-lg", noteOk ? "text-green-700 bg-green-50" : "text-gray-500 bg-gray-50")}>
                    {note}
                  </p>
                  <select
                    value={addPkgName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAddPkgName(v);
                      if (v === "KOC") setAddPkgContractType("KOC");
                      else if (v === "KOL") setAddPkgContractType("KOL");
                      else setAddPkgContractType("NORMAL");
                      if (v !== "KOL") setAddKolSponsoredPkg("");
                    }}
                    className={selectCls}
                  >
                    <option value="">Chọn gói tập...</option>
                    {names.map((name) => {
                      const p = PACKAGES[name];
                      return p ? (
                        <option key={p.name} value={p.name}>
                          {p.name === "KOC"
                            ? "KOC — Lộ trình tặng (60 buổi / 60 ngày)"
                            : `${p.name} — ${p.stageLabel} (${p.sessions} buổi, ${formatPrice(p.discountedPrice ?? p.price)})`}
                        </option>
                      ) : null;
                    })}
                    <option value="KOL">KOL — Hợp đồng KOL (Được tài trợ · 60,000đ/buổi)</option>
                  </select>
                </>
              );
            })()}

            {/* Package info preview for NORMAL packages */}
            {addPkgName && addPkgName !== "KOC" && addPkgName !== "KOL" && PACKAGES[addPkgName] && (
              <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1">
                <p><span className="font-bold">Số buổi:</span> {PACKAGES[addPkgName].sessions}</p>
                <p><span className="font-bold">Thời hạn:</span> {PACKAGES[addPkgName].durationDays} ngày</p>
                <p><span className="font-bold">Giá:</span> {formatPrice(PACKAGES[addPkgName].discountedPrice ?? PACKAGES[addPkgName].price)}</p>
              </div>
            )}

            {/* KOL-specific form */}
            {addPkgName === "KOL" && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-blue-700">Hợp đồng KOL</span>
                  <span className="text-[10px] text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">Được tài trợ · 60,000đ/buổi</span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-blue-700">Gói tập được tài trợ:</Label>
                  <select
                    value={addKolSponsoredPkg}
                    onChange={(e) => setAddKolSponsoredPkg(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Chọn gói tập được tài trợ...</option>
                    {["L1","L2","L3","L4","L5","Loyalfit"].map(name => {
                      const p = PACKAGES[name];
                      return p ? (
                        <option key={name} value={name}>
                          {name} — {p.stageLabel} ({p.sessions} buổi, {p.durationDays} ngày)
                        </option>
                      ) : null;
                    })}
                  </select>
                </div>
                {addKolSponsoredPkg && PACKAGES[addKolSponsoredPkg] && (
                  <div className="bg-blue-100/50 rounded-lg px-3 py-2.5 text-xs text-blue-700 space-y-1">
                    <p><span className="font-bold">Số buổi:</span> {PACKAGES[addKolSponsoredPkg].sessions}</p>
                    <p><span className="font-bold">Thời hạn:</span> {PACKAGES[addKolSponsoredPkg].durationDays} ngày</p>
                    <p><span className="font-bold">Phí:</span> 0đ <span className="italic text-blue-500">(Được tài trợ)</span></p>
                    <p><span className="font-bold">Hoa hồng PT:</span> 60,000đ/buổi (flat rate)</p>
                  </div>
                )}
              </div>
            )}

            {/* KOC-specific form */}
            {addPkgName === "KOC" && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-amber-700">Hợp đồng KOC</span>
                  <span className="text-[10px] text-amber-500 bg-amber-100 px-2 py-0.5 rounded-full">60 buổi · 60 ngày · Miễn phí</span>
                </div>

                {/* Eligibility check */}
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">Kiểm tra điều kiện KOC</p>
                  <div className="space-y-1">
                    {(() => {
                      const weightOk = client.currentWeight >= 70;
                      const heightOk = client.height < 160;
                      const age = client.dateOfBirth
                        ? new Date().getFullYear() - new Date(client.dateOfBirth).getFullYear()
                        : null;
                      const ageOk = age != null ? age >= 25 && age <= 45 : null;
                      const allOk = weightOk && heightOk && (ageOk ?? true);
                      return (
                        <>
                          <div className={cn("flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-lg",
                            weightOk ? "text-green-700 bg-green-50" : "text-red-600 bg-red-50")}>
                            {weightOk ? "✓" : "✗"} Cân nặng ≥ 70kg
                            <span className="font-normal ml-auto">{client.currentWeight}kg</span>
                          </div>
                          <div className={cn("flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-lg",
                            heightOk ? "text-green-700 bg-green-50" : "text-red-600 bg-red-50")}>
                            {heightOk ? "✓" : "✗"} Chiều cao &lt; 160cm
                            <span className="font-normal ml-auto">{client.height}cm</span>
                          </div>
                          {age != null && (
                            <div className={cn("flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-lg",
                              ageOk ? "text-green-700 bg-green-50" : "text-red-600 bg-red-50")}>
                              {ageOk ? "✓" : "✗"} Tuổi 25–45
                              <span className="font-normal ml-auto">{age} tuổi</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-lg text-green-700 bg-green-50">
                            ✓ Giới tính: Nữ
                          </div>
                          <div className={cn("mt-1 px-3 py-2 rounded-lg text-[11px] font-bold text-center",
                            allOk ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                            {allOk ? "✓ Đủ điều kiện KOC" : "✗ Không đủ điều kiện KOC"}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Start weight input */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">Cân nặng buổi đầu (kg) *</Label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="VD: 78.5"
                    value={addPkgStartWeight}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setAddPkgStartWeight(e.target.value)}
                    className="w-full h-9 rounded-xl border border-amber-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>

                {/* FM confirmation toggle */}
                <button
                  type="button"
                  onClick={() => setAddPkgFMConfirmed(v => !v)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all",
                    addPkgFMConfirmed
                      ? "bg-green-100 border-green-400 text-green-700"
                      : "bg-white border-gray-200 text-gray-500 hover:border-amber-300"
                  )}
                >
                  <span className={cn("w-4 h-4 rounded flex items-center justify-center text-white text-[10px] flex-shrink-0",
                    addPkgFMConfirmed ? "bg-green-500" : "bg-gray-300")}>
                    {addPkgFMConfirmed ? "✓" : ""}
                  </span>
                  FM đã xác nhận cân nặng đầu
                </button>

                {/* Commission preview */}
                {addPkgStartWeight && (
                  <div className="border border-amber-200 rounded-xl p-3 space-y-1">
                    <p className="text-[11px] font-bold text-amber-700">Hoa hồng PT ước tính (60 buổi):</p>
                    <div className="grid grid-cols-3 gap-1 text-[10px] text-amber-600">
                      <div className="bg-amber-50 rounded-lg p-2 text-center">
                        <p>Giảm 3–4.9kg</p>
                        <p className="font-bold text-amber-700">1,200,000đ</p>
                        <p className="text-[9px]">20k/buổi</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-2 text-center">
                        <p>Giảm 5–7.9kg</p>
                        <p className="font-bold text-amber-700">1,500,000đ</p>
                        <p className="text-[9px]">25k/buổi</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-2 text-center">
                        <p>Giảm 8–9.9kg</p>
                        <p className="font-bold text-amber-700">2,100,000đ</p>
                        <p className="text-[9px]">35k/buổi</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-600">Mã hợp đồng</Label>
              <input
                type="text"
                placeholder="VD: HDLDF20250001"
                value={addPkgContractCode}
                onChange={(e) => setAddPkgContractCode(e.target.value)}
                className="w-full h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
              />
            </div>
            {addPkgError && <p className="text-sm text-[#f15b5c]">{addPkgError}</p>}
            <Button
              type="button"
              disabled={!addPkgName || addPkgLoading || (addPkgName === "KOC" && !addPkgStartWeight) || (addPkgName === "KOL" && !addKolSponsoredPkg)}
              onClick={handleAddPackage}
              className="w-full h-10 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
              style={{ backgroundColor: "#f15b5c" }}
            >
              {addPkgLoading ? "Đang thêm..." : "Thêm gói tập"}
            </Button>
          </div>
        </div>
      </SlideOver>
      <AlertDialog
        open={!!deletingPkgId}
        onClose={() => { if (!deletePkgLoading) setDeletingPkgId(null); }}
        title="Xóa gói tập"
        description={deletePkgError || "Bạn có chắc muốn xóa gói tập này?\nHành động này không thể hoàn tác."}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
        onConfirm={handleDeletePackage}
        loading={deletePkgLoading}
      />

      <AlertDialog
        open={!!deletingWeightLogId}
        onClose={() => { if (!deleteWeightLoading) setDeletingWeightLogId(null); }}
        title="Xóa bản ghi cân nặng"
        description="Bạn có chắc muốn xóa bản ghi cân nặng này?\nHành động này không thể hoàn tác."
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
        onConfirm={handleDeleteWeightLog}
        loading={deleteWeightLoading}
      />

      {/* ── Edit Weight Log Modal ── */}
      {editingWeightLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (!editWeightLoading) setEditingWeightLog(null); }} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-extrabold text-gray-900">Sửa bản ghi cân nặng</h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Ngày</label>
                <input
                  type="date"
                  value={editWeightDate}
                  onChange={(e) => setEditWeightDate(e.target.value)}
                  className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Cân nặng (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editWeightValue}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setEditWeightValue(e.target.value)}
                  className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Ghi chú</label>
                <textarea
                  rows={2}
                  value={editWeightNote}
                  onChange={(e) => setEditWeightNote(e.target.value)}
                  placeholder="Ghi chú thêm..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 resize-none"
                />
              </div>
            </div>
            {editWeightError && (
              <p className="text-xs text-[#f15b5c] font-medium">{editWeightError}</p>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleEditWeightLog}
                disabled={editWeightLoading}
                className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-60"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {editWeightLoading ? "Đang lưu..." : "Lưu"}
              </button>
              <button
                onClick={() => setEditingWeightLog(null)}
                disabled={editWeightLoading}
                className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-500 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2">
          {toastMsg}
        </div>
      )}

      {/* ── Nhờ dạy hộ modal ── */}
      {subOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !subLoading && setSubOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="text-base font-extrabold text-gray-900">
              🔄 Nhờ dạy hộ —{" "}
              <span className="text-[#f15b5c]">{client.fullName}</span>
            </h2>

            {subSuccess ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-sm font-bold text-green-700">✓ Đã gửi yêu cầu thành công</p>
                  <p className="text-xs text-green-600 mt-1">PT hỗ trợ đã được thông báo</p>
                </div>
                <button
                  onClick={() => setSubOpen(false)}
                  className="w-full h-10 rounded-xl text-white font-bold text-sm"
                  style={{ backgroundColor: "#f15b5c" }}
                >
                  Đóng
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Step 1: PT selection */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">PT hỗ trợ *</label>
                  <select
                    value={subSubstituteId}
                    onChange={(e) => setSubSubstituteId(e.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/40"
                  >
                    <option value="">— Chọn PT —</option>
                    {substitutablePTs.map((pt) => (
                      <option key={pt.id} value={pt.id}>
                        {pt.name ?? pt.email}
                      </option>
                    ))}
                  </select>
                  {substitutablePTs.length === 0 && (
                    <p className="text-xs text-amber-500 font-semibold">Không có PT nào khả dụng trong cơ sở này</p>
                  )}
                </div>

                {/* Step 2: Type */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Loại hỗ trợ *</label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="subType"
                        value="SHORT_TERM"
                        checked={subType === "SHORT_TERM"}
                        onChange={() => setSubType("SHORT_TERM")}
                        className="mt-0.5 accent-[#f15b5c]"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">Hỗ trợ ngắn hạn</p>
                        {subType === "SHORT_TERM" && (
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="number"
                              value={subDays}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setSubDays(e.target.value)}
                              min={1}
                              max={90}
                              className="w-20 h-8 rounded-lg border border-gray-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                            />
                            <span className="text-sm text-gray-500">ngày</span>
                          </div>
                        )}
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="subType"
                        value="LONG_TERM"
                        checked={subType === "LONG_TERM"}
                        onChange={() => setSubType("LONG_TERM")}
                        className="mt-0.5 accent-[#f15b5c]"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Chuyển giao dài hạn</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Khách hàng sẽ chuyển về PT này vĩnh viễn
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Step 3: Notes */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Ghi chú (tuỳ chọn)</label>
                  <textarea
                    value={subNotes}
                    onChange={(e) => setSubNotes(e.target.value)}
                    placeholder="VD: KH đang ở giai đoạn 2, cần chú ý chế độ ăn..."
                    rows={2}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 resize-none"
                  />
                </div>

                {subError && (
                  <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                    <p className="text-sm text-[#f15b5c] font-semibold">{subError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleSubstituteSubmit}
                    disabled={subLoading}
                    className="flex-1 h-11 rounded-xl text-white font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-1.5"
                    style={{ backgroundColor: "#f15b5c" }}
                  >
                    {subLoading ? "Đang xử lý..." : (
                      <><RefreshCw className="w-4 h-4" /> Xác nhận chuyển giao</>
                    )}
                  </button>
                  <button
                    onClick={() => setSubOpen(false)}
                    disabled={subLoading}
                    className="h-11 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create Workout Program Modal ── */}
      {createProgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-extrabold text-gray-900">Tạo chương trình tập</h3>
              <button
                onClick={() => setCreateProgOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Giai đoạn *</label>
                <select
                  value={createProgForm.phaseId}
                  onChange={(e) => setCreateProgForm((f) => ({ ...f, phaseId: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                >
                  <option value="">— Chọn giai đoạn —</option>
                  {createProgPhases.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Số buổi/tuần</label>
                  <input
                    type="number" min={1} max={7}
                    value={createProgForm.sessionsPerWeek}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setCreateProgForm((f) => ({ ...f, sessionsPerWeek: Number(e.target.value) }))}
                    className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Tuần bắt đầu</label>
                  <input
                    type="number" min={1}
                    value={createProgForm.currentWeek}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setCreateProgForm((f) => ({ ...f, currentWeek: Number(e.target.value) }))}
                    className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Loại hình tập</label>
                <input
                  type="text"
                  placeholder="VD: Giảm mỡ, Tăng cơ, Phục hồi..."
                  value={createProgForm.workoutType}
                  onChange={(e) => setCreateProgForm((f) => ({ ...f, workoutType: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Ghi chú</label>
                <textarea
                  rows={3}
                  placeholder="Ghi chú về chương trình tập..."
                  value={createProgForm.notes}
                  onChange={(e) => setCreateProgForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 resize-none"
                />
              </div>

              {createProgError && (
                <p className="text-xs text-[#f15b5c] font-medium">{createProgError}</p>
              )}
            </div>

            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={handleCreateProg}
                disabled={createProgSaving}
                className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {createProgSaving
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Đang tạo...</>
                  : "Tạo chương trình tập"}
              </button>
              <button
                onClick={() => setCreateProgOpen(false)}
                className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
