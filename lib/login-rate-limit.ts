// ─── In-memory login rate limiter ────────────────────────────────────────────
// Tracks failed attempts per IP. Resets after 15 minutes.
// Note: single-instance only. Use Redis/Upstash for multi-instance deployments.
// Dùng chung cho cả đăng nhập nhân sự, khách và bước xin mã xác minh thiết bị.

const loginFailures = new Map<string, { count: number; windowStart: number }>();
const MAX_FAILURES  = 5;
const WINDOW_MS     = 15 * 60 * 1000; // 15 minutes

export const RATE_LIMIT_MESSAGE = "Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.";

type HeaderBag = Record<string, string | string[] | undefined> | Headers;

function readHeader(headers: HeaderBag | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  if (typeof (headers as Headers).get === "function") return (headers as Headers).get(name) ?? undefined;
  const v = (headers as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(v) ? v[0] : v;
}

export function getRequestHeader(req: unknown, name: string): string | undefined {
  if (!req || typeof req !== "object") return undefined;
  return readHeader((req as { headers?: HeaderBag }).headers, name);
}

export function getClientIp(req: unknown): string {
  const forwarded = getRequestHeader(req, "x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}

export function isRateLimited(ip: string): boolean {
  const entry = loginFailures.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.windowStart > WINDOW_MS) {
    loginFailures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordFailure(ip: string): void {
  const now   = Date.now();
  const entry = loginFailures.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    loginFailures.set(ip, { count: 1, windowStart: now });
  } else {
    entry.count++;
  }
}

export function clearFailures(ip: string): void {
  loginFailures.delete(ip);
}
