"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Video, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { youtubeEmbedUrl, isSafeMediaUrl } from "@/lib/exam-media";

export type QuestionMediaValue = { imageUrl: string; videoUrl: string };

/** Khung nhúng YouTube giữ đúng tỉ lệ 16:9 ở mọi bề ngang. */
function YoutubeFrame({ src, title }: { src: string; title: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ paddingTop: "56.25%" }}>
      <iframe
        src={src}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}

/**
 * Phần minh hoạ hiển thị kèm câu hỏi — dùng chung cho trang làm bài của PT và
 * ngân hàng câu hỏi của Admin. Không có ảnh lẫn video thì không chiếm chỗ nào.
 *
 * Link video không phải YouTube (Drive, Vimeo, file mp4…) vẫn dùng được, chỉ
 * hiện thành nút mở tab mới thay vì nhúng thẳng.
 */
export function QuestionMedia({
  imageUrl,
  videoUrl,
  compact = false,
}: {
  imageUrl?: string | null;
  videoUrl?: string | null;
  /** Bản thu nhỏ cho danh sách ngân hàng câu hỏi. */
  compact?: boolean;
}) {
  const [zoom, setZoom] = useState(false);
  const embed = youtubeEmbedUrl(videoUrl);
  const hasImage = !!imageUrl;
  const hasVideo = !!videoUrl;
  if (!hasImage && !hasVideo) return null;

  if (compact) {
    return (
      <div className="mt-2 flex items-center gap-2">
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl!}
            alt="Ảnh minh hoạ câu hỏi"
            className="h-12 w-12 rounded-lg object-cover border border-gray-100"
          />
        )}
        {hasVideo && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-bold text-red-500">
            <Video className="h-3.5 w-3.5" />
            {embed ? "Video YouTube" : "Link video"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {hasImage && (
        <>
          <button type="button" onClick={() => setZoom(true)} className="block w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl!}
              alt="Ảnh minh hoạ câu hỏi"
              className="max-h-80 w-full rounded-xl border border-gray-100 object-contain bg-gray-50"
            />
          </button>
          {zoom && (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
              onClick={() => setZoom(false)}
            >
              <button
                type="button"
                onClick={() => setZoom(false)}
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl!} alt="Ảnh minh hoạ câu hỏi" className="max-h-full max-w-full rounded-xl object-contain" />
            </div>
          )}
        </>
      )}

      {hasVideo && (embed ? (
        <YoutubeFrame src={embed} title="Video minh hoạ câu hỏi" />
      ) : (
        <a
          href={videoUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Mở video minh hoạ
        </a>
      ))}
    </div>
  );
}

/**
 * Ô nhập ảnh/video khi Admin soạn câu hỏi. Ảnh tải thẳng lên Storage qua
 * /api/upload (dùng chung với ảnh đại diện khách hàng) rồi lưu link; ai đã có
 * sẵn link ảnh trên mạng thì dán vào ô bên dưới cũng được.
 */
export function QuestionMediaFields({
  value,
  onChange,
}: {
  value: QuestionMediaValue;
  onChange: (v: QuestionMediaValue) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const inputCls =
    "w-full h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-white";

  async function handleFile(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Tải ảnh thất bại");
      onChange({ ...value, imageUrl: data.url });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Tải ảnh thất bại");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const videoTrimmed = value.videoUrl.trim();
  const embed = youtubeEmbedUrl(videoTrimmed);
  const videoProblem =
    videoTrimmed && !isSafeMediaUrl(videoTrimmed)
      ? "Link phải bắt đầu bằng http:// hoặc https://"
      : videoTrimmed && !embed
        ? "Không nhận ra link YouTube — khi làm bài sẽ hiện nút mở link thay vì phát tại chỗ."
        : "";

  return (
    <div className="rounded-xl border border-dashed border-gray-200 p-3 space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
        Minh hoạ (không bắt buộc)
      </p>

      {/* ── Ảnh ── */}
      <div className="space-y-2">
        {value.imageUrl ? (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value.imageUrl}
              alt="Ảnh minh hoạ"
              className="h-20 w-20 rounded-xl border border-gray-100 object-cover"
            />
            <button
              type="button"
              onClick={() => onChange({ ...value, imageUrl: "" })}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-500 hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Gỡ ảnh
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            {uploading ? "Đang tải ảnh..." : "Tải ảnh lên"}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <input
          type="text"
          placeholder="…hoặc dán link ảnh có sẵn (https://…)"
          value={value.imageUrl}
          onChange={(e) => onChange({ ...value, imageUrl: e.target.value })}
          className={cn(inputCls, "text-xs")}
        />
        {uploadError && <p className="text-[11px] font-semibold text-red-500">{uploadError}</p>}
      </div>

      {/* ── Video ── */}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Link video YouTube (https://youtu.be/… hoặc https://www.youtube.com/watch?v=…)"
          value={value.videoUrl}
          onChange={(e) => onChange({ ...value, videoUrl: e.target.value })}
          className={cn(inputCls, "text-xs")}
        />
        {videoProblem && <p className="text-[11px] font-semibold text-amber-600">{videoProblem}</p>}
        {embed && (
          <div className="max-w-xs">
            <YoutubeFrame src={embed} title="Xem trước video" />
          </div>
        )}
      </div>
    </div>
  );
}
