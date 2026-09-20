// ── Bộ làm đẹp cho ảnh check-out ────────────────────────────────────────────
//
// Bốn hiệu ứng, cố ý dừng ở đây và không đi xa hơn:
//   • Chỉnh sáng   — kéo sáng vùng tối, cân màu. Áp cho cả ảnh.
//   • Làm mịn da   — làm mượt vùng da nhưng GIỮ viền (mắt, lông mày, cánh mũi,
//                    viền môi). Chỉ chạy trong khung khuôn mặt.
//   • Đánh má      — hai đốm hồng mờ ở gò má.
//   • Hồng môi     — tô đậm sắc môi trong đúng viền môi.
//
// KHÔNG nắn hình: không thon cằm, không to mắt, không kéo mũi. Ảnh check-out là
// bằng chứng buổi tập có thật, nên khuôn mặt phải còn nhận ra được. Trang điểm
// đắp lên vùng có sẵn thì không đụng tới hình dạng; nắn hình thì có.
//
// Hàm applyBeauty() dùng CHUNG cho màn xem trước (ảnh nhỏ, chạy liên tục) và
// cho ảnh lưu lại (ảnh to, chạy một lần). Một đoạn code, hai độ phân giải — nếu
// tách làm hai thì cái PT nhìn thấy và cái được lưu sẽ khác nhau.
//
// Mọi thứ ở đây chạy trên typed array thuần, không đụng WebGL: máy yếu vẫn chạy
// được, chỉ là chậm hơn — và bên gọi có đường tự hạ cấp khi quá chậm.

/** Điểm mốc khuôn mặt, toạ độ đã chuẩn hoá 0..1 nên không phụ thuộc kích thước ảnh. */
export type FaceLandmarks = { x: number; y: number }[];

export type BeautyOptions = {
  /** Làm mịn da 0..1 */
  smooth: number;
  /** Chỉnh sáng 0..1 */
  brighten: number;
  /** Đánh má 0..1 */
  blush: number;
  /** Hồng môi 0..1 */
  lips: number;
};

/**
 * Mức mặc định — cố tình để nhẹ tay. Mịn quá thì mất chi tiết khuôn mặt, mà đây
 * là ảnh để đối chiếu đúng người.
 */
export const DEFAULT_BEAUTY: BeautyOptions = {
  smooth:   0.55,
  brighten: 0.45,
  blush:    0.40,
  lips:     0.40,
};

// ── Chỉ số điểm mốc của MediaPipe Face Mesh (468 điểm) ──────────────────────

const EYE_OUTER_L = 33;
const EYE_OUTER_R = 263;
const MOUTH_L     = 61;
const MOUTH_R     = 291;
const FACE_L      = 234;
const FACE_R      = 454;

/** Viền ngoài của môi, đi vòng kín. */
const LIPS_OUTER = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375,
  291, 409, 270, 269, 267, 0, 37, 39, 40, 185,
];
/** Viền trong (khe miệng) — trừ ra khỏi vùng tô để không tô vào răng. */
const LIPS_INNER = [
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324,
  308, 415, 310, 311, 312, 13, 82, 81, 80, 191,
];

// ── Bộ đệm dùng lại giữa các khung hình ─────────────────────────────────────
// Màn xem trước chạy ~30 lần/giây; cấp phát mảng mới mỗi lần thì bộ dọn rác
// chạy liên tục và khung hình giật từng nhịp.

type Scratch = {
  w: number; h: number;
  tmp: Uint8ClampedArray;
  blur: Uint8ClampedArray;
  skin: Uint8Array;
  maskCanvas: HTMLCanvasElement | null;
};

let scratch: Scratch | null = null;

function getScratch(w: number, h: number): Scratch {
  if (scratch && scratch.w === w && scratch.h === h) return scratch;
  scratch = {
    w, h,
    tmp:  new Uint8ClampedArray(w * h * 4),
    blur: new Uint8ClampedArray(w * h * 4),
    skin: new Uint8Array(w * h),
    maskCanvas: null,
  };
  return scratch;
}

/** Dọn bộ đệm khi đóng màn chụp — ảnh 900px giữ lại vài MB không cần thiết. */
export function releaseBeautyBuffers(): void {
  scratch = null;
}

/** Vùng chữ nhật tính bằng pixel, đã cắt vào trong ảnh. */
type Rect = { x0: number; y0: number; x1: number; y1: number };

function clampRect(box: Rect, w: number, h: number): Rect {
  return {
    x0: Math.max(0, Math.floor(box.x0)),
    y0: Math.max(0, Math.floor(box.y0)),
    x1: Math.min(w - 1, Math.ceil(box.x1)),
    y1: Math.min(h - 1, Math.ceil(box.y1)),
  };
}

// ── Làm mờ hộp bằng tổng chạy ───────────────────────────────────────────────
//
// Chi phí không phụ thuộc bán kính: mỗi pixel chỉ cộng một, trừ một.
//
// CHỈ chạy trong `reg` — khung khuôn mặt. Mặt nạ da vốn đã bằng 0 ở ngoài khung
// nên làm mờ cả ảnh là ném đi phần lớn công sức; khuôn mặt thường chỉ chiếm
// một phần ba khung hình, và đây là phép tốn nhất trong cả bộ lọc.
function boxBlur(
  src: Uint8ClampedArray, tmp: Uint8ClampedArray, dst: Uint8ClampedArray,
  w: number, h: number, r: number, reg: Rect,
): void {
  const win = r * 2 + 1;

  // Ngang: src → tmp. Phải trải rộng thêm r hàng trên/dưới vì lượt dọc bên dưới
  // sẽ đọc tới đó.
  const hy0 = Math.max(0, reg.y0 - r);
  const hy1 = Math.min(h - 1, reg.y1 + r);

  for (let y = hy0; y <= hy1; y++) {
    const row = y * w * 4;
    let sR = 0, sG = 0, sB = 0;
    for (let i = reg.x0 - r; i <= reg.x0 + r; i++) {
      const x = i < 0 ? 0 : i >= w ? w - 1 : i;
      const p = row + x * 4;
      sR += src[p]; sG += src[p + 1]; sB += src[p + 2];
    }
    for (let x = reg.x0; x <= reg.x1; x++) {
      const p = row + x * 4;
      tmp[p] = sR / win; tmp[p + 1] = sG / win; tmp[p + 2] = sB / win; tmp[p + 3] = 255;
      const ox = x - r < 0 ? 0 : x - r;
      const ix = x + r + 1 >= w ? w - 1 : x + r + 1;
      const po = row + ox * 4, pi = row + ix * 4;
      sR += src[pi] - src[po];
      sG += src[pi + 1] - src[po + 1];
      sB += src[pi + 2] - src[po + 2];
    }
  }

  // Dọc: tmp → dst
  for (let x = reg.x0; x <= reg.x1; x++) {
    const col = x * 4;
    let sR = 0, sG = 0, sB = 0;
    for (let i = reg.y0 - r; i <= reg.y0 + r; i++) {
      const y = i < hy0 ? hy0 : i > hy1 ? hy1 : i;
      const p = y * w * 4 + col;
      sR += tmp[p]; sG += tmp[p + 1]; sB += tmp[p + 2];
    }
    for (let y = reg.y0; y <= reg.y1; y++) {
      const p = y * w * 4 + col;
      dst[p] = sR / win; dst[p + 1] = sG / win; dst[p + 2] = sB / win; dst[p + 3] = 255;
      const oy = y - r < hy0 ? hy0 : y - r;
      const iy = y + r + 1 > hy1 ? hy1 : y + r + 1;
      const po = oy * w * 4 + col, pi = iy * w * 4 + col;
      sR += tmp[pi] - tmp[po];
      sG += tmp[pi + 1] - tmp[po + 1];
      sB += tmp[pi + 2] - tmp[po + 2];
    }
  }
}

// ── Mặt nạ da ───────────────────────────────────────────────────────────────

/**
 * Độ "giống da" của từng pixel, 0..255, CHỈ trong khung khuôn mặt.
 *
 * Dò da bằng dải màu YCbCr là cách kinh điển nhưng hay bắt nhầm: sàn gỗ, tường
 * be, tạ bọc da nâu đều lọt vào dải đó. Trong phòng tập thì nhầm rất nhiều, nên
 * mặt nạ này bị giam trong khung khuôn mặt do điểm mốc cho — ngoài khung là 0.
 */
function buildSkinMask(
  data: Uint8ClampedArray, skin: Uint8Array, w: number, h: number, reg: Rect,
): void {
  skin.fill(0);

  const { x0, x1, y0, y1 } = reg;

  // Mép khung được vuốt mềm, nếu không thì chỗ hết làm mịn hiện thành một đường
  // vuông sắc lẹm trên má.
  const featherX = Math.max(1, (x1 - x0) * 0.12);
  const featherY = Math.max(1, (y1 - y0) * 0.12);

  for (let y = y0; y <= y1; y++) {
    const edgeY = Math.min(y - y0, y1 - y) / featherY;
    const fy = edgeY >= 1 ? 1 : edgeY;
    for (let x = x0; x <= x1; x++) {
      const edgeX = Math.min(x - x0, x1 - x) / featherX;
      const fx = edgeX >= 1 ? 1 : edgeX;

      const p = (y * w + x) * 4;
      const R = data[p], G = data[p + 1], B = data[p + 2];

      const Y  = 0.299 * R + 0.587 * G + 0.114 * B;
      const Cb = 128 - 0.168736 * R - 0.331264 * G + 0.5 * B;
      const Cr = 128 + 0.5 * R - 0.418688 * G - 0.081312 * B;

      // Quá tối thì thông tin màu không còn đáng tin (tóc, bóng đổ).
      if (Y < 45) continue;
      if (Cb < 77 || Cb > 136) continue;
      if (Cr < 130 || Cr > 178) continue;

      // Càng gần tâm dải càng chắc là da → vuốt mềm theo khoảng cách tới tâm.
      const dCb = Math.abs(Cb - 108) / 31;
      const dCr = Math.abs(Cr - 152) / 26;
      const conf = Math.max(0, 1 - Math.max(dCb, dCr));

      skin[y * w + x] = Math.round(255 * conf * fx * fy);
    }
  }
}

// ── Hình học khuôn mặt ──────────────────────────────────────────────────────

type FaceGeom = {
  box: Rect;
  cheekL: { x: number; y: number; r: number };
  cheekR: { x: number; y: number; r: number };
  faceW: number;
};

function faceGeometry(lm: FaceLandmarks, w: number, h: number): FaceGeom | null {
  if (lm.length < 468) return null;

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of lm) {
    const px = p.x * w, py = p.y * h;
    if (px < x0) x0 = px;
    if (py < y0) y0 = py;
    if (px > x1) x1 = px;
    if (py > y1) y1 = py;
  }
  if (!isFinite(x0) || x1 <= x0 || y1 <= y0) return null;

  const at = (i: number) => ({ x: lm[i].x * w, y: lm[i].y * h });
  const faceW = Math.abs(at(FACE_R).x - at(FACE_L).x);
  if (faceW <= 1) return null;

  /**
   * Gò má không có một điểm mốc riêng đáng tin, nên dựng nó từ ba mốc chắc chắn:
   * đuôi mắt, khoé miệng và mép mặt cùng bên. Trọng số nghiêng về đuôi mắt vì
   * "táo má" nằm ngay dưới đó.
   */
  const cheekOf = (eye: number, mouth: number, edge: number) => {
    const e = at(eye), m = at(mouth), s = at(edge);
    return {
      x: e.x * 0.40 + m.x * 0.35 + s.x * 0.25,
      y: e.y * 0.40 + m.y * 0.35 + s.y * 0.25,
      r: faceW * 0.17,
    };
  };

  return {
    box: {
      // Nới khung ra một chút để cằm và trán cũng được làm mịn.
      x0: x0 - faceW * 0.05, x1: x1 + faceW * 0.05,
      y0: y0 - faceW * 0.08, y1: y1 + faceW * 0.05,
    },
    cheekL: cheekOf(EYE_OUTER_L, MOUTH_L, FACE_L),
    cheekR: cheekOf(EYE_OUTER_R, MOUTH_R, FACE_R),
    faceW,
  };
}

/** Mặt nạ vùng môi (viền ngoài trừ khe miệng), 0..255 theo từng pixel. */
function buildLipMask(lm: FaceLandmarks, w: number, h: number): Uint8ClampedArray | null {
  const s = getScratch(w, h);
  if (!s.maskCanvas) {
    if (typeof document === "undefined") return null;
    s.maskCanvas = document.createElement("canvas");
  }
  const c = s.maskCanvas;
  c.width = w;
  c.height = h;
  const mctx = c.getContext("2d", { willReadFrequently: true });
  if (!mctx) return null;

  mctx.clearRect(0, 0, w, h);

  const trace = (idx: number[]) => {
    mctx.beginPath();
    idx.forEach((i, n) => {
      const p = lm[i];
      if (!p) return;
      const x = p.x * w, y = p.y * h;
      if (n === 0) mctx.moveTo(x, y); else mctx.lineTo(x, y);
    });
    mctx.closePath();
  };

  mctx.fillStyle = "#fff";
  trace(LIPS_OUTER);
  mctx.fill();

  // Khe miệng bị khoét ra: hé răng mà tô vào thì răng hoá hồng.
  mctx.globalCompositeOperation = "destination-out";
  trace(LIPS_INNER);
  mctx.fill();
  mctx.globalCompositeOperation = "source-over";

  return mctx.getImageData(0, 0, w, h).data;
}

// ── Bảng tra chỉnh sáng ─────────────────────────────────────────────────────

let toneLut: { key: number; lut: Uint8ClampedArray } | null = null;

/**
 * Kéo sáng vùng tối bằng gamma, rồi nhấn nhẹ tương phản cho ảnh khỏi bợt.
 * Phòng tập hay thiếu sáng hoặc ám vàng đèn, ảnh ra tối thui — kéo sáng làm
 * khuôn mặt RÕ hơn chứ không mờ đi.
 */
function getToneLut(brighten: number): Uint8ClampedArray {
  const key = Math.round(brighten * 100);
  if (toneLut && toneLut.key === key) return toneLut.lut;

  const gamma = 1 + 0.30 * brighten;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    const n = Math.pow(v / 255, 1 / gamma);
    // Chữ S rất nhẹ: giữ lại chút tương phản đã bị gamma làm phẳng.
    const s = n + 0.10 * brighten * Math.sin(2 * Math.PI * n) * -1;
    lut[v] = Math.max(0, Math.min(255, s * 255));
  }
  toneLut = { key, lut };
  return lut;
}

// ── Hàm chính ───────────────────────────────────────────────────────────────

export type BeautyResult = {
  /** Có tìm thấy khuôn mặt để làm mịn / đánh má / tô môi không. */
  facePainted: boolean;
};

/**
 * Áp bộ làm đẹp lên nội dung đang có sẵn trên `ctx`, tại chỗ.
 *
 * `lm` là null (không tải được thư viện, hoặc khung hình không có mặt nào) thì
 * CHỈ chỉnh sáng. Không có điểm mốc thì mặt nạ da không đáng tin — làm mịn đại
 * trà sẽ bôi cả sàn gỗ lẫn áo khách, mà vẫn không chắc trúng mặt.
 */
export function applyBeauty(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lm: FaceLandmarks | null,
  opts: BeautyOptions,
): BeautyResult {
  if (w <= 0 || h <= 0) return { facePainted: false };

  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const geom = lm ? faceGeometry(lm, w, h) : null;

  // ── 1. Làm mịn da ─────────────────────────────────────────────────────────
  const region = geom ? clampRect(geom.box, w, h) : null;

  if (geom && region && opts.smooth > 0 && region.x1 > region.x0 && region.y1 > region.y0) {
    const s = getScratch(w, h);
    buildSkinMask(data, s.skin, w, h, region);

    // Bán kính theo bề ngang khuôn mặt: mặt ở xa thì làm mờ ít, lại gần thì
    // nhiều — nếu cố định theo pixel, chụp gần sẽ mịn như sáp.
    const radius = Math.max(1, Math.round(geom.faceW * 0.035));
    boxBlur(data, s.tmp, s.blur, w, h, radius, region);

    const blur = s.blur;
    const skin = s.skin;
    const strength = opts.smooth;

    for (let y = region.y0; y <= region.y1; y++) {
      for (let x = region.x0; x <= region.x1; x++) {
        const i = y * w + x;
        const m = skin[i];
        if (m === 0) continue;
        const p = i * 4;

        const dR = data[p]     - blur[p];
        const dG = data[p + 1] - blur[p + 1];
        const dB = data[p + 2] - blur[p + 2];

        // GIỮ VIỀN: chênh lệch giữa ảnh gốc và ảnh mờ càng lớn thì đó càng là
        // nét thật (lông mày, mi, cánh mũi, viền môi) chứ không phải khuyết
        // điểm da — chỗ đó trả về gần như nguyên bản. Thiếu bước này thì khuôn
        // mặt thành cái mặt nạ.
        const detail = (Math.abs(dR) + Math.abs(dG) + Math.abs(dB)) / 3;
        const keep = detail > 26 ? 0 : 1 - detail / 26;

        const a = strength * (m / 255) * keep;
        if (a <= 0) continue;

        data[p]     -= dR * a;
        data[p + 1] -= dG * a;
        data[p + 2] -= dB * a;
      }
    }
  }

  // ── 2. Đánh má ────────────────────────────────────────────────────────────
  // Đắp màu lên vùng có sẵn, không đụng tới hình dạng khuôn mặt.
  if (geom && opts.blush > 0) {
    const skin = getScratch(w, h).skin;
    // Hồng đào, hơi ngả cam cho hợp tông da người Việt.
    const BR = 244, BG = 122, BB = 132;
    const peak = 0.26 * opts.blush;

    for (const cheek of [geom.cheekL, geom.cheekR]) {
      const r = cheek.r;
      const x0 = Math.max(0, Math.floor(cheek.x - r));
      const x1 = Math.min(w - 1, Math.ceil(cheek.x + r));
      const y0 = Math.max(0, Math.floor(cheek.y - r));
      const y1 = Math.min(h - 1, Math.ceil(cheek.y + r));
      const r2 = r * r;

      for (let y = y0; y <= y1; y++) {
        const dy = y - cheek.y;
        for (let x = x0; x <= x1; x++) {
          const dx = x - cheek.x;
          const d2 = dx * dx + dy * dy;
          if (d2 >= r2) continue;

          const i = y * w + x;
          const m = skin[i];
          if (m === 0) continue;

          // Tắt dần bình phương: giữa đậm, ra mép tan hẳn, không có viền đốm.
          const t = 1 - d2 / r2;
          const a = peak * t * t * (m / 255);
          if (a <= 0) continue;

          const p = i * 4;
          data[p]     += (BR - data[p])     * a;
          data[p + 1] += (BG - data[p + 1]) * a;
          data[p + 2] += (BB - data[p + 2]) * a;
        }
      }
    }
  }

  // ── 3. Hồng môi ───────────────────────────────────────────────────────────
  if (geom && lm && opts.lips > 0) {
    const mask = buildLipMask(lm, w, h);
    if (mask) {
      const LR = 206, LG = 74, LB = 104;
      const peak = 0.34 * opts.lips;

      for (let i = 0, p = 0; i < w * h; i++, p += 4) {
        const m = mask[i * 4 + 3];
        if (m === 0) continue;

        const R = data[p], G = data[p + 1], B = data[p + 2];

        // Chốt chặn cuối: nếu viền môi lệch vài pixel và trùm lên răng thì pixel
        // đó sáng và gần như không màu — bỏ qua, đừng nhuộm hồng hàm răng.
        const maxC = Math.max(R, G, B), minC = Math.min(R, G, B);
        if (maxC > 200 && maxC - minC < 34) continue;

        const a = peak * (m / 255);
        data[p]     += (LR - R) * a;
        data[p + 1] += (LG - G) * a;
        data[p + 2] += (LB - B) * a;
      }
    }
  }

  // ── 4. Chỉnh sáng ─────────────────────────────────────────────────────────
  // Đi sau cùng và áp cho CẢ ảnh, kể cả khi không thấy khuôn mặt nào.
  if (opts.brighten > 0) {
    const lut = getToneLut(opts.brighten);
    for (let p = 0; p < data.length; p += 4) {
      data[p]     = lut[data[p]];
      data[p + 1] = lut[data[p + 1]];
      data[p + 2] = lut[data[p + 2]];
    }
  }

  ctx.putImageData(img, 0, 0);
  return { facePainted: !!geom };
}
