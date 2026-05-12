export type LeadStatus = "TAKECARE" | "FAIL" | "DE" | "PIF" | "PB";

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  TAKECARE: "Đang chăm",
  FAIL: "Không đăng ký",
  DE: "Đặt cọc",
  PIF: "Đã thanh toán",
  PB: "Thanh toán nốt",
};

export const LEAD_STATUS_STYLE: Record<LeadStatus, string> = {
  TAKECARE: "bg-yellow-100 text-yellow-700",
  FAIL: "bg-red-100 text-red-600",
  DE: "bg-blue-100 text-blue-700",
  PIF: "bg-emerald-100 text-emerald-700",
  PB: "bg-orange-100 text-orange-700",
};

export const SOURCES = [
  "Facebook Page", "Referral", "Tiktok", "Zalo", "Outdoor", "Website", "Renew", "Referral.PT",
];

export type PTUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

export type SalesLead = {
  id: string;
  branchId: string;
  assignedPTId: string;
  consultationId: string | null;
  customerName: string;
  yearOfBirth: number | null;
  phone: string | null;
  source: string | null;
  notes: string | null;
  forecast: string | null;
  status: LeadStatus;
  packageRegistered: string | null;
  actualRevenue: number | null;
  remainingPayment: number | null;
  fitpartnerRevenue: number | null;
  signDate: string | null;
  remark: string | null;
  month: number;
  year: number;
  assignedPT: PTUser;
  createdBy: { id: string; name: string | null };
};

export type WeeklyActual = {
  id: string;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  revenueActual: number;
  fitpartnerRevenueActual: number;
  fitActual: number;
  cooperationActual: number;
  transformActual: number;
  googleReviewActual: number;
  cvActual: number;
  weeklyTaskNotes: string | null;
};

export type MonthlyTarget = {
  id: string;
  branchId: string;
  userId: string;
  month: number;
  year: number;
  revenueTarget: number;
  fitpartnerRevenueTarget: number;
  fitTarget: number;
  cooperationTarget: number;
  transformTarget: number;
  googleReviewTarget: number;
  cvTarget: number;
  user: PTUser;
  weeklyActuals: WeeklyActual[];
};
