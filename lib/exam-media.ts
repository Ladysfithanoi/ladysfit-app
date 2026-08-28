/**
 * Ảnh và video minh hoạ cho câu hỏi kiểm tra.
 *
 * Một câu hỏi có thể chỉ có chữ, hoặc kèm ảnh, hoặc kèm video, hoặc cả ba —
 * dùng để mô tả tư thế/động tác mà chữ nghĩa khó diễn đạt.
 *
 * Video nhận link YouTube ở mọi dạng người dùng hay copy (watch, youtu.be,
 * shorts, live, embed) rồi quy về một dạng nhúng duy nhất. Link không phải
 * YouTube vẫn lưu được nhưng hiển thị thành nút mở tab mới thay vì nhúng —
 * thà mở được còn hơn chặn người dùng vì sai định dạng.
 */

/** Chuỗi rỗng/space coi như không nhập. */
export function normalizeMediaUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  return s === "" ? null : s;
}

/** Chỉ nhận http(s) — chặn javascript:, data: và các scheme lạ khác. */
export function isSafeMediaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/** Mã video YouTube 11 ký tự. */
function isVideoId(s: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(s);
}

/** Giây bắt đầu từ tham số t/start ("90", "1m30s", "2h1m"). */
function startSeconds(u: URL): number | null {
  const raw = u.searchParams.get("t") ?? u.searchParams.get("start");
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0));
}

/**
 * Link YouTube → link nhúng. Trả null nếu không phải YouTube (hoặc không đọc
 * được mã video) — chỗ gọi tự quyết định hiển thị kiểu khác.
 */
export function youtubeEmbedUrl(raw: string | null | undefined): string | null {
  const url = normalizeMediaUrl(raw);
  if (!url || !isSafeMediaUrl(url)) return null;

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }

  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);
  let id: string | null = null;

  if (host === "youtu.be" || host === "www.youtu.be") {
    id = parts[0] ?? null;
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (parts[0] === "watch") id = u.searchParams.get("v");
    else if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") id = parts[1] ?? null;
    else if (!parts.length) id = u.searchParams.get("v");
  }

  if (!id || !isVideoId(id)) return null;

  const start = startSeconds(u);
  return `https://www.youtube.com/embed/${id}${start ? `?start=${start}` : ""}`;
}

/** Có phải link YouTube nhúng được không — dùng để báo lỗi ngay trên form. */
export function isYoutubeUrl(raw: string | null | undefined): boolean {
  return youtubeEmbedUrl(raw) !== null;
}

/**
 * Đọc phần ảnh/video từ body của API câu hỏi. Bỏ trống → null (đó cũng là cách
 * gỡ ảnh/video khỏi một câu hỏi đã có). Chỉ nhận http(s) để không có
 * javascript:/data: nào lọt vào thẻ img hay iframe của trang làm bài.
 */
export function parseQuestionMedia(body: { imageUrl?: unknown; videoUrl?: unknown }):
  | { ok: true; imageUrl: string | null; videoUrl: string | null }
  | { ok: false; error: string } {
  const imageUrl = normalizeMediaUrl(typeof body.imageUrl === "string" ? body.imageUrl : null);
  const videoUrl = normalizeMediaUrl(typeof body.videoUrl === "string" ? body.videoUrl : null);

  if (imageUrl && !isSafeMediaUrl(imageUrl)) {
    return { ok: false, error: "Link ảnh không hợp lệ (phải bắt đầu bằng http:// hoặc https://)" };
  }
  if (videoUrl && !isSafeMediaUrl(videoUrl)) {
    return { ok: false, error: "Link video không hợp lệ (phải bắt đầu bằng http:// hoặc https://)" };
  }
  return { ok: true, imageUrl, videoUrl };
}
