import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { clientAuthOptions } from "@/lib/client-auth";

// ── Đăng nhập cho các API dinh dưỡng ────────────────────────────────────────
//
// Nhân sự (dashboard) và khách (cổng /my) đăng nhập bằng HAI cookie khác nhau,
// nên `getServerSession(authOptions)` không nhìn thấy phiên của khách. Các API
// dinh dưỡng dùng chung cho cả hai phía (tra cứu thực phẩm, quét ảnh món ăn, AI
// soạn thực đơn) vì vậy phải thử cả hai — trước đây chỉ kiểm tra phiên nhân sự
// nên khách gọi vào là 401.

export type NutritionActor =
  | { kind: "staff"; userId: string }
  | { kind: "client"; clientId: string };

/** Phiên đăng nhập của người gọi, ưu tiên nhân sự. null = chưa đăng nhập. */
export async function getNutritionActor(): Promise<NutritionActor | null> {
  const staff = await getServerSession(authOptions);
  if (staff?.user?.id) return { kind: "staff", userId: staff.user.id };

  const client = await getServerSession(clientAuthOptions);
  if (client?.user?.id) return { kind: "client", clientId: client.user.id };

  return null;
}
