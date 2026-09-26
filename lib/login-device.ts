import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/normalize-email";
import { isMailerConfigured, sendMail } from "@/lib/mailer";
import {
  RATE_LIMIT_MESSAGE,
  clearFailures,
  getClientIp,
  getRequestHeader,
  isRateLimited,
  recordFailure,
} from "@/lib/login-rate-limit";

/**
 * XÁC MINH THIẾT BỊ KHI ĐĂNG NHẬP — một đường duy nhất cho cả nhân sự
 * (Admin/FM/PT/STAFF, bảng users) lẫn khách (bảng clients).
 *
 *  1. Mỗi trình duyệt được cấp cookie ngẫu nhiên DEVICE_COOKIE ("id máy").
 *  2. Đúng mật khẩu nhưng máy chưa có trong trusted_devices → gửi mã 6 số về
 *     email của tài khoản; nhập đúng mã thì máy được tin cậy, lần sau khỏi hỏi.
 *  3. Mỗi phiên (JWT) mang `did` = id dòng trusted_devices. Dòng đó bị xoá
 *     (đổi mật khẩu, "đăng xuất thiết bị khác") → phiên trên máy đó chết ngay.
 *
 * Chỉ bật khi LOGIN_OTP_ENABLED=true VÀ đã cấu hình SMTP — thiếu mail mà vẫn bật
 * thì cả hệ thống khoá cửa. Lúc vừa bật, mọi phiên cũ (chưa có `did`) bị buộc
 * đăng nhập lại một lần để xác minh máy.
 */

export type AccountType = "STAFF" | "CLIENT";

export const DEVICE_COOKIE = "lf-did";
const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 60 * 60; // mức trần trình duyệt cho phép
const OTP_TTL_MS         = 10 * 60 * 1000;
const OTP_RESEND_MS      = 60 * 1000;
const OTP_MAX_ATTEMPTS   = 5;

export const OTP_INVALID_MESSAGE = "Mã xác minh không đúng hoặc đã hết hạn.";
export const DEVICE_MISSING_MESSAGE = "Trình duyệt chưa được cấp mã thiết bị. Vui lòng tải lại trang và thử lại.";

export function isLoginOtpEnabled(): boolean {
  return process.env.LOGIN_OTP_ENABLED === "true" && isMailerConfigured();
}

// ─── Cookie id máy ───────────────────────────────────────────────────────────

export function newDeviceId(): string {
  return randomBytes(32).toString("base64url");
}

export function deviceCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure:   process.env.NODE_ENV === "production",
    path:     "/",
    maxAge:   DEVICE_COOKIE_MAX_AGE,
  };
}

export function readDeviceIdFromCookieHeader(cookieHeader: string | undefined | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === DEVICE_COOKIE) {
      const val = decodeURIComponent(v.join("="));
      return val.length >= 20 ? val : null;
    }
  }
  return null;
}

export function hashDeviceId(deviceId: string): string {
  return createHash("sha256").update(deviceId).digest("hex");
}

// ─── Tài khoản & mật khẩu ────────────────────────────────────────────────────

export interface LoginAccount {
  id:           string;
  email:        string;
  name:         string | null;
  passwordHash: string | null;
  role?:        Role;
  branchId?:    string | null;
}

async function findLoginAccount(type: AccountType, rawEmail: string): Promise<LoginAccount | null> {
  const email = normalizeEmail(rawEmail);

  // Khớp thẳng trước; không thấy thì dò lại không phân biệt hoa thường, để tài
  // khoản cũ lỡ lưu chữ hoa vẫn đăng nhập được.
  if (type === "STAFF") {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
      });
    }
    if (!user) return null;
    return {
      id: user.id, email: user.email, name: user.name, passwordHash: user.password,
      role: user.role, branchId: user.branchId,
    };
  }

  let client = await prisma.client.findUnique({ where: { email } });
  if (!client) {
    client = await prisma.client.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  }
  if (!client?.email) return null;
  return { id: client.id, email: client.email, name: client.fullName, passwordHash: client.password };
}

/** Kiểm mật khẩu có giới hạn số lần sai theo IP. Sai → null; bị chặn → throw. */
export async function verifyLoginPassword(
  type: AccountType,
  email: string | undefined,
  password: string | undefined,
  req: unknown,
): Promise<LoginAccount | null> {
  if (!email || !password) return null;
  const ip = getClientIp(req);
  if (isRateLimited(ip)) throw new Error(RATE_LIMIT_MESSAGE);

  const account = await findLoginAccount(type, email);
  if (!account?.passwordHash || !(await bcrypt.compare(password, account.passwordHash))) {
    recordFailure(ip);
    return null;
  }
  clearFailures(ip);
  return account;
}

// ─── Thiết bị tin cậy ────────────────────────────────────────────────────────

function findTrustedDevice(type: AccountType, accountId: string, deviceHash: string) {
  return prisma.trustedDevice.findUnique({
    where: { accountType_accountId_deviceHash: { accountType: type, accountId, deviceHash } },
  });
}

export async function isDeviceTrusted(type: AccountType, accountId: string, deviceHash: string) {
  return !!(await findTrustedDevice(type, accountId, deviceHash));
}

/** Xoá thiết bị tin cậy của một tài khoản (trừ `exceptId` nếu có) → các phiên đó bị đăng xuất. */
export async function revokeTrustedDevices(type: AccountType, accountId: string, exceptId?: string | null) {
  await prisma.trustedDevice.deleteMany({
    where: { accountType: type, accountId, ...(exceptId ? { id: { not: exceptId } } : {}) },
  });
}

// ─── Mã xác minh ─────────────────────────────────────────────────────────────

function hashOtp(code: string, accountId: string, deviceHash: string): string {
  return createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "ladysfit-login-otp")
    .update(`${code}:${accountId}:${deviceHash}`)
    .digest("hex");
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const shown = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${shown}${"*".repeat(Math.max(local.length - shown.length, 3))}@${domain}`;
}

/**
 * Gửi mã về email tài khoản cho cặp (tài khoản, máy). Vừa gửi trong 60 giây thì
 * không gửi lại — mã cũ vẫn dùng được.
 */
export async function issueLoginOtp(
  type: AccountType,
  account: LoginAccount,
  deviceHash: string,
): Promise<{ sent: boolean; retryAfterSec: number }> {
  const now = Date.now();
  const latest = await prisma.loginOtp.findFirst({
    where:   { accountType: type, accountId: account.id, deviceHash },
    orderBy: { createdAt: "desc" },
  });
  if (latest && now - latest.createdAt.getTime() < OTP_RESEND_MS && latest.expiresAt.getTime() > now) {
    return { sent: false, retryAfterSec: Math.ceil((OTP_RESEND_MS - (now - latest.createdAt.getTime())) / 1000) };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.$transaction([
    prisma.loginOtp.deleteMany({
      where: {
        OR: [
          { accountType: type, accountId: account.id, deviceHash },
          { expiresAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } },
        ],
      },
    }),
    prisma.loginOtp.create({
      data: {
        accountType: type,
        accountId:   account.id,
        deviceHash,
        codeHash:    hashOtp(code, account.id, deviceHash),
        expiresAt:   new Date(now + OTP_TTL_MS),
      },
    }),
  ]);

  const who = account.name ? ` ${account.name}` : "";
  await sendMail({
    to:      account.email,
    subject: `Mã đăng nhập Ladysfit: ${code}`,
    text:
      `Xin chào${who},\n\n` +
      `Mã xác minh đăng nhập trên thiết bị mới của bạn là: ${code}\n` +
      `Mã có hiệu lực trong 10 phút.\n\n` +
      `Nếu không phải bạn đang đăng nhập, đừng chia sẻ mã này với ai và hãy đổi mật khẩu ngay.\n\n` +
      `Ladysfit`,
    html:
      `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;color:#333">` +
      `<p>Xin chào${who},</p>` +
      `<p>Mã xác minh đăng nhập trên <b>thiết bị mới</b> của bạn là:</p>` +
      `<p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#f15b5c;text-align:center">${code}</p>` +
      `<p>Mã có hiệu lực trong 10 phút.</p>` +
      `<p style="color:#888;font-size:13px">Nếu không phải bạn đang đăng nhập, đừng chia sẻ mã này với ai và hãy đổi mật khẩu ngay.</p>` +
      `<p>Ladysfit</p></div>`,
  });

  return { sent: true, retryAfterSec: Math.ceil(OTP_RESEND_MS / 1000) };
}

async function consumeLoginOtp(type: AccountType, accountId: string, deviceHash: string, code: string) {
  const otp = await prisma.loginOtp.findFirst({
    where:   { accountType: type, accountId, deviceHash, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) return false;

  const expected = Buffer.from(otp.codeHash, "hex");
  const actual   = Buffer.from(hashOtp(code.trim(), accountId, deviceHash), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    await prisma.loginOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  await prisma.loginOtp.deleteMany({ where: { accountType: type, accountId, deviceHash } });
  return true;
}

// ─── Hai điểm gắn vào NextAuth ───────────────────────────────────────────────

/**
 * Dùng trong `authorize()` của cả hai cổng. Trả về tài khoản + `did` (id máy tin
 * cậy) để nhét vào JWT; máy lạ mà thiếu/sai mã thì throw với thông báo đọc được.
 */
export async function authorizeLogin(
  type: AccountType,
  credentials: Record<string, string> | undefined,
  req: unknown,
): Promise<{ account: LoginAccount; did?: string } | null> {
  const account = await verifyLoginPassword(type, credentials?.email, credentials?.password, req);
  if (!account) return null;
  if (!isLoginOtpEnabled()) return { account };

  const deviceId = readDeviceIdFromCookieHeader(getRequestHeader(req, "cookie"));
  if (!deviceId) throw new Error(DEVICE_MISSING_MESSAGE);
  const deviceHash = hashDeviceId(deviceId);
  const meta = {
    userAgent: getRequestHeader(req, "user-agent")?.slice(0, 300) ?? null,
    ip:        getClientIp(req),
  };

  const trusted = await findTrustedDevice(type, account.id, deviceHash);
  if (trusted) {
    await prisma.trustedDevice.update({
      where: { id: trusted.id },
      data:  { lastSeenAt: new Date(), ...meta },
    });
    return { account, did: trusted.id };
  }

  const otp = credentials?.otp;
  if (!otp || !(await consumeLoginOtp(type, account.id, deviceHash, otp))) {
    throw new Error(OTP_INVALID_MESSAGE);
  }
  const device = await prisma.trustedDevice.upsert({
    where:  { accountType_accountId_deviceHash: { accountType: type, accountId: account.id, deviceHash } },
    create: { accountType: type, accountId: account.id, deviceHash, ...meta },
    update: { lastSeenAt: new Date(), ...meta },
  });
  return { account, did: device.id };
}

/**
 * Dùng trong callback `jwt()`: phiên phải trỏ tới một máy còn được tin cậy của
 * đúng tài khoản đó. Throw → NextAuth xoá phiên (getServerSession trả null).
 */
export async function assertSessionDevice(type: AccountType, token: { sub?: string; did?: string }) {
  if (!isLoginOtpEnabled()) return;
  if (!token.sub || !token.did) throw new Error("Phiên đăng nhập chưa xác minh thiết bị");
  const device = await prisma.trustedDevice.findUnique({
    where:  { id: token.did },
    select: { accountType: true, accountId: true },
  });
  if (!device || device.accountType !== type || device.accountId !== token.sub) {
    throw new Error("Thiết bị đã bị đăng xuất");
  }
}

// ─── Danh sách máy cho màn "Thiết bị đang đăng nhập" ─────────────────────────

/** Xử lý GET/DELETE chung cho /api/my/devices (khách) và /api/staff/me/devices (nhân sự). */
export async function handleDevicesRequest(
  req: Request,
  type: AccountType,
  accountId: string,
  currentDeviceId: string | undefined,
): Promise<Response> {
  if (req.method === "DELETE") {
    let body: { id?: unknown; others?: unknown } = {};
    try { body = await req.json(); } catch { /* body rỗng */ }
    if (body.others === true) {
      await revokeTrustedDevices(type, accountId, currentDeviceId ?? null);
    } else if (typeof body.id === "string" && body.id !== currentDeviceId) {
      await prisma.trustedDevice.deleteMany({ where: { id: body.id, accountType: type, accountId } });
    } else {
      return Response.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
    }
    return Response.json({ success: true });
  }

  const devices = await prisma.trustedDevice.findMany({
    where:   { accountType: type, accountId },
    orderBy: { lastSeenAt: "desc" },
    select:  { id: true, userAgent: true, ip: true, createdAt: true, lastSeenAt: true },
  });
  return Response.json({
    enabled: isLoginOtpEnabled(),
    devices: devices.map((d) => ({ ...d, current: d.id === currentDeviceId })),
  });
}
