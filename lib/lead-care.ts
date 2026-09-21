/**
 * Ưu tiên khách và nhắc hẹn chăm sóc lại — hai thứ bám vào một lead nhưng KHÔNG
 * đi qua PUT /api/setup/leads/[id].
 *
 * Lý do tách: PUT đó là nơi ở của luật tiền (doanh thu phải khớp bảng giá, ngày
 * ký chạy theo ô tiền, dòng thu nốt khoá cứng ở PB…). Bấm một ngôi sao ưu tiên
 * hay đặt một cái hẹn gọi lại thì không liên quan gì tới tiền, nhét chung vào đó
 * chỉ tạo cơ hội cho một lead dữ liệu tiền cũ chưa chuẩn bị chặn không cho đặt
 * hẹn.
 */

import { prisma } from "@/lib/prisma";

/** Người đang đăng nhập, lấy từ `session.user`. */
export type LeadActor = {
  id:                string;
  role?:             string | null;
  managedBranchIds?: string[];
};

/** Lead vừa đủ để xét quyền. */
type LeadScope = { assignedPTId: string | null; branchId: string };

/**
 * Ai được đụng vào ưu tiên / nhắc hẹn của một lead: Admin và COO với tất cả, FM
 * với lead thuộc cơ sở mình phụ trách, PT chỉ với lead của chính mình. Đúng
 * cùng một ranh giới với việc sửa lead, chỉ khác là không kèm luật tiền.
 */
export function canCareForLead(actor: LeadActor, lead: LeadScope): boolean {
  const role = actor.role;
  if (role === "ADMIN" || role === "COO") return true;
  if (role === "FM") return (actor.managedBranchIds ?? []).includes(lead.branchId);
  if (role === "PT") return lead.assignedPTId === actor.id;
  return false;
}

/** Lead kèm quyền, hoặc `null` nếu không có / không được phép. */
export async function findLeadForCare(id: string, actor: LeadActor) {
  const lead = await prisma.salesLead.findUnique({
    where:  { id },
    select: { id: true, assignedPTId: true, branchId: true, customerName: true },
  });
  if (!lead) return null;
  return canCareForLead(actor, lead) ? lead : null;
}

// ── Thứ tự hiển thị ─────────────────────────────────────────────────────────

/** Vừa đủ để xếp thứ tự — dùng được cho cả bản ghi Prisma lẫn kiểu của giao diện. */
export type SortableLead = {
  prioritizedAt: string | Date | null;
  createdAt?:    string | Date | null;
};

function ms(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return isNaN(t) ? null : t;
}

/**
 * Khách ưu tiên lên đầu, trong nhóm ưu tiên thì AI ĐƯỢC CHỌN TRƯỚC ĐỨNG TRƯỚC;
 * còn lại giữ nguyên thứ tự cũ (theo ngày tạo).
 *
 * Đây là nơi DUY NHẤT quyết định thứ tự nhìn thấy trên bảng: máy chủ trả về theo
 * thứ tự nào cũng được, giao diện xếp lại bằng đúng hàm này. Nhờ vậy bấm ngôi
 * sao là hàng nhảy lên ngay, không phải tải lại danh sách rồi mới thấy.
 */
export function compareLeadOrder(a: SortableLead, b: SortableLead): number {
  const pa = ms(a.prioritizedAt);
  const pb = ms(b.prioritizedAt);
  if (pa !== null && pb !== null) return pa - pb;
  if (pa !== null) return -1;
  if (pb !== null) return 1;
  return (ms(a.createdAt) ?? 0) - (ms(b.createdAt) ?? 0);
}

/** Bản sao đã xếp thứ tự của một danh sách lead. */
export function sortLeadsForDisplay<T extends SortableLead>(leads: T[]): T[] {
  return [...leads].sort(compareLeadOrder);
}
