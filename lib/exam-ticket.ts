import crypto from "crypto";

/**
 * Vé thi — chốt hạn nộp bài của MỘT lượt làm bài.
 *
 * "Thời lượng thi" phải được canh ở server, nếu không thì đồng hồ chỉ là trang
 * trí: sửa giờ máy hoặc chặn cái setInterval là ngồi làm bao lâu cũng được. Khi
 * mở đề, server tính mốc hết giờ rồi ký nó bằng NEXTAUTH_SECRET và giao cho máy
 * người thi giữ. Lúc nộp, bài phải kèm đúng tấm vé đó; server mở chữ ký ra kiểm
 * lại hạn — người thi không sửa được mốc vì không ký lại được.
 *
 * Vé gắn với từng người (userId) nên không mượn vé của nhau, và gắn với loại
 * bài (thi thật / thi thử) nên không lấy vé thi thử đi nộp bài thi thật.
 *
 * Vé KHÔNG chống được việc tải lại trang để lấy đề mới — nhưng tải lại vốn đã
 * bốc một đề khác và hệ thống không giới hạn số lần thi, nên đó là chuyện của
 * quy chế thi chứ không phải của tấm vé này.
 */

export type ExamTicket = {
  /** Người được cấp vé. */
  u: string;
  /** Mốc hết giờ, epoch ms. */
  e: number;
  /** true = vé của bài thi thử. */
  m: boolean;
};

/** Trễ mạng + thời gian gửi bài tự động khi hết giờ. */
export const TICKET_GRACE_MS = 60 * 1000;

function secret(): string {
  return process.env.NEXTAUTH_SECRET ?? "";
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sign(payload: string): string {
  return b64url(crypto.createHmac("sha256", secret()).update(payload).digest());
}

export function signExamTicket(ticket: ExamTicket): string {
  const payload = b64url(Buffer.from(JSON.stringify(ticket), "utf8"));
  return `${payload}.${sign(payload)}`;
}

export type TicketCheck =
  | { ok: true; ticket: ExamTicket }
  | { ok: false; error: string };

export function verifyExamTicket(
  token: unknown,
  opts: { userId: string; mock: boolean; now?: Date }
): TicketCheck {
  if (typeof token !== "string" || !token.includes(".")) {
    return { ok: false, error: "Phiếu làm bài không hợp lệ. Vui lòng mở lại đề thi." };
  }

  const [payload, signature] = token.split(".");
  const expected = sign(payload);
  // So sánh theo kiểu chống dò thời gian; độ dài lệch thì timingSafeEqual ném lỗi.
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return { ok: false, error: "Phiếu làm bài không hợp lệ. Vui lòng mở lại đề thi." };
  }

  let ticket: ExamTicket;
  try {
    ticket = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  } catch {
    return { ok: false, error: "Phiếu làm bài không hợp lệ. Vui lòng mở lại đề thi." };
  }

  if (ticket.u !== opts.userId || ticket.m !== opts.mock) {
    return { ok: false, error: "Phiếu làm bài không đúng của bài thi này." };
  }

  const now = (opts.now ?? new Date()).getTime();
  if (now > ticket.e + TICKET_GRACE_MS) {
    return { ok: false, error: "Đã hết thời lượng làm bài, không nộp được nữa." };
  }

  return { ok: true, ticket };
}
