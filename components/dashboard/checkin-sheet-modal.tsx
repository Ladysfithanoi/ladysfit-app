"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Download, Loader2 } from "lucide-react";
import { fmtDate } from "@/lib/format-date";

/**
 * PHIẾU CHECK-IN BUỔI TẬP — bản số của tờ phụ lục hợp đồng đang ký tay.
 *
 * Vẽ toàn bộ phiếu lên MỘT canvas rồi vừa hiện lên xem, vừa tải xuống từ chính
 * canvas đó. Làm vậy để cái nhìn thấy và cái tải về là cùng một bản vẽ — dựng
 * bản xem bằng HTML rồi lại dựng bản tải bằng đường khác là kiểu sớm muộn hai
 * bên lệch nhau mà không ai biết.
 *
 * Cũng vì thế mà không cần thư viện chụp màn hình nào: ảnh chữ ký và ảnh
 * check-out vốn đã là data URL, vẽ thẳng vào canvas được.
 *
 * Bảng khác tờ giấy hai chỗ:
 *   • "Nhân viên lễ tân" → ẢNH CHECK-OUT của khách. Tờ giấy không làm được, và
 *     đây là bằng chứng buổi tập có thật, thay đúng vai trò chữ ký lễ tân.
 *   • Không có cột "Chữ ký PT". Hệ thống chưa lưu chữ ký của PT nên cột đó chỉ
 *     ghi được TÊN — ghi tên vào ô đề "chữ ký" là nói sai. Chữ ký HLV nằm ở ô
 *     ký cuối trang, đúng chỗ của nó.
 */

type SheetRow = {
  date: string;
  checkOutAt: string | null;
  signatureUrl: string | null;
  photoUrl: string | null;
};

type SheetData = {
  contractCode: string | null;
  clientName: string;
  ptName: string;
  packageName: string;
  totalSessions: number;
  startDate: string | null;
  endDate: string | null;
  price: number;
  rows: SheetRow[];
};

// ── Kích thước bản vẽ ────────────────────────────────────────────────────────
// Cỡ này in ra A4 vẫn đọc rõ chữ và nhìn được mặt người trong ảnh check-out.
const ROWS_PER_BLOCK = 25;
const COL_W = [70, 210, 140, 250, 290]; // STT · Ngày · Giờ · Chữ ký · Ảnh
const BLOCK_W = COL_W.reduce((a, b) => a + b, 0);
const W = BLOCK_W * 2;
const PAD = 40;
const HEADER_H = 200;
const HEAD_ROW_H = 78;
const ROW_H = 92;
const INFO_H = 220;
const SIGN_H = 300;
const H = HEADER_H + HEAD_ROW_H + ROWS_PER_BLOCK * ROW_H + INFO_H + SIGN_H;

const BRAND = "#f15b5c";
const LINE = "#e0a0a0";
const INK = "#1f2937";

/** "08:35" theo giờ VN. */
function hhmm(iso: string | null): string {
  if (!iso) return "";
  const vn = new Date(new Date(iso).getTime() + 7 * 3600_000);
  return `${String(vn.getUTCHours()).padStart(2, "0")}:${String(vn.getUTCMinutes()).padStart(2, "0")}`;
}

/** Nạp một data URL thành ảnh vẽ được. Ảnh hỏng thì trả null, ô để trống. */
function loadImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Vẽ ảnh vừa khít trong ô, giữ đúng tỉ lệ, căn giữa. */
function drawFitted(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number
) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export function CheckinSheetModal({
  clientId,
  enrollmentId,
  packageName,
  onClose,
}: {
  clientId: string;
  enrollmentId: string;
  packageName: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<SheetData | null>(null);

  // ── Nạp dữ liệu ──────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/checkin-sheet?enrollmentId=${enrollmentId}`);
        const body = await res.json();
        if (!alive) return;
        if (!res.ok) {
          setError(body.error ?? "Không tải được phiếu check-in");
          return;
        }
        setData(body as SheetData);
      } catch {
        if (alive) setError("Có lỗi xảy ra khi tải phiếu");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [clientId, enrollmentId]);

  // ── Vẽ phiếu ─────────────────────────────────────────────────────────────
  const draw = useCallback(async (d: SheetData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "middle";

    // Tiêu đề
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.font = "bold 46px system-ui, sans-serif";
    ctx.fillText("PHỤ LỤC HỢP ĐỒNG SỐ 01", W / 2, 56);
    ctx.font = "italic 24px system-ui, sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.fillText(
      `(Đính kèm Hợp đồng huấn luyện viên cá nhân số ${d.contractCode ?? "................"})`,
      W / 2, 104
    );
    ctx.font = "bold 34px system-ui, sans-serif";
    ctx.fillStyle = INK;
    ctx.fillText("PHIẾU CHECK-IN BUỔI TẬP", W / 2, 156);

    // ── Bảng: 2 khối 25 dòng đặt cạnh nhau ─────────────────────────────────
    const HEAD = ["STT", "Ngày cung cấp dịch vụ", "Thời gian", "Chữ ký khách hàng", "Ảnh check-out của khách hàng"];
    const tableTop = HEADER_H;

    // Mốc x của từng cột trong cả hai khối
    const colX: number[] = [];
    let x = 0;
    for (let b = 0; b < 2; b++) for (const w of COL_W) { colX.push(x); x += w; }
    colX.push(W);

    // Hàng tiêu đề
    ctx.fillStyle = "#fdf2f2";
    ctx.fillRect(0, tableTop, W, HEAD_ROW_H);
    ctx.font = "bold 19px system-ui, sans-serif";
    ctx.fillStyle = BRAND;
    ctx.textAlign = "center";
    for (let b = 0; b < 2; b++) {
      for (let c = 0; c < HEAD.length; c++) {
        const i = b * COL_W.length + c;
        const cx = colX[i] + COL_W[c] / 2;
        const words = HEAD[c].split(" ");
        // Nhãn dài xuống dòng cho vừa cột, không tràn sang ô bên cạnh.
        const lines: string[] = [];
        let line = "";
        for (const wd of words) {
          const next = line ? `${line} ${wd}` : wd;
          if (ctx.measureText(next).width > COL_W[c] - 16 && line) { lines.push(line); line = wd; }
          else line = next;
        }
        if (line) lines.push(line);
        const startY = tableTop + HEAD_ROW_H / 2 - ((lines.length - 1) * 22) / 2;
        lines.forEach((ln, k) => ctx.fillText(ln, cx, startY + k * 22));
      }
    }

    // Các dòng
    const bodyTop = tableTop + HEAD_ROW_H;
    ctx.font = "21px system-ui, sans-serif";
    for (let i = 0; i < ROWS_PER_BLOCK; i++) {
      const y = bodyTop + i * ROW_H;
      for (let b = 0; b < 2; b++) {
        const row = d.rows[i + b * ROWS_PER_BLOCK];
        const base = b * COL_W.length;
        ctx.fillStyle = INK;
        ctx.textAlign = "center";
        ctx.fillText(String(i + 1 + b * ROWS_PER_BLOCK), colX[base] + COL_W[0] / 2, y + ROW_H / 2);
        if (row) {
          ctx.fillText(fmtDate(row.date), colX[base + 1] + COL_W[1] / 2, y + ROW_H / 2);
          ctx.fillText(hhmm(row.checkOutAt), colX[base + 2] + COL_W[2] / 2, y + ROW_H / 2);
        }
      }
    }

    // Ảnh chữ ký và ảnh check-out — nạp hết rồi vẽ, để không bị vẽ dở dang.
    const jobs: Promise<void>[] = [];
    for (let i = 0; i < ROWS_PER_BLOCK; i++) {
      const y = bodyTop + i * ROW_H;
      for (let b = 0; b < 2; b++) {
        const row = d.rows[i + b * ROWS_PER_BLOCK];
        if (!row) continue;
        const base = b * COL_W.length;
        jobs.push(
          loadImage(row.signatureUrl).then((img) => {
            if (img) drawFitted(ctx, img, colX[base + 3] + 8, y + 6, COL_W[3] - 16, ROW_H - 12);
          })
        );
        jobs.push(
          loadImage(row.photoUrl).then((img) => {
            if (img) drawFitted(ctx, img, colX[base + 4] + 8, y + 6, COL_W[4] - 16, ROW_H - 12);
          })
        );
      }
    }
    await Promise.all(jobs);

    // Kẻ bảng SAU khi vẽ ảnh, để đường kẻ nằm trên ảnh chứ không bị ảnh che.
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.5;
    const tableBottom = bodyTop + ROWS_PER_BLOCK * ROW_H;
    for (let i = 0; i <= ROWS_PER_BLOCK + 1; i++) {
      const y = tableTop + (i === 0 ? 0 : HEAD_ROW_H + (i - 1) * ROW_H);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, tableBottom);
    ctx.lineTo(W, tableBottom);
    ctx.stroke();
    for (const cx of colX) {
      ctx.beginPath();
      ctx.moveTo(cx === W ? W - 1 : cx, tableTop);
      ctx.lineTo(cx === W ? W - 1 : cx, tableBottom);
      ctx.stroke();
    }

    // ── Thông tin hội viên ─────────────────────────────────────────────────
    const range =
      d.startDate || d.endDate
        ? `${d.startDate ? fmtDate(d.startDate) : "..."} — ${d.endDate ? fmtDate(d.endDate) : "..."}`
        : "";
    const info: [string, string][] = [
      ["1. HỌ TÊN HỘI VIÊN:", d.clientName],
      ["2. TỔNG SỐ BUỔI TẬP:", `${d.totalSessions} buổi`],
      ["3. THỜI HẠN HỢP ĐỒNG:", range],
      ["4. GIÁ TRỊ GÓI TẬP:", d.price > 0 ? `${d.price.toLocaleString("vi-VN")} đ` : ""],
    ];
    ctx.textAlign = "left";
    let iy = tableBottom + 46;
    for (const [label, value] of info) {
      ctx.font = "bold 23px system-ui, sans-serif";
      ctx.fillStyle = INK;
      ctx.fillText(label, PAD, iy);
      ctx.font = "23px system-ui, sans-serif";
      ctx.fillStyle = "#374151";
      ctx.fillText(value, PAD + 330, iy);
      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD + 320, iy + 16);
      ctx.lineTo(W - PAD, iy + 16);
      ctx.stroke();
      iy += 48;
    }

    // ── Ba ô chữ ký ────────────────────────────────────────────────────────
    const signTop = tableBottom + INFO_H;
    const third = (W - PAD * 2) / 3;
    const titles = ["Chữ ký khách hàng", "Chữ ký HLV", "Đại diện trung tâm"];
    ctx.textAlign = "center";
    titles.forEach((t, k) => {
      const cx = PAD + third * k + third / 2;
      ctx.font = "bold 25px system-ui, sans-serif";
      ctx.fillStyle = INK;
      ctx.fillText(t, cx, signTop);
      ctx.font = "italic 20px system-ui, sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText("(Ký, ghi rõ họ tên)", cx, signTop + 34);
    });
    // Tên sẵn ở hai ô cuối như tờ giấy vẫn ghi.
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.fillStyle = INK;
    ctx.fillText(d.ptName, PAD + third + third / 2, signTop + 200);
    ctx.fillStyle = BRAND;
    ctx.fillText("Fitness Manager", PAD + third * 2 + third / 2, signTop + 200);

    if (d.rows.length === 0) {
      ctx.font = "italic 24px system-ui, sans-serif";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText("Lộ trình này chưa có buổi nào đã check-out.", W / 2, bodyTop + 40);
    }
  }, []);

  useEffect(() => {
    if (data) draw(data);
  }, [data, draw]);

  /** Tải chính bản vẽ đang hiện — không dựng lại bằng đường nào khác. */
  function download() {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safe = data.clientName
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d").replace(/Đ/g, "D")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      a.href = url;
      a.download = `Phieu-check-in-${safe}-${packageName}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  const doneCount = data?.rows.length ?? 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-base font-extrabold text-gray-900">Phiếu check-in buổi tập</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-gray-400">
              {data ? `${data.clientName} · gói ${data.packageName} · ${doneCount} buổi đã check-out` : "Đang tải…"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-gray-100 p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-24 text-sm font-semibold text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang dựng phiếu…
            </div>
          ) : error ? (
            <p className="py-24 text-center text-sm font-bold text-red-500">{error}</p>
          ) : (
            <canvas
              ref={canvasRef}
              className="mx-auto block h-auto w-full max-w-full rounded-lg bg-white shadow-sm"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-5 py-4">
          <button
            onClick={download}
            disabled={loading || !!error}
            className="flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-40"
            style={{ backgroundColor: BRAND }}
          >
            <Download className="h-4 w-4" />
            Tải ảnh phiếu
          </button>
          <p className="min-w-0 flex-1 text-xs leading-snug text-gray-400">
            Tải về dạng ảnh PNG để lưu vào hồ sơ lương của buổi dạy.
          </p>
          <button
            onClick={onClose}
            className="h-11 shrink-0 rounded-xl border border-gray-200 px-5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
