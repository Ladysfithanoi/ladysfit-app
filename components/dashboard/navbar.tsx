"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  LogOut, User, KeyRound, ChevronDown, Eye, EyeOff, X, Bell, CheckCircle, XCircle, AlertTriangle, MessageSquareWarning, ClipboardList, Ruler, Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChecklistReportModal } from "@/components/dashboard/checklist-notif-modal";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  FM: "FM (Fitness Manager)",
  CEO_FITPARTNER: "CEO Fitpartner",
  FREE: "Tự do",
  RESTRICTED: "Hạn chế",
};
const ROLE_STYLE: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  FM: "bg-indigo-100 text-indigo-700",
  CEO_FITPARTNER: "bg-amber-100 text-amber-700",
  FREE: "bg-blue-100 text-blue-700",
  RESTRICTED: "bg-gray-100 text-gray-600",
};

const inputCls =
  "w-full h-11 rounded-xl border border-gray-200 px-4 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50";

function PasswordField({
  name,
  placeholder,
  value,
  onChange,
}: {
  name: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        name={name}
        type={show ? "text" : "password"}
        required
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

type UserInfo = {
  name: string | null;
  email: string;
  role: string;
  branch: { name: string } | null;
};

type UpgradeNotif = {
  id: string;
  userId: string;
  userName: string;
  passed: boolean;
  createdAt: string;
  readAt: string | null;
};

type PerfAlert = {
  id: string;
  alertType: "SLOW_PROGRESS" | "NO_WEIGH_IN";
  weekStart: string;
  expectedRate: number | null;
  actualRate: number | null;
  weeksAnalyzed: number | null;
  note: string | null;
  createdAt: string;
  client: { id: string; fullName: string };
};

type ComplaintItem = {
  id: string;
  category: string;
  content: string;
  status: "PENDING" | "PROCESSING" | "RESOLVED";
  isReadByFM: boolean;
  createdAt: string;
  client: { id: string; fullName: string; phone: string };
};

type ChecklistNotif = {
  id:        string;
  type:      "REMINDER" | "DAILY_REPORT";
  message:   string;
  isRead:    boolean;
  date:      string;
  createdAt: string;
};

export function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const isFM = session?.user?.role === "FM";
  const isPT = session?.user?.role === "FREE" || session?.user?.role === "RESTRICTED";

  // Dropdown
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Notification bell (admin — exam notifications)
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<UpgradeNotif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellLoaded, setBellLoaded] = useState(false);

  // PT performance alerts bell
  const [perfBellOpen, setPerfBellOpen] = useState(false);
  const perfBellRef = useRef<HTMLDivElement>(null);
  const [perfAlerts, setPerfAlerts] = useState<PerfAlert[]>([]);
  const [perfUnread, setPerfUnread] = useState(0);
  const [perfLoaded, setPerfLoaded] = useState(false);

  // FM complaint bell
  const [complaintBellOpen, setComplaintBellOpen] = useState(false);
  const complaintBellRef = useRef<HTMLDivElement>(null);
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [complaintUnread, setComplaintUnread] = useState(0);
  const [complaintLoaded, setComplaintLoaded] = useState(false);

  // Checklist notification bell (PT + FM)
  const [checklistBellOpen, setChecklistBellOpen]     = useState(false);
  const checklistBellRef                              = useRef<HTMLDivElement>(null);
  const [checklistNotifs, setChecklistNotifs]         = useState<ChecklistNotif[]>([]);
  const [checklistUnread, setChecklistUnread]         = useState(0);
  const [checklistLoaded, setChecklistLoaded]         = useState(false);
  const [reportModalDate, setReportModalDate]         = useState<string | null>(null);

  // Measurement notification bell (PT only)
  const [measBellOpen,   setMeasBellOpen]   = useState(false);
  const measBellRef                         = useRef<HTMLDivElement>(null);
  const [measNotifs,     setMeasNotifs]     = useState<{ id: string; message: string; isRead: boolean; createdAt: string; client: { id: string; fullName: string } }[]>([]);
  const [measUnread,     setMeasUnread]     = useState(0);
  const [measLoaded,     setMeasLoaded]     = useState(false);

  // Info slide-over
  const [infoOpen, setInfoOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);

  // Change password slide-over
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
      if (perfBellRef.current && !perfBellRef.current.contains(e.target as Node)) {
        setPerfBellOpen(false);
      }
      if (complaintBellRef.current && !complaintBellRef.current.contains(e.target as Node)) {
        setComplaintBellOpen(false);
      }
      if (checklistBellRef.current && !checklistBellRef.current.contains(e.target as Node)) {
        setChecklistBellOpen(false);
      }
      if (measBellRef.current && !measBellRef.current.contains(e.target as Node)) {
        setMeasBellOpen(false);
      }
    }
    if (dropdownOpen || bellOpen || perfBellOpen || complaintBellOpen || checklistBellOpen || measBellOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen, bellOpen, perfBellOpen, complaintBellOpen, checklistBellOpen, measBellOpen]);

  // Poll unread count for admin
  useEffect(() => {
    if (!isAdmin) return;
    async function fetchUnread() {
      try {
        const res = await fetch("/api/exam/notifications");
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount);
        }
      } catch { /* ignore */ }
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // Poll PT performance alerts
  useEffect(() => {
    if (!isPT) return;
    async function fetchPerfUnread() {
      try {
        const res = await fetch("/api/pt/performance-alerts");
        if (res.ok) {
          const data: PerfAlert[] = await res.json();
          setPerfUnread(data.length);
        }
      } catch { /* ignore */ }
    }
    fetchPerfUnread();
    const interval = setInterval(fetchPerfUnread, 60000);
    return () => clearInterval(interval);
  }, [isPT]);

  async function openPerfBell() {
    setPerfBellOpen((v) => !v);
    if (!perfLoaded) {
      try {
        const res = await fetch("/api/pt/performance-alerts");
        if (res.ok) {
          const data: PerfAlert[] = await res.json();
          setPerfAlerts(data);
          setPerfUnread(data.length);
          setPerfLoaded(true);
        }
      } catch { /* ignore */ }
    }
  }

  async function markPerfRead() {
    const ids = perfAlerts.map((a) => a.id);
    await fetch("/api/pt/performance-alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setPerfAlerts([]);
    setPerfUnread(0);
  }

  // Poll FM complaint unread count
  useEffect(() => {
    if (!isFM) return;
    async function fetchComplaintUnread() {
      try {
        const res = await fetch("/api/complaints");
        if (res.ok) {
          const data: ComplaintItem[] = await res.json();
          setComplaintUnread(data.filter((c) => !c.isReadByFM).length);
        }
      } catch { /* ignore */ }
    }
    fetchComplaintUnread();
    const interval = setInterval(fetchComplaintUnread, 30000);
    return () => clearInterval(interval);
  }, [isFM]);

  // Poll checklist notification unread count (PT + FM)
  useEffect(() => {
    if (!isPT && !isFM) return;
    async function fetchChecklistUnread() {
      try {
        const res = await fetch("/api/notifications/checklist");
        if (res.ok) {
          const data = await res.json();
          setChecklistUnread(data.unreadCount ?? 0);
        }
      } catch { /* ignore */ }
    }
    fetchChecklistUnread();
    const interval = setInterval(fetchChecklistUnread, 60000);
    return () => clearInterval(interval);
  }, [isPT, isFM]);

  // Poll measurement notification unread (PT only)
  useEffect(() => {
    if (!isPT) return;
    async function fetchMeasUnread() {
      try {
        const res = await fetch("/api/notifications/measurement");
        if (res.ok) {
          const data = await res.json();
          setMeasUnread(data.unreadCount ?? 0);
        }
      } catch { /* ignore */ }
    }
    fetchMeasUnread();
    const interval = setInterval(fetchMeasUnread, 60000);
    return () => clearInterval(interval);
  }, [isPT]);

  async function openMeasBell() {
    setMeasBellOpen((v) => !v);
    if (!measLoaded) {
      try {
        const res = await fetch("/api/notifications/measurement");
        if (res.ok) {
          const data = await res.json();
          setMeasNotifs(data.notifications ?? []);
          setMeasUnread(data.unreadCount ?? 0);
          setMeasLoaded(true);
        }
      } catch { /* ignore */ }
    }
  }

  async function markMeasRead() {
    await fetch("/api/notifications/measurement", { method: "PATCH" });
    setMeasNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setMeasUnread(0);
  }

  async function openChecklistBell() {
    setChecklistBellOpen((v) => !v);
    if (!checklistLoaded) {
      try {
        const res = await fetch("/api/notifications/checklist");
        if (res.ok) {
          const data = await res.json();
          setChecklistNotifs(data.notifications ?? []);
          setChecklistUnread(data.unreadCount ?? 0);
          setChecklistLoaded(true);
        }
      } catch { /* ignore */ }
    }
  }

  async function markChecklistRead() {
    await fetch("/api/notifications/checklist", { method: "PATCH" });
    setChecklistNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setChecklistUnread(0);
  }

  function openReportModal(notif: ChecklistNotif) {
    setChecklistBellOpen(false);
    // Mark this notification as read
    fetch("/api/notifications/checklist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [notif.id] }),
    });
    setChecklistNotifs((prev) => prev.map((n) => n.id === notif.id ? { ...n, isRead: true } : n));
    setChecklistUnread((c) => Math.max(0, c - (notif.isRead ? 0 : 1)));
    setReportModalDate(notif.date);
  }

  async function openComplaintBell() {
    setComplaintBellOpen((v) => !v);
    if (!complaintLoaded) {
      try {
        const res = await fetch("/api/complaints");
        if (res.ok) {
          const data: ComplaintItem[] = await res.json();
          setComplaints(data);
          setComplaintUnread(data.filter((c) => !c.isReadByFM).length);
          setComplaintLoaded(true);
        }
      } catch { /* ignore */ }
    }
  }

  async function openBell() {
    setBellOpen((v) => !v);
    if (!bellLoaded) {
      try {
        const res = await fetch("/api/exam/notifications");
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount);
          setBellLoaded(true);
        }
      } catch { /* ignore */ }
    }
  }

  async function markAllRead() {
    await fetch("/api/exam/notifications", { method: "PUT" });
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
    setUnreadCount(0);
  }

  // Lock body scroll for slide-overs
  useEffect(() => {
    if (infoOpen || pwOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [infoOpen, pwOpen]);

  // ESC to close slide-overs
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setInfoOpen(false);
        setPwOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  async function openInfo() {
    setDropdownOpen(false);
    setInfoOpen(true);
    if (!userInfo) {
      setInfoLoading(true);
      try {
        const res = await fetch("/api/staff/me");
        if (res.ok) setUserInfo(await res.json());
      } finally {
        setInfoLoading(false);
      }
    }
  }

  function openChangePw() {
    setDropdownOpen(false);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setPwError("");
    setPwSuccess(false);
    setPwOpen(true);
  }

  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    if (newPw.length < 8) {
      setPwError("Mật khẩu mới phải có ít nhất 8 ký tự");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("Mật khẩu xác nhận không khớp");
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/staff/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error ?? "Có lỗi xảy ra");
      } else {
        setPwSuccess(true);
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      }
    } catch {
      setPwError("Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setPwLoading(false);
    }
  }

  const displayName = session?.user?.name ?? session?.user?.email ?? "Admin";
  const initials = displayName[0].toUpperCase();

  return (
    <>
      <header className="fixed top-0 left-0 lg:left-60 right-0 h-16 bg-white border-b border-gray-100 z-30 flex items-center justify-between px-4 md:px-6">
        {/* Mobile: hamburger + logo */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="text-lg font-extrabold text-[#f15b5c] tracking-tight">Ladysfit</span>
        </div>
        {/* Desktop spacer (logo is in sidebar) */}
        <div className="hidden lg:block" />

        <div className="flex items-center gap-3">
        {/* Notification bell — ADMIN only */}
        {isAdmin && (
          <div ref={bellRef} className="relative">
            <button
              onClick={openBell}
              className="relative p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#f15b5c] text-white text-[10px] font-extrabold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute right-0 top-full mt-2 w-[min(320px,calc(100vw-1rem))] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-900">Thông báo thi</p>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs font-semibold text-[#f15b5c] hover:opacity-80"
                    >
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell className="w-6 h-6 text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-300 font-semibold">Không có thông báo</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3",
                          !n.readAt && "bg-[#f15b5c]/3"
                        )}
                      >
                        <div className={cn("mt-0.5 shrink-0", n.passed ? "text-emerald-500" : "text-red-400")}>
                          {n.passed
                            ? <CheckCircle className="w-4 h-4" />
                            : <XCircle className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{n.userName}</p>
                          <p className={cn("text-xs", n.passed ? "text-emerald-600" : "text-red-500")}>
                            {n.passed ? "Đã đạt — Nâng lên cấp Cơ bản" : "Thi không đạt"}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(n.createdAt).toLocaleString("vi-VN", {
                              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        </div>
                        {!n.readAt && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#f15b5c] mt-1.5 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PT performance alerts bell */}
        {isPT && (
          <div ref={perfBellRef} className="relative">
            <button
              onClick={openPerfBell}
              className="relative p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {perfUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                  {perfUnread > 9 ? "9+" : perfUnread}
                </span>
              )}
            </button>

            {perfBellOpen && (
              <div className="absolute right-0 top-full mt-2 w-[min(320px,calc(100vw-1rem))] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-900">Cảnh báo tiến độ</p>
                  {perfAlerts.length > 0 && (
                    <button
                      onClick={markPerfRead}
                      className="text-xs font-semibold text-[#f15b5c] hover:opacity-80"
                    >
                      Đã đọc tất cả
                    </button>
                  )}
                </div>
                {perfAlerts.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell className="w-6 h-6 text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-300 font-semibold">Không có cảnh báo</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                    {perfAlerts.map((a) => (
                      <div key={a.id} className="flex items-start gap-3 px-4 py-3 bg-amber-50/50">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">
                            {a.client.fullName}
                          </p>
                          {a.alertType === "SLOW_PROGRESS" ? (
                            <>
                              <p className="text-xs text-amber-600 font-semibold">Tiến độ chậm</p>
                              {a.actualRate != null && a.expectedRate != null && (
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                  TB: <strong>{a.actualRate.toFixed(2)}%</strong>/tuần · kỳ vọng: ≥{a.expectedRate}%
                                </p>
                              )}
                              {a.weeksAnalyzed != null && (
                                <p className="text-[10px] text-gray-400">
                                  {a.weeksAnalyzed} tuần có đủ dữ liệu
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-blue-600 font-semibold">Chưa cân trong 7 ngày</p>
                          )}
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Tuần {new Date(a.weekStart).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* FM complaint bell */}
        {isFM && (
          <div ref={complaintBellRef} className="relative">
            <button
              onClick={openComplaintBell}
              className="relative p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <MessageSquareWarning className="w-5 h-5" />
              {complaintUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-orange-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                  {complaintUnread > 9 ? "9+" : complaintUnread}
                </span>
              )}
            </button>

            {complaintBellOpen && (
              <div className="absolute right-0 top-full mt-2 w-[min(320px,calc(100vw-1rem))] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-900">Khiếu nại</p>
                  <a
                    href="/dashboard/complaints"
                    className="text-xs font-semibold text-[#f15b5c] hover:opacity-80"
                    onClick={() => setComplaintBellOpen(false)}
                  >
                    Xem tất cả
                  </a>
                </div>
                {complaints.length === 0 ? (
                  <div className="py-8 text-center">
                    <MessageSquareWarning className="w-6 h-6 text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-300 font-semibold">Không có khiếu nại</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                    {complaints.slice(0, 5).map((c) => (
                      <a
                        key={c.id}
                        href="/dashboard/complaints"
                        onClick={() => setComplaintBellOpen(false)}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${!c.isReadByFM ? "bg-orange-50/50" : ""}`}
                      >
                        <MessageSquareWarning className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{c.client.fullName}</p>
                          <p className="text-xs text-gray-500 truncate">{c.category}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(c.createdAt).toLocaleString("vi-VN", {
                              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        </div>
                        {!c.isReadByFM && (
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Measurement notification bell — PT only */}
        {isPT && (
          <div ref={measBellRef} className="relative">
            <button
              onClick={openMeasBell}
              className="relative p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
              title="Thông báo số đo"
            >
              <Ruler className="w-5 h-5" />
              {measUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-purple-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                  {measUnread > 9 ? "9+" : measUnread}
                </span>
              )}
            </button>

            {measBellOpen && (
              <div className="absolute right-0 top-full mt-2 w-[min(320px,calc(100vw-1rem))] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-900">Số đo từ khách hàng</p>
                  {measUnread > 0 && (
                    <button onClick={markMeasRead} className="text-xs font-semibold text-[#f15b5c] hover:opacity-80">
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>
                {measNotifs.length === 0 ? (
                  <div className="py-8 text-center">
                    <Ruler className="w-6 h-6 text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-300 font-semibold">Không có thông báo</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                    {measNotifs.map((n) => (
                      <a
                        key={n.id}
                        href={`/dashboard/clients/${n.client.id}`}
                        onClick={() => {
                          setMeasBellOpen(false);
                          if (!n.isRead) {
                            fetch("/api/notifications/measurement", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ ids: [n.id] }),
                            });
                            setMeasNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
                            setMeasUnread((c) => Math.max(0, c - 1));
                          }
                        }}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors",
                          !n.isRead && "bg-purple-50/50"
                        )}
                      >
                        <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Ruler className="w-3.5 h-3.5 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs truncate", !n.isRead ? "font-bold text-gray-800" : "font-semibold text-gray-500")}>
                            {n.message}
                          </p>
                          <p className="text-[10px] text-purple-400 mt-0.5 font-semibold">Nhấn để xem chi tiết →</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(n.createdAt).toLocaleString("vi-VN", {
                              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        </div>
                        {!n.isRead && <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Checklist notification bell — PT (REMINDER) + FM (DAILY_REPORT) */}
        {(isPT || isFM) && (
          <div ref={checklistBellRef} className="relative">
            <button
              onClick={openChecklistBell}
              className="relative p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
              title="Thông báo check-list"
            >
              <ClipboardList className="w-5 h-5" />
              {checklistUnread > 0 && (
                <span className={cn(
                  "absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white text-[10px] font-extrabold flex items-center justify-center",
                  isPT ? "bg-orange-500" : "bg-blue-500"
                )}>
                  {checklistUnread > 9 ? "9+" : checklistUnread}
                </span>
              )}
            </button>

            {checklistBellOpen && (
              <div className="absolute right-0 top-full mt-2 w-[min(320px,calc(100vw-1rem))] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-900">Thông báo Check-list</p>
                  {checklistUnread > 0 && (
                    <button
                      onClick={markChecklistRead}
                      className="text-xs font-semibold text-[#f15b5c] hover:opacity-80"
                    >
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>

                {checklistNotifs.length === 0 ? (
                  <div className="py-8 text-center">
                    <ClipboardList className="w-6 h-6 text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-300 font-semibold">Không có thông báo</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                    {checklistNotifs.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 transition-colors",
                          !n.isRead && (n.type === "REMINDER" ? "bg-orange-50/60" : "bg-blue-50/40"),
                          n.type === "DAILY_REPORT" && "cursor-pointer hover:bg-blue-50/60"
                        )}
                        onClick={() => n.type === "DAILY_REPORT" ? openReportModal(n) : undefined}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs",
                          n.type === "REMINDER"     ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"
                        )}>
                          {n.type === "REMINDER" ? "⏰" : "📋"}
                        </div>
                        <div className="flex-1 min-w-0">
                          {n.type === "REMINDER" ? (
                            <a
                              href="/dashboard/checklist"
                              onClick={() => {
                                setChecklistBellOpen(false);
                                if (!n.isRead) {
                                  fetch("/api/notifications/checklist", {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ ids: [n.id] }),
                                  });
                                  setChecklistNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
                                  setChecklistUnread((c) => Math.max(0, c - 1));
                                }
                              }}
                            >
                              <p className={cn("text-xs", !n.isRead ? "font-bold text-orange-700" : "font-semibold text-gray-500")}>
                                Chưa điền Check-list hôm nay
                              </p>
                              <p className="text-[10px] text-orange-400 mt-0.5 font-semibold">Nhấn để điền ngay →</p>
                            </a>
                          ) : (
                            <>
                              <p className={cn("text-xs", !n.isRead ? "font-bold text-blue-700" : "font-semibold text-gray-500")}>
                                {(() => {
                                  const d = new Date(n.date);
                                  return `Báo cáo ngày ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
                                })()}
                              </p>
                              <p className="text-[10px] text-blue-400 mt-0.5 font-semibold">Nhấn để xem chi tiết →</p>
                            </>
                          )}
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(n.createdAt).toLocaleString("vi-VN", {
                              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        </div>
                        {!n.isRead && (
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                            n.type === "REMINDER" ? "bg-orange-500" : "bg-blue-500"
                          )} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* User dropdown trigger */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#f15b5c]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-extrabold text-[#f15b5c]">{initials}</span>
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold text-gray-800 leading-none">
                {session?.user?.name ?? "Admin"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 leading-none">
                {session?.user?.email}
              </p>
            </div>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-gray-400 transition-transform duration-200",
                dropdownOpen && "rotate-180"
              )}
            />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50 overflow-hidden">
              <button
                onClick={openInfo}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <User className="w-4 h-4 text-gray-400" />
                Thông tin cá nhân
              </button>
              <button
                onClick={openChangePw}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <KeyRound className="w-4 h-4 text-gray-400" />
                Đổi mật khẩu
              </button>
              <div className="my-1 border-t border-gray-100" />
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
        </div>
      </header>

      {/* ── Shared backdrop ── */}
      <div
        className={cn(
          "fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40 transition-opacity duration-300",
          infoOpen || pwOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        onClick={() => { setInfoOpen(false); setPwOpen(false); }}
      />

      {/* ── Thông tin cá nhân slide-over ── */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out",
          infoOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Thông tin cá nhân</h2>
          <button
            onClick={() => setInfoOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {infoLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-gray-400 font-semibold">Đang tải...</p>
            </div>
          ) : userInfo ? (
            <div className="space-y-5">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3 pb-5 border-b border-gray-100">
                <div className="w-16 h-16 rounded-full bg-[#f15b5c]/10 flex items-center justify-center">
                  <span className="text-2xl font-extrabold text-[#f15b5c]">
                    {(userInfo.name ?? userInfo.email)[0].toUpperCase()}
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-base font-extrabold text-gray-900">{userInfo.name ?? "—"}</p>
                  <p className="text-sm text-gray-400 mt-0.5">{userInfo.email}</p>
                </div>
              </div>

              {/* Info rows */}
              {[
                { label: "Họ tên", value: userInfo.name ?? "—" },
                { label: "Email", value: userInfo.email },
                {
                  label: "Cấp độ",
                  value: (
                    <span
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-bold",
                        ROLE_STYLE[userInfo.role] ?? "bg-gray-100 text-gray-600"
                      )}
                    >
                      {ROLE_LABEL[userInfo.role] ?? userInfo.role}
                    </span>
                  ),
                },
                { label: "Cơ sở", value: userInfo.branch?.name ?? "—" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-400 font-semibold">{row.label}</span>
                  <span className="text-sm font-semibold text-gray-800">{row.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 font-semibold text-center py-12">
              Không thể tải thông tin
            </p>
          )}
        </div>
      </div>

      {/* ── FM Checklist Report Modal ── */}
      {reportModalDate && (
        <ChecklistReportModal
          date={reportModalDate}
          onClose={() => setReportModalDate(null)}
        />
      )}

      {/* ── Đổi mật khẩu slide-over ── */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out",
          pwOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Đổi mật khẩu</h2>
          <button
            onClick={() => setPwOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {pwSuccess ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-2xl">✓</span>
              </div>
              <p className="text-base font-bold text-green-700 text-center">
                Đổi mật khẩu thành công!
              </p>
              <p className="text-sm text-gray-400 text-center">
                Mật khẩu của bạn đã được cập nhật.
              </p>
              <button
                onClick={() => setPwOpen(false)}
                className="mt-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold"
                style={{ backgroundColor: "#f15b5c" }}
              >
                Đóng
              </button>
            </div>
          ) : (
            <form onSubmit={handleChangePw} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700">Mật khẩu hiện tại *</label>
                <PasswordField
                  name="currentPassword"
                  placeholder="••••••••"
                  value={currentPw}
                  onChange={setCurrentPw}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700">Mật khẩu mới *</label>
                <PasswordField
                  name="newPassword"
                  placeholder="Tối thiểu 8 ký tự"
                  value={newPw}
                  onChange={setNewPw}
                />
                {newPw.length > 0 && newPw.length < 8 && (
                  <p className="text-xs text-amber-500 font-semibold">
                    Mật khẩu mới phải có ít nhất 8 ký tự
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700">Xác nhận mật khẩu mới *</label>
                <PasswordField
                  name="confirmPassword"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPw}
                  onChange={setConfirmPw}
                />
                {confirmPw.length > 0 && confirmPw !== newPw && (
                  <p className="text-xs text-amber-500 font-semibold">
                    Mật khẩu xác nhận không khớp
                  </p>
                )}
              </div>

              {pwError && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                  <p className="text-sm text-[#f15b5c] font-semibold">{pwError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={pwLoading}
                className="w-full h-11 rounded-xl text-white font-bold text-sm disabled:opacity-60 transition-opacity mt-2"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {pwLoading ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
