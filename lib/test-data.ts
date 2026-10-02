/**
 * ── Dữ liệu test của "Cài đặt → Giả lập" ─────────────────────────────────────
 *
 * Cơ sở, FM, PT và khách test (lib/simulate.ts) KHÔNG được lẫn vào thống kê và
 * bảng xếp hạng. Mọi màn thống kê lọc qua các helper ở đây — một đường duy nhất.
 *
 * Ngoại lệ: người đang xem chính là tài khoản test (Admin đang giả lập FM/PT
 * test) thì vẫn thấy, để thử được các màn đó với dữ liệu test.
 *
 * File này không import prisma để component client cũng dùng được.
 */

export const TEST_BRANCH_NAME  = "🧪 Cơ sở Giả lập";
export const TEST_EMAIL_DOMAIN = "@ladysfit.test";

/** Tài khoản test nhận ra bằng đuôi email. */
export function isTestEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(TEST_EMAIL_DOMAIN);
}

/** Người xem có được thấy dữ liệu test không — chỉ khi chính họ là tài khoản test. */
export function viewerSeesTestData(viewer: { email?: string | null } | null | undefined): boolean {
  return isTestEmail(viewer?.email);
}

/** Điều kiện Prisma trên Branch: bỏ cơ sở test. Ghép bằng spread (dùng khoá NOT). */
export function excludeTestBranch(include = false) {
  return include ? {} : { NOT: { name: TEST_BRANCH_NAME } };
}

/** Điều kiện Prisma trên User: bỏ tài khoản test. Ghép bằng spread (dùng khoá NOT). */
export function excludeTestUser(include = false) {
  return include ? {} : { NOT: { email: { endsWith: TEST_EMAIL_DOMAIN } } };
}
