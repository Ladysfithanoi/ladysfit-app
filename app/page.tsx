import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Mở app từ icon màn hình chính là vào cửa PT. Ai đang còn phiên đăng nhập thì
// vào thẳng dashboard, khỏi phải gõ lại mật khẩu mỗi lần mở.
// Hội viên vẫn dùng app này được, nhưng đi lối riêng /my/login.
export default function Home() {
  // Phải trùng tên cookie đặt trong lib/auth.ts.
  const staffCookie =
    process.env.NODE_ENV === "production"
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

  if (cookies().has(staffCookie)) {
    redirect("/dashboard");
  }

  redirect("/login");
}
