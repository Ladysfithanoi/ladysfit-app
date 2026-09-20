"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  applyBeauty, releaseBeautyBuffers, DEFAULT_BEAUTY, type FaceLandmarks,
} from "@/lib/beauty-filter";
import { loadFaceDetector, type FaceDetector } from "@/lib/face-landmarks";

// ── Ảnh check-out — PT chụp cùng khách khi kết thúc buổi ────────────────────
//
// Đây là biện pháp chống KÝ KHỐNG: chữ ký tay ký hộ được, còn ảnh chụp tại chỗ
// thì không. Vì vậy màn chụp bên dưới CỐ Ý không có ô tải ảnh lên: không dùng
// <input type="file"> (kể cả kèm `capture`, vì trên nhiều máy nó vẫn mở được thư
// viện ảnh), chỉ mở camera qua getUserMedia rồi vẽ khung hình ra canvas.
//
// Ảnh được thu nhỏ và nén thành data URL JPEG trước khi gửi, để cột TEXT trong
// DB không phình — cùng cách lưu với chữ ký.
//
// iPhone/Safari là máy khó tính nhất ở màn này, nên toàn bộ phần mở camera bên
// dưới viết theo nguyên tắc "không bao giờ treo": mọi bước chờ đều có hạn chót,
// mọi lần hỏng đều có đường bấm lại. Ba kiểu hỏng đã gặp ngoài phòng tập:
//   1. getUserMedia không trả về (không lỗi, không stream) khi camera vừa bị
//      ứng dụng khác chiếm → spinner quay mãi, nút Chụp disable vĩnh viễn.
//   2. Stream mở được nhưng <video> chưa hề có khung hình → hộp đen im lặng.
//   3. Khoá màn hình / chuyển sang app khác rồi quay lại: iOS ngắt track camera
//      (muted rồi ended) và không tự chạy lại → quay lại thấy màn đen.

/** Cạnh dài tối đa của ảnh gửi lên, đủ để FM nhìn rõ mặt mà vẫn nhẹ (~80KB/ảnh). */
const MAX_EDGE = 900;
const JPEG_QUALITY = 0.7;

/** Hạn chót cho MỖI kiểu ràng buộc khi xin camera, và cho lần chờ khung hình đầu. */
const OPEN_TIMEOUT_MS = 6000;
const FRAME_TIMEOUT_MS = 6000;

type Facing = "environment" | "user";
type Phase = "starting" | "live" | "error";

// ── Làm đẹp ────────────────────────────────────────────────────────────────
//
// PT tự bật/tắt, và lựa chọn được nhớ trên máy họ. Tắt thì không nạp thư viện
// nhận diện, không chạy vòng lặp vẽ — luồng chụp y hệt như trước khi có tính
// năng này, ai không dùng thì không phải trả giá gì.
//
// Bật thì PT phải THẤY TRƯỚC mình ra sao rồi mới bấm chụp, nên màn xem trước
// chạy đúng bộ lọc sẽ dùng cho ảnh lưu lại — chỉ khác độ phân giải.

const BEAUTY_PREF_KEY = "ladysfit_checkout_beauty";

/** Cạnh dài của khung xem trước. Nhỏ hơn ảnh lưu nhiều lần nên chạy mượt. */
const PREVIEW_EDGE = 480;

/**
 * Nhận diện khuôn mặt ~9 lần/giây thay vì mỗi khung hình. Trong 110ms mặt người
 * gần như không dịch chuyển, mắt thường không thấy khác — mà tiết kiệm được
 * khoảng hai phần ba khối lượng tính toán.
 */
const DETECT_INTERVAL_MS = 110;

/** Dưới mức này thì máy không kham nổi xem trước → tự hạ cấp. */
const MIN_PREVIEW_FPS = 11;
/** Đo trong bấy nhiêu lâu rồi mới phán quyết, cho máy kịp khởi động. */
const FPS_WARMUP_MS = 700;
const FPS_SAMPLE_MS = 2600;

/**
 * "live"    — xem trước có filter, ảnh chụp ra đúng như đang thấy.
 * "capture" — máy yếu: xem trước để nguyên, filter áp lúc bấm chụp.
 * "tone"    — không nạp được thư viện nhận diện: chỉ còn chỉnh sáng.
 */
type BeautyMode = "loading" | "live" | "capture" | "tone";

function loadBeautyPref(): boolean {
  try { return window.localStorage.getItem(BEAUTY_PREF_KEY) === "1"; } catch { return false; }
}

function saveBeautyPref(on: boolean): void {
  try { window.localStorage.setItem(BEAUTY_PREF_KEY, on ? "1" : "0"); } catch { /* chế độ ẩn danh */ }
}

const FACING_LABEL: Record<Facing, string> = {
  environment: "Cam sau",
  user:        "Cam trước",
};

// Nhãn camera do máy tự đặt nên mỗi hệ điều hành một kiểu ("Front Camera",
// "camera2 1, facing front", "Camera trước"...). Bắt theo từ khoá cho rộng.
const FRONT_RE = /front|user|face|selfie|trước|truoc/i;
const BACK_RE  = /back|rear|environment|world|sau/i;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const stopStream = (s: MediaStream | null | undefined) => s?.getTracks().forEach((t) => t.stop());

/**
 * Chạy `p` với hạn chót. Hết giờ thì coi như hỏng và đi tiếp — nhưng nếu sau đó
 * `p` mới trả về stream thì `onLate` phải tắt nó, không thì đèn camera cứ sáng
 * và chính nó lại chiếm chỗ của lần mở sau.
 */
function withDeadline<T>(p: Promise<T>, ms: number, onLate: (value: T) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new DOMException("Hết giờ chờ camera", "TimeoutError"));
    }, ms);
    p.then(
      (value) => {
        if (timedOut) { onLate(value); return; }
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        if (timedOut) return;
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Camera ứng với mặt trước / mặt sau, hoặc null khi máy chỉ có một camera.
 *
 * Chọn theo deviceId chắc ăn hơn hẳn facingMode: nhiều máy Android coi
 * facingMode chỉ là "mong muốn" nên trả về đúng camera cũ, bấm đổi mà hình
 * không đổi.
 */
function pickDeviceId(cams: MediaDeviceInfo[], facing: Facing): string | null {
  if (cams.length < 2) return null;
  const hit = cams.find((c) => (facing === "user" ? FRONT_RE : BACK_RE).test(c.label));
  if (hit) return hit.deviceId;
  // Trình duyệt giấu nhãn (chưa cấp quyền, hoặc chế độ riêng tư): quy ước camera
  // đầu danh sách là mặt sau, camera cuối là mặt trước.
  return facing === "user" ? cams[cams.length - 1].deviceId : cams[0].deviceId;
}

/**
 * Mở camera theo mặt đã chọn, thử lần lượt từ ràng buộc chặt tới lỏng: đúng
 * thiết bị → đúng mặt → mặt mong muốn → camera nào cũng được. Máy nào cũng vào
 * được một trong bốn.
 *
 * Mỗi lần thử có hạn chót riêng: trên iOS lời gọi có thể không bao giờ trả về,
 * chờ mãi thì không bao giờ tới được ràng buộc lỏng hơn vốn lại mở được.
 */
async function openCamera(facing: Facing, cams: MediaDeviceInfo[]): Promise<MediaStream> {
  const id = pickDeviceId(cams, facing);
  const tries: MediaStreamConstraints[] = [
    ...(id ? [{ video: { deviceId: { exact: id } }, audio: false }] : []),
    { video: { facingMode: { exact: facing } }, audio: false },
    { video: { facingMode: facing }, audio: false },
    { video: true, audio: false },
  ];

  let lastErr: unknown;
  for (const constraints of tries) {
    try {
      return await withDeadline(
        navigator.mediaDevices.getUserMedia(constraints),
        OPEN_TIMEOUT_MS,
        stopStream
      );
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/**
 * Chờ <video> thực sự có khung hình đầu tiên. Stream mở được KHÔNG có nghĩa là
 * hình đã chạy: iOS hay dừng đúng ở đây, và đó chính là cái hộp đen.
 */
function waitForFirstFrame(video: HTMLVideoElement, ms: number): Promise<boolean> {
  const hasFrame = () => video.videoWidth > 0 && video.readyState >= 2;
  if (hasFrame()) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearInterval(poll);
      video.removeEventListener("loadedmetadata", check);
      video.removeEventListener("playing", check);
      resolve(ok);
    };
    const check = () => { if (hasFrame()) finish(true); };
    const timer = setTimeout(() => finish(false), ms);
    // Có máy không bắn đủ sự kiện, nên vẫn ngó lại theo nhịp cho chắc.
    const poll = setInterval(check, 150);
    video.addEventListener("loadedmetadata", check);
    video.addEventListener("playing", check);
    check();
  });
}

/** Câu hướng dẫn đúng với từng kiểu hỏng — PT đọc là biết phải làm gì ngay tại chỗ. */
function explainCameraError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Trình duyệt đang chặn camera. Trên iPhone: bấm chữ aA ở thanh địa chỉ → Cài đặt trang web → Camera → Cho phép, rồi bấm Thử lại.";
  if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError")
    return "Camera đang bị ứng dụng khác giữ (Camera, Zalo, Messenger, FaceTime...). Đóng hẳn ứng dụng đó rồi bấm Thử lại.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "Không tìm thấy camera phù hợp trên máy này. Đổi Cam trước / Cam sau rồi bấm Thử lại.";
  return "Camera chưa mở được — máy đang bận hoặc trình duyệt treo camera. Bấm Thử lại; nếu vẫn đen thì đóng bớt tab/ứng dụng khác rồi thử lần nữa.";
}

/**
 * Khung hình hiện tại → data URL JPEG.
 *
 * `beauty` bật thì chạy ĐÚNG hàm applyBeauty() mà màn xem trước đang chạy, chỉ
 * khác độ phân giải — nên cái PT nhìn thấy và cái được lưu là một.
 */
function drawToDataUrl(
  video: HTMLVideoElement,
  beauty?: { landmarks: FaceLandmarks | null },
): string | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  // readyState < 2 nghĩa là chưa có khung hình nào để vẽ — vẽ ra chỉ được ảnh đen.
  if (!w || !h || video.readyState < 2) return null;

  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  if (beauty) {
    applyBeauty(ctx, canvas.width, canvas.height, beauty.landmarks, DEFAULT_BEAUTY);
  }
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

/**
 * Hộp thoại chụp ảnh check-out. `onConfirm` nhận data URL JPEG.
 * Không có đường nào chọn ảnh có sẵn — bắt buộc chụp trực tiếp.
 */
export function CheckOutPhotoCapture({
  saving = false,
  onConfirm,
  onCancel,
}: {
  saving?: boolean;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Danh sách camera nằm ở ref chứ không phải state: dùng nó để mở camera, mà
  // để ở state thì mỗi lần liệt kê xong lại chạy lại effect và mở camera lần nữa.
  const camsRef = useRef<MediaDeviceInfo[]>([]);
  const [facing, setFacing] = useState<Facing>("environment");
  /** Số camera của máy; 0 = chưa liệt kê được (chưa cấp quyền chẳng hạn). */
  const [camCount, setCamCount] = useState(0);
  const [shot, setShot] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("starting");
  /** Tăng lên là mở lại camera từ đầu — nút Thử lại, và lúc quay về từ app khác. */
  const [attempt, setAttempt] = useState(0);

  // ── Làm đẹp ──────────────────────────────────────────────────────────────
  const [beautyOn, setBeautyOn] = useState(false);
  const [beautyMode, setBeautyMode] = useState<BeautyMode>("loading");
  /** Khung hình gần nhất có thấy khuôn mặt không — để nhắc PT đưa mặt vào khung. */
  const [faceSeen, setFaceSeen] = useState(true);
  /** Đang chạy bộ lọc trên ảnh vừa chụp (chế độ máy yếu). */
  const [processing, setProcessing] = useState(false);

  const beautyCanvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef     = useRef<FaceDetector | null>(null);
  /** Điểm mốc mới nhất; dùng lại cho lúc bấm chụp nên không phải dò thêm lần nữa. */
  const landmarksRef    = useRef<FaceLandmarks | null>(null);

  // Lựa chọn bật/tắt đọc ở effect chứ không ở useState: component này vẫn được
  // dựng sẵn ở máy chủ, đụng localStorage lúc dựng là lệch nội dung khi hydrate.
  useEffect(() => { setBeautyOn(loadBeautyPref()); }, []);

  const toggleBeauty = useCallback(() => {
    setBeautyOn((on) => {
      const next = !on;
      saveBeautyPref(next);
      if (!next) landmarksRef.current = null;
      return next;
    });
  }, []);

  // Nạp bộ nhận diện khuôn mặt — CHỈ khi PT bật làm đẹp.
  useEffect(() => {
    if (!beautyOn) { setBeautyMode("loading"); return; }
    if (detectorRef.current) { setBeautyMode("live"); return; }

    let cancelled = false;
    setBeautyMode("loading");
    loadFaceDetector().then((d) => {
      if (cancelled) return;
      detectorRef.current = d;
      // Không có bộ nhận diện thì không biết má/môi ở đâu — chỉ còn chỉnh sáng.
      setBeautyMode(d ? "live" : "tone");
    });
    return () => { cancelled = true; };
  }, [beautyOn]);

  useEffect(() => () => { releaseBeautyBuffers(); }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const stop = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    // Bỏ luôn srcObject: giữ lại một stream đã chết thì iOS vẽ ra đúng một khung
    // đen, nhìn y hệt lúc camera đang mở dở.
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Mở camera mỗi khi đổi mặt trước/sau hoặc bấm Thử lại, và đóng hẳn khi rời
  // màn — không tắt track thì đèn camera của máy vẫn sáng sau khi đóng hộp thoại.
  useEffect(() => {
    if (shot) return;
    let cancelled = false;
    setPhase("starting");
    setError("");

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setError(
            window.isSecureContext === false
              ? "Trang đang mở qua kết nối không bảo mật (http) nên trình duyệt khoá camera. Hãy mở app bằng địa chỉ https."
              : "Thiết bị/trình duyệt này không mở được camera. Hãy dùng điện thoại của PT để chụp."
          );
          setPhase("error");
        }
        return;
      }

      // Tắt luồng cũ TRƯỚC khi xin luồng mới: nhiều máy không mở được camera thứ
      // hai khi camera trước còn đang chạy, nên đổi trước/sau sẽ lỗi. iOS còn cần
      // một nhịp nghỉ mới nhả hẳn camera ra.
      const hadStream = !!streamRef.current;
      stop();
      if (hadStream) await sleep(150);
      if (cancelled) return;

      try {
        const stream = await openCamera(facing, camsRef.current);
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          // play() trên iOS có thể bị từ chối (máy vừa khoá màn hình chẳng hạn);
          // nuốt lỗi ở đây rồi để bước chờ khung hình bên dưới phán quyết.
          await video.play().catch(() => {});
          const ok = await waitForFirstFrame(video, FRAME_TIMEOUT_MS);
          if (cancelled) return;
          if (!ok) {
            stop();
            setError("Camera mở được nhưng chưa lên hình. Bấm Thử lại — nếu vẫn đen, đóng bớt tab/ứng dụng đang dùng camera.");
            setPhase("error");
            return;
          }
        }

        if (!cancelled) setPhase("live");

        // Nhãn và deviceId chỉ hiện ra sau khi người dùng đã cấp quyền camera,
        // nên liệt kê sau lần mở đầu tiên — lúc đó mới biết máy có mấy camera
        // và nút Cam trước / Cam sau có đáng hiện không.
        if (camsRef.current.length === 0 && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter((d) => d.kind === "videoinput");
          camsRef.current = cams;
          if (!cancelled) setCamCount(cams.length);
        }
      } catch (err) {
        if (!cancelled) {
          stop();
          setError(explainCameraError(err));
          setPhase("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [facing, shot, attempt, stop]);

  useEffect(() => stop, [stop]);

  // iOS ngắt camera khi khoá màn hình / chuyển app / có cuộc gọi: track chuyển
  // sang muted rồi ended, <video> đứng hình đen và không bao giờ tự chạy lại.
  // Quay lại màn là mở lại từ đầu.
  useEffect(() => {
    if (shot) return;

    const resume = () => {
      if (document.visibilityState !== "visible") return;
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track || track.readyState === "ended" || track.muted) {
        retry();
        return;
      }
      const video = videoRef.current;
      if (video?.paused) video.play().catch(retry);
    };

    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("focus", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("focus", resume);
    };
  }, [shot, retry]);

  // Camera bị máy thu hồi giữa chừng (ứng dụng khác chiếm) — báo lỗi kèm đường
  // bấm lại, thay vì để PT nhìn hộp đen mà không hiểu chuyện gì đang xảy ra.
  useEffect(() => {
    if (phase !== "live" || shot) return;
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;

    const onEnded = () => {
      setError("Camera vừa bị ngắt (ứng dụng khác lấy mất, hoặc máy vừa khoá màn hình). Bấm Thử lại.");
      setPhase("error");
    };
    track.addEventListener("ended", onEnded);
    return () => track.removeEventListener("ended", onEnded);
  }, [phase, shot]);

  // ── Vòng lặp xem trước có filter ─────────────────────────────────────────
  //
  // Bám đúng vòng đời camera sẵn có: chỉ chạy khi phase === "live", và tự dừng
  // khi camera chết, khi đổi cam trước/sau, khi bấm Thử lại hay khi đã chụp
  // xong — vì effect này chạy lại theo đúng những state đó. Quên chỗ này thì PT
  // nhìn canvas đứng hình mà tưởng máy treo.
  useEffect(() => {
    if (!beautyOn || beautyMode !== "live" || phase !== "live" || shot) return;

    let raf = 0;
    let cancelled = false;
    let lastDetect = 0;
    const startedAt = performance.now();
    let sampleFrom = 0;
    let frames = 0;
    let judged = false;

    const loop = () => {
      if (cancelled) return;
      raf = requestAnimationFrame(loop);

      const video = videoRef.current;
      const canvas = beautyCanvasRef.current;
      if (!video || !canvas) return;

      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh || video.readyState < 2) return;

      const scale = Math.min(1, PREVIEW_EDGE / Math.max(vw, vh));
      const w = Math.round(vw * scale);
      const h = Math.round(vh * scale);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, w, h);

      // Dò trên chính khung xem trước (đã thu nhỏ) chứ không trên video gốc —
      // rẻ hơn hẳn mà điểm mốc trả về là toạ độ 0..1 nên dùng lại được cho ảnh
      // chụp ở độ phân giải lớn.
      const now = performance.now();
      if (detectorRef.current && now - lastDetect >= DETECT_INTERVAL_MS) {
        lastDetect = now;
        const lm = detectorRef.current.detect(canvas, w, h);
        landmarksRef.current = lm;
        // Chỉ đụng vào state khi thật sự đổi — setState mỗi khung hình thì cả
        // cây component vẽ lại 30 lần/giây.
        setFaceSeen((seen) => (seen === !!lm ? seen : !!lm));
      }

      applyBeauty(ctx, w, h, landmarksRef.current, DEFAULT_BEAUTY);

      // Đo nhịp vẽ thật của máy này. Bỏ qua lúc mới khởi động vì khung hình đầu
      // luôn chậm (biên dịch JIT, cấp phát bộ đệm).
      if (!judged) {
        if (now - startedAt < FPS_WARMUP_MS) return;
        if (sampleFrom === 0) { sampleFrom = now; frames = 0; return; }
        frames++;
        const elapsed = now - sampleFrom;
        if (elapsed >= FPS_SAMPLE_MS) {
          judged = true;
          const fps = (frames * 1000) / elapsed;
          if (fps < MIN_PREVIEW_FPS) {
            // Máy không kham nổi: thà bỏ xem trước còn hơn để PT nhìn hình giật.
            // Filter vẫn được áp, chỉ là lúc bấm chụp.
            cancelled = true;
            cancelAnimationFrame(raf);
            setBeautyMode("capture");
          }
        }
      }
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [beautyOn, beautyMode, phase, shot]);

  async function capture() {
    const video = videoRef.current;
    if (!video) return;

    // Tắt làm đẹp → đúng đường cũ, không đụng gì tới bộ lọc.
    if (!beautyOn) {
      const plain = drawToDataUrl(video);
      if (!plain) {
        setError("Chưa lấy được khung hình. Bấm Thử lại để mở lại camera rồi chụp.");
        return;
      }
      setShot(plain);
      stop();
      return;
    }

    setProcessing(true);
    try {
      // Chế độ xem trước trực tiếp đã có sẵn điểm mốc của khung hình vừa rồi.
      // Chế độ máy yếu thì chưa dò lần nào — dò đúng một lần ngay tại đây.
      let landmarks = landmarksRef.current;
      if (!landmarks && detectorRef.current && video.videoWidth > 0) {
        landmarks = detectorRef.current.detect(video, video.videoWidth, video.videoHeight);
      }
      const dataUrl = drawToDataUrl(video, { landmarks });
      if (!dataUrl) {
        setError("Chưa lấy được khung hình. Bấm Thử lại để mở lại camera rồi chụp.");
        return;
      }
      setShot(dataUrl);
      stop();
    } finally {
      setProcessing(false);
    }
  }

  const starting = phase === "starting";
  /** Có đang phủ khung đã lọc lên video không. */
  const showLivePreview = beautyOn && beautyMode === "live" && phase === "live" && !shot;

  /** Một dòng nói rõ bộ lọc đang ở trạng thái nào — im lặng thì PT không hiểu. */
  const beautyNote = !beautyOn
    ? null
    : beautyMode === "loading"
      ? "Đang tải bộ làm đẹp..."
      : beautyMode === "tone"
        ? "Không tải được bộ nhận diện khuôn mặt (mạng yếu) — ảnh chỉ được chỉnh sáng."
        : beautyMode === "capture"
          ? "Máy chưa đủ nhanh để xem trước — bộ lọc sẽ được áp ngay khi bấm chụp."
          : !faceSeen
            ? "Chưa thấy khuôn mặt trong khung — đưa mặt vào giữa để đánh má và tô môi."
            : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-gray-900">Chụp ảnh cùng khách</h3>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              Ảnh chụp tại chỗ là bằng chứng buổi tập có thật — không chọn được ảnh có sẵn.
            </p>
          </div>
          <button
            onClick={() => { stop(); onCancel(); }}
            disabled={saving}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[3/4]">
            {shot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shot} alt="Ảnh vừa chụp" className="w-full h-full object-cover" />
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="w-full h-full object-cover"
                />
                {/* Khung đã qua bộ lọc phủ kín lên thẻ video. Video vẫn nằm
                    nguyên dưới và tiếp tục chạy — gỡ nó ra là mất nguồn khung
                    hình. Cùng tỉ lệ và cùng object-cover nên hai lớp trùng khít. */}
                {showLivePreview && (
                  <canvas
                    ref={beautyCanvasRef}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                {starting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-[11px] font-semibold">Đang mở camera...</span>
                  </div>
                )}
                {phase === "error" && (
                  // Hộp đen câm chính là thứ khiến PT đứng chờ vô ích — khi hỏng
                  // thì luôn có một nút bấm được ngay trên khung hình.
                  <button
                    type="button"
                    onClick={retry}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 text-white"
                  >
                    <RefreshCw className="w-6 h-6" />
                    <span className="text-xs font-bold">Bấm để mở lại camera</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Chọn mặt camera. Ẩn khi đã chụp xong, và khi biết chắc máy chỉ có
              một camera (máy tính bàn) — bấm cũng không đổi được gì. */}
          {!shot && camCount !== 1 && (
            <div className="flex gap-1 rounded-xl border border-gray-200 p-1">
              {(["environment", "user"] as Facing[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFacing(f)}
                  disabled={starting}
                  className={cn(
                    "flex-1 h-9 rounded-lg text-xs font-bold transition-colors disabled:opacity-50",
                    facing === f
                      ? "bg-[#f15b5c] text-white"
                      : "text-gray-500 hover:bg-gray-50"
                  )}
                >
                  {FACING_LABEL[f]}
                </button>
              ))}
            </div>
          )}

          {/* Công tắc làm đẹp. Ẩn khi đã chụp xong: ảnh đã chốt, gạt lúc này
              không đổi được gì — muốn khác thì bấm Chụp lại. */}
          {!shot && (
            <div className="rounded-xl border border-gray-200 p-1">
              <button
                type="button"
                onClick={toggleBeauty}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Sparkles className={cn("w-4 h-4 shrink-0", beautyOn ? "text-violet-500" : "text-gray-300")} />
                <span className="flex-1 text-left">
                  <span className="block text-xs font-bold text-gray-700">Làm đẹp</span>
                  <span className="block text-[10px] text-gray-400 leading-snug">
                    Mịn da, chỉnh sáng, đánh má, hồng môi
                  </span>
                </span>
                <span className={cn(
                  "w-10 h-6 rounded-full p-0.5 shrink-0 transition-colors",
                  beautyOn ? "bg-violet-500" : "bg-gray-200",
                )}>
                  <span className={cn(
                    "block w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
                    beautyOn && "translate-x-4",
                  )} />
                </span>
              </button>
              {beautyNote && (
                <p className="px-2.5 pb-1.5 text-[10px] text-gray-400 leading-relaxed">{beautyNote}</p>
              )}
            </div>
          )}

          {error && <p className="text-xs text-[#f15b5c] font-medium leading-relaxed">{error}</p>}

          {shot ? (
            <div className="flex gap-3">
              <button
                onClick={() => onConfirm(shot)}
                disabled={saving}
                className="flex-1 h-11 rounded-xl text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Đang lưu buổi tập...</>
                ) : (
                  "Dùng ảnh này"
                )}
              </button>
              <button
                onClick={() => { setShot(null); setError(""); }}
                disabled={saving}
                className="h-11 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                Chụp lại
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={capture}
                disabled={phase !== "live" || processing}
                className="flex-1 h-11 rounded-xl text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {processing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Đang xử lý ảnh...</>
                ) : (
                  <><Camera className="w-4 h-4" />Chụp ảnh</>
                )}
              </button>
              {/* Luôn có đường mở lại camera, kể cả khi spinner còn đang quay:
                  đây là lối thoát duy nhất khi iOS treo giữa chừng. */}
              <button
                type="button"
                onClick={retry}
                className="h-11 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                Thử lại
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Ảnh thu nhỏ trong nhật ký. Bấm vào mở modal phóng to để FM soi lại buổi tập.
 * Trả về null khi buổi chưa có ảnh (buổi cũ trước khi bật tính năng).
 */
export function CheckOutPhotoThumb({
  src,
  label = "Ảnh check-out",
  className,
}: {
  src: string | null | undefined;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!src) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${label} — bấm để phóng to`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-0.5 hover:border-[#f15b5c] transition-colors",
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="h-9 w-9 rounded-md object-cover" />
        <span className="pr-1.5 text-[10px] font-bold text-gray-500">Ảnh buổi tập</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
          onClick={() => setOpen(false)}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setOpen(false)}
              className="absolute -top-10 right-0 p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={label}
              className="w-full max-h-[85vh] object-contain rounded-2xl bg-black"
            />
            <p className="mt-2 text-center text-xs font-semibold text-white/70">{label}</p>
          </div>
        </div>
      )}
    </>
  );
}
