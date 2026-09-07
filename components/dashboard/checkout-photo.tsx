"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Ảnh check-out — PT chụp cùng khách khi kết thúc buổi ────────────────────
//
// Đây là biện pháp chống KÝ KHỐNG: chữ ký tay ký hộ được, còn ảnh chụp tại chỗ
// thì không. Vì vậy màn chụp bên dưới CỐ Ý không có ô tải ảnh lên: không dùng
// <input type="file"> (kể cả kèm `capture`, vì trên nhiều máy nó vẫn mở được thư
// viện ảnh), chỉ mở camera qua getUserMedia rồi vẽ khung hình ra canvas.
//
// Ảnh được thu nhỏ và nén thành data URL JPEG trước khi gửi, để cột TEXT trong
// DB không phình — cùng cách lưu với chữ ký.

/** Cạnh dài tối đa của ảnh gửi lên, đủ để FM nhìn rõ mặt mà vẫn nhẹ (~80KB/ảnh). */
const MAX_EDGE = 900;
const JPEG_QUALITY = 0.7;

type Facing = "environment" | "user";

const FACING_LABEL: Record<Facing, string> = {
  environment: "Cam sau",
  user:        "Cam trước",
};

// Nhãn camera do máy tự đặt nên mỗi hệ điều hành một kiểu ("Front Camera",
// "camera2 1, facing front", "Camera trước"...). Bắt theo từ khoá cho rộng.
const FRONT_RE = /front|user|face|selfie|trước|truoc/i;
const BACK_RE  = /back|rear|environment|world|sau/i;

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
 * thiết bị → đúng mặt → mặt mong muốn. Máy nào cũng vào được một trong ba.
 */
async function openCamera(facing: Facing, cams: MediaDeviceInfo[]): Promise<MediaStream> {
  const id = pickDeviceId(cams, facing);
  const tries: MediaStreamConstraints[] = [
    ...(id ? [{ video: { deviceId: { exact: id } }, audio: false }] : []),
    { video: { facingMode: { exact: facing } }, audio: false },
    { video: { facingMode: facing }, audio: false },
  ];

  let lastErr: unknown;
  for (const constraints of tries) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

function drawToDataUrl(video: HTMLVideoElement): string | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;

  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
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
  const [starting, setStarting] = useState(true);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Mở camera mỗi khi đổi mặt trước/sau, và đóng hẳn khi rời màn — không tắt
  // track thì đèn camera của máy vẫn sáng sau khi đóng hộp thoại.
  useEffect(() => {
    if (shot) return;
    let cancelled = false;
    setStarting(true);
    setError("");

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setError("Thiết bị/trình duyệt này không mở được camera. Hãy dùng điện thoại của PT để chụp.");
          setStarting(false);
        }
        return;
      }
      // Tắt luồng cũ TRƯỚC khi xin luồng mới: nhiều máy không mở được camera thứ
      // hai khi camera trước còn đang chạy, nên đổi trước/sau sẽ lỗi.
      stop();
      try {
        const stream = await openCamera(facing, camsRef.current);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // Nhãn và deviceId chỉ hiện ra sau khi người dùng đã cấp quyền camera,
        // nên liệt kê sau lần mở đầu tiên — lúc đó mới biết máy có mấy camera
        // và nút Cam trước / Cam sau có đáng hiện không.
        if (camsRef.current.length === 0 && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter((d) => d.kind === "videoinput");
          camsRef.current = cams;
          if (!cancelled) setCamCount(cams.length);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Không truy cập được camera. Kiểm tra quyền camera của trình duyệt rồi thử lại — buổi tập cần ảnh chụp cùng khách mới ký check-out được."
          );
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [facing, shot, stop]);

  useEffect(() => stop, [stop]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const dataUrl = drawToDataUrl(video);
    if (!dataUrl) {
      setError("Chưa lấy được khung hình, thử lại sau một giây.");
      return;
    }
    setShot(dataUrl);
    stop();
  }

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
                {starting && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/70">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
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
                  "Dùng ảnh này & kết thúc buổi"
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
            <button
              onClick={capture}
              disabled={starting || !!error}
              className="w-full h-11 rounded-xl text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ backgroundColor: "#f15b5c" }}
            >
              <Camera className="w-4 h-4" />
              Chụp ảnh
            </button>
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
