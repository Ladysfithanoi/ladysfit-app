import nodemailer, { type Transporter } from "nodemailer";

/**
 * Gửi email qua SMTP. Mặc định là Gmail: đặt SMTP_USER = địa chỉ Gmail gửi đi,
 * SMTP_PASS = "Mật khẩu ứng dụng" 16 ký tự (Google Account → Bảo mật → Xác minh
 * 2 bước → Mật khẩu ứng dụng), KHÔNG phải mật khẩu Gmail thường.
 * Dùng máy chủ khác thì đặt thêm SMTP_HOST / SMTP_PORT. MAIL_FROM tuỳ chọn.
 */

let transporter: Transporter | null = null;

export function isMailerConfigured(): boolean {
  return !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
}

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendMail(opts: { to: string; subject: string; text: string; html?: string }) {
  if (!isMailerConfigured()) throw new Error("Chưa cấu hình máy chủ gửi email (SMTP_USER / SMTP_PASS)");
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || `Ladysfit <${process.env.SMTP_USER}>`,
    ...opts,
  });
}
