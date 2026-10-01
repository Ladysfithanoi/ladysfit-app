// Xoá ảnh đã tải lên qua /api/upload (bucket "avatars" của Supabase).
//
// Chỉ đụng vào URL nằm trong đúng bucket của mình — ảnh dán link ngoài hay
// base64 thì bỏ qua. Lỗi khi xoá không được làm hỏng thao tác của người dùng:
// tệ nhất là sót một file mồ côi trong storage.

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BUCKET       = "avatars";

export async function deleteUploadedImage(url: string | null | undefined): Promise<void> {
  if (!url || !SUPABASE_URL || !SERVICE_KEY) return;
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  if (!url.startsWith(prefix)) return;
  const name = url.slice(prefix.length);
  if (!name || name.includes("/")) return;
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${name}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${SERVICE_KEY}` },
    });
  } catch (e) {
    console.error("[storage] delete failed:", e);
  }
}
