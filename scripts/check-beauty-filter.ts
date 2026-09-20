/**
 * Kiểm tra bộ làm đẹp ảnh check-out (lib/beauty-filter) mà không cần trình duyệt.
 *
 * Dựng một "khuôn mặt" giả có nhiễu da và một nét tối sắc (lông mày), chạy bộ
 * lọc rồi soát bốn điều phải đúng: da mịn đi, nét vẫn còn, ảnh sáng lên, má hồng
 * hơn. Chạy lại mỗi khi chỉnh các hằng số trong bộ lọc:
 *
 *   npx ts-node --compiler-options '{"module":"CommonJS","lib":["ES2020","DOM"]}' scripts/check-beauty-filter.ts
 */
import { applyBeauty, DEFAULT_BEAUTY } from "../lib/beauty-filter";

const W = 240, H = 320;

// Ảnh giả: nền xám, một "khuôn mặt" màu da có nhiễu, kèm một nét tối sắc (lông mày).
function makeImage() {
  const d = new Uint8ClampedArray(W * H * 4);
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 1000) / 1000; };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4;
      const inFace = ((x - 120) ** 2) / (70 ** 2) + ((y - 150) ** 2) / (95 ** 2) < 1;
      if (inFace) {
        const n = (rnd() - 0.5) * 30;          // nhiễu da
        d[p] = 208 + n; d[p + 1] = 162 + n; d[p + 2] = 142 + n;
      } else {
        d[p] = 120; d[p + 1] = 122; d[p + 2] = 125;
      }
      // lông mày: nét tối sắc trong vùng mặt
      if (y >= 118 && y <= 124 && x >= 85 && x <= 115) { d[p] = 45; d[p + 1] = 35; d[p + 2] = 30; }
      d[p + 3] = 255;
    }
  }
  return d;
}

function fakeCtx(data: Uint8ClampedArray) {
  return {
    getImageData: () => ({ data, width: W, height: H }),
    putImageData: () => {},
  } as unknown as CanvasRenderingContext2D;
}

// 468 điểm mốc giả, toạ độ chuẩn hoá, dựng quanh hình elip "khuôn mặt" ở trên.
function fakeLandmarks() {
  const lm: { x: number; y: number }[] = [];
  for (let i = 0; i < 468; i++) {
    const a = (i / 468) * Math.PI * 2;
    lm.push({ x: (120 + Math.cos(a) * 68) / W, y: (150 + Math.sin(a) * 92) / H });
  }
  const set = (i: number, x: number, y: number) => { lm[i] = { x: x / W, y: y / H }; };
  set(33, 92, 132); set(263, 148, 132);        // đuôi mắt
  set(61, 104, 196); set(291, 136, 196);       // khoé miệng
  set(234, 52, 150); set(454, 188, 150);       // mép mặt
  return lm;
}

function variance(d: Uint8ClampedArray, cx: number, cy: number, r: number) {
  const vals: number[] = [];
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++)
      vals.push(d[(y * W + x) * 4]);
  const m = vals.reduce((s, v) => s + v, 0) / vals.length;
  return vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length;
}

const at = (d: Uint8ClampedArray, x: number, y: number) => {
  const p = (y * W + x) * 4;
  return { r: d[p], g: d[p + 1], b: d[p + 2] };
};

// ── Chạy ───────────────────────────────────────────────────────────────────
const before = makeImage();
const after = makeImage();
const res = applyBeauty(fakeCtx(after), W, H, fakeLandmarks(), DEFAULT_BEAUTY);

const smoothCheek = { x: 70, y: 165 };   // trong má trái, xa lông mày
const vBefore = variance(before, smoothCheek.x, smoothCheek.y, 6);
const vAfter  = variance(after,  smoothCheek.x, smoothCheek.y, 6);

const browBefore = at(before, 100, 121);
const browAfter  = at(after, 100, 121);
const skinNear   = at(after, 100, 140);
const browContrastBefore = skinNear.r - browBefore.r;
const browContrastAfter  = skinNear.r - browAfter.r;

const bgBefore = at(before, 10, 10);
const bgAfter  = at(after, 10, 10);

// Gò má trái theo công thức trong lib: 0.40*đuôi mắt + 0.35*khoé miệng + 0.25*mép mặt
const cx = Math.round(92 * 0.40 + 104 * 0.35 + 52 * 0.25);
const cy = Math.round(132 * 0.40 + 196 * 0.35 + 150 * 0.25);
const cheekBefore = at(before, cx, cy);
const cheekAfter  = at(after, cx, cy);
const rgGapBefore = cheekBefore.r - cheekBefore.g;
const rgGapAfter  = cheekAfter.r - cheekAfter.g;

console.log("facePainted          :", res.facePainted);
console.log("nhiễu da trước/sau   :", vBefore.toFixed(1), "->", vAfter.toFixed(1));
console.log("tương phản lông mày  :", browContrastBefore, "->", browContrastAfter);
console.log("nền ngoài mặt        :", bgBefore.r, "->", bgAfter.r);
console.log("gò má (", cx, cy, ") R-G:", rgGapBefore, "->", rgGapAfter);

const checks: [string, boolean][] = [
  ["tìm thấy khuôn mặt",              res.facePainted],
  ["da mịn hơn (nhiễu giảm >30%)",    vAfter < vBefore * 0.7],
  ["lông mày còn nét (>70% tương phản)", browContrastAfter > browContrastBefore * 0.7],
  ["ảnh sáng lên",                    bgAfter.r > bgBefore.r],
  ["má hồng hơn (R-G tăng)",          rgGapAfter > rgGapBefore + 3],
];
let bad = 0;
for (const [name, ok] of checks) { console.log(ok ? "  OK  " : "  LỖI", name); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
