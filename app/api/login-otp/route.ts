import { NextResponse } from "next/server";
import {
  DEVICE_COOKIE,
  deviceCookieOptions,
  hashDeviceId,
  isDeviceTrusted,
  isLoginOtpEnabled,
  issueLoginOtp,
  maskEmail,
  newDeviceId,
  readDeviceIdFromCookieHeader,
  verifyLoginPassword,
  type AccountType,
} from "@/lib/login-device";

/**
 * Bước 1 của đăng nhập (cả /login lẫn /my/login): kiểm mật khẩu, cấp cookie id
 * máy nếu chưa có, và nếu máy chưa được tin cậy thì gửi mã về email.
 * Bước 2 là signIn() của NextAuth kèm `otp` — nơi thực sự cấp phiên.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const type: AccountType = body.kind === "client" ? "CLIENT" : "STAFF";
  const email    = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  let deviceId = readDeviceIdFromCookieHeader(req.headers.get("cookie"));
  const isNewCookie = !deviceId;
  if (!deviceId) deviceId = newDeviceId();

  const respond = (data: object, status = 200) => {
    const res = NextResponse.json(data, { status });
    if (isNewCookie) res.cookies.set(DEVICE_COOKIE, deviceId!, deviceCookieOptions());
    return res;
  };

  let account;
  try {
    account = await verifyLoginPassword(type, email, password, req);
  } catch (err) {
    return respond({ error: err instanceof Error ? err.message : "Có lỗi xảy ra" }, 429);
  }
  if (!account) return respond({ error: "Email hoặc mật khẩu không đúng." }, 401);

  if (!isLoginOtpEnabled()) return respond({ otpRequired: false });

  const deviceHash = hashDeviceId(deviceId);
  if (await isDeviceTrusted(type, account.id, deviceHash)) return respond({ otpRequired: false });

  try {
    const { sent, retryAfterSec } = await issueLoginOtp(type, account, deviceHash);
    return respond({ otpRequired: true, sent, retryAfterSec, maskedEmail: maskEmail(account.email) });
  } catch (err) {
    console.error("[login-otp] gửi mã thất bại:", err);
    return respond({ error: "Không gửi được mã xác minh về email. Vui lòng thử lại sau." }, 502);
  }
}
