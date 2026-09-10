/**
 * Tạo bộ icon cài app từ logo gốc.
 *
 *   node scripts/make-icons.js
 *
 * Nguồn: public/logo-source.png (1080x1080, nền trắng).
 * Đích:  public/icons/*.png — đúng các đường dẫn khai trong app/manifest.ts.
 * Chỉ chạy lại khi đổi logo, không nằm trong quy trình build.
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "public", "logo-source.png");
const outDir = path.join(root, "public", "icons");

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

async function make(size, file, ratio) {
  const inner = Math.round(size * ratio);
  const logo = await sharp(src)
    // File gốc đã chừa sẵn lề trắng rộng; cắt sạch rồi tự canh lề theo ratio,
    // không thì icon trên màn hình chính bé tí giữa một khung trắng.
    .trim()
    .resize(inner, inner, { fit: "contain", background: WHITE })
    .toBuffer();

  await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(path.join(outDir, file));
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  await make(192, "icon-192.png", 0.9);
  await make(512, "icon-512.png", 0.9);
  // Maskable: Android bo góc/cắt tròn, vùng an toàn chỉ 80% giữa khung.
  await make(512, "maskable-512.png", 0.56);
  await make(180, "apple-touch-icon.png", 0.9);
  console.log("Đã tạo:", fs.readdirSync(outDir).join(", "));
})();
