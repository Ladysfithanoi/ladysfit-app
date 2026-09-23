/**
 * Email là DANH TÍNH ĐĂNG NHẬP, mà danh tính thì không được phụ thuộc vào việc
 * lúc gõ có bật Shift hay không: "Hoa@ladysfit.vn" và "hoa@ladysfit.vn" là
 * cùng một người.
 *
 * Nên mọi email đi vào cơ sở dữ liệu đều qua đúng cái phễu này — cắt khoảng
 * trắng thừa rồi hạ hết về chữ thường — và lúc đăng nhập cũng hạ y hệt, để hai
 * đầu luôn gặp nhau. Viết một lần ở đây thay vì rải `.toLowerCase()` khắp nơi:
 * sót một chỗ GHI là lại đẻ ra một tài khoản không đăng nhập được.
 *
 * Tài khoản cũ đã lỡ lưu chữ hoa vẫn vào được: chỗ xác thực có thêm bước dò
 * lại không phân biệt hoa thường (lib/auth.ts, lib/client-auth.ts).
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
