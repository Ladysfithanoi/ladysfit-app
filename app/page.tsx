import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Cùng một icon trên màn hình chính phục vụ hai lớp người dùng, nên chỗ mở app
// phải tự đoán: ai đang giữ cookie hội viên thì vào thẳng cổng hội viên, còn lại
// về màn đăng nhập nhân viên như trước.
export default function Home() {
  const useSecureCookies = process.env.NODE_ENV === "production";
  // Phải trùng tên cookie đặt trong lib/client-auth.ts và middleware.ts.
  const clientCookie = `${useSecureCookies ? "__Secure-" : ""}my-client-token-v2`;

  if (cookies().has(clientCookie)) {
    redirect("/my");
  }

  redirect("/login");
}
