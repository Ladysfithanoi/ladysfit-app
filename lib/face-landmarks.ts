import type { FaceLandmarks } from "@/lib/beauty-filter";

// ── Nhận diện điểm mốc khuôn mặt cho bộ làm đẹp ảnh check-out ───────────────
//
// Đánh má và tô môi bắt buộc phải biết gò má / viền môi nằm đâu, không có cách
// nào khác. Dùng MediaPipe Face Landmarker (468 điểm) — cùng họ công nghệ các
// app camera đang dùng, nhưng ở đây CHỈ lấy toạ độ để đắp màu, không nắn hình.
//
// Cả file viết theo đúng nguyên tắc của màn chụp: KHÔNG BAO GIỜ TREO. Thư viện
// tải từ mạng nên trong phòng tập sóng yếu là chuyện thường — mọi bước chờ đều
// có hạn chót, hỏng thì trả về null và bên gọi rơi về "chỉ chỉnh sáng".
//
// WASM và model nằm trên CDN chứ không nằm trong repo: bộ WASM nặng 19MB, nhét
// vào /public là phình repo và phình mỗi lần deploy. Đổi lại là phụ thuộc mạng ở
// lần đầu; sau đó trình duyệt tự cache. Nếu wifi phòng tập quá tệ thì bước tiếp
// theo là tự host hai file này.

const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/** Hạn chót cho cả lượt tải thư viện + model. Quá thì coi như không có. */
const LOAD_TIMEOUT_MS = 15000;

export type FaceDetector = {
  /** Toạ độ đã chuẩn hoá 0..1; null = khung hình này không thấy mặt nào. */
  detect(source: CanvasImageSource, widthHint: number, heightHint: number): FaceLandmarks | null;
  close(): void;
};

type Landmarker = {
  detectForVideo(src: CanvasImageSource, ts: number): { faceLandmarks?: { x: number; y: number }[][] };
  close(): void;
};

let cached: Promise<FaceDetector | null> | null = null;

function withDeadline<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; resolve(null); }
    }, ms);
    p.then(
      (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } },
      () => { if (!done) { done = true; clearTimeout(timer); resolve(null); } },
    );
  });
}

async function build(): Promise<FaceDetector | null> {
  if (typeof window === "undefined") return null;

  const mod = await import("@mediapipe/tasks-vision");
  const { FilesetResolver, FaceLandmarker } = mod;

  const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);

  /**
   * GPU nhanh hơn nhiều nhưng một số máy Android cũ không dựng nổi ngữ cảnh đồ
   * hoạ cho WebGL và ném lỗi ngay lúc khởi tạo. Rơi về CPU thay vì bỏ cuộc —
   * chậm hơn, nhưng bên gọi đã có sẵn đường tự hạ cấp khi khung hình quá chậm.
   */
  async function create(delegate: "GPU" | "CPU"): Promise<Landmarker> {
    return (await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO",
      numFaces: 1,
    })) as unknown as Landmarker;
  }

  let landmarker: Landmarker;
  try {
    landmarker = await create("GPU");
  } catch {
    landmarker = await create("CPU");
  }

  // Mốc thời gian phải tăng nghiêm ngặt, nếu không MediaPipe ném lỗi và cả vòng
  // lặp xem trước chết theo. Tự giữ đồng hồ riêng thay vì tin vào đồng hồ ngoài.
  let lastTs = 0;

  return {
    detect(source, widthHint, heightHint) {
      if (widthHint <= 0 || heightHint <= 0) return null;
      const ts = Math.max(lastTs + 1, Math.round(performance.now()));
      lastTs = ts;
      try {
        const res = landmarker.detectForVideo(source, ts);
        const face = res.faceLandmarks?.[0];
        return face && face.length >= 468 ? face : null;
      } catch {
        // Một khung hình hỏng không được làm sập cả màn chụp.
        return null;
      }
    },
    close() {
      try { landmarker.close(); } catch { /* đóng hỏng thì thôi */ }
    },
  };
}

/**
 * Nạp bộ nhận diện, dùng lại cho những lần mở màn chụp sau. Trả null nếu không
 * tải được hoặc quá hạn — bên gọi phải xử lý được trường hợp này.
 *
 * CHỈ gọi khi PT thật sự bật làm đẹp: tắt thì không tải gì, luồng chụp y như cũ.
 */
export function loadFaceDetector(): Promise<FaceDetector | null> {
  if (!cached) {
    cached = withDeadline(build(), LOAD_TIMEOUT_MS).then((d) => {
      // Hỏng thì xoá cache để lần bật sau còn thử lại được (có thể lúc đó đã có
      // sóng). Thành công thì giữ nguyên, khỏi tải lại.
      if (!d) cached = null;
      return d;
    }).catch(() => {
      cached = null;
      return null;
    });
  }
  return cached;
}
