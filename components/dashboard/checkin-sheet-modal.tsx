"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Download, Loader2, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { fmtDate } from "@/lib/format-date";
import { CheckinSheetEditor } from "./checkin-sheet-editor";
import {
  EMPTY_OVERRIDE,
  ROWS_PER_SHEET,
  sheetTime,
  type SheetOverride,
  type SheetRow,
} from "@/lib/checkin-sheet";

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
 * Cột "Chữ ký khách hàng" là chữ ký khách ký lúc CHECK-IN. Khách chỉ ký một lần
 * đầu buổi; thứ đóng buổi là ảnh PT chụp cùng khách ở cột bên cạnh.
 *
 * Bảng khác tờ giấy hai chỗ:
 *   • "Nhân viên lễ tân" → ẢNH CHECK-OUT của khách. Tờ giấy không làm được, và
 *     đây là bằng chứng buổi tập có thật, thay đúng vai trò chữ ký lễ tân.
 *   • Thêm cột "Cân nặng (kg)" cạnh ảnh, lấy từ nhật ký cân nặng của khách. Số
 *     cân đo đúng ngày tập in đậm màu mực; buổi không cân thì in nhạt số cân
 *     gần nhất trước đó, để không ai đọc nhầm số mang theo thành số đo thật.
 *   • Không có cột "Chữ ký PT". Hệ thống chưa lưu chữ ký của PT nên cột đó chỉ
 *     ghi được TÊN — ghi tên vào ô đề "chữ ký" là nói sai. Chữ ký HLV nằm ở ô
 *     ký cuối trang, đúng chỗ của nó.
 */

type SheetData = {
  contractCode: string | null;
  clientName: string;
  ptName: string;
  /** FM phụ trách cơ sở — đứng tên ở ô "Đại diện trung tâm". */
  fmName: string;
  packageName: string;
  totalSessions: number;
  startDate: string | null;
  endDate: string | null;
  price: number;
  rows: SheetRow[];
  /** Số GỐC của lộ trình — trình sửa cần để hiện nút "về số gốc". */
  original: {
    contractCode: string | null;
    clientName: string;
    ptName: string;
    fmName: string;
    totalSessions: number;
    startDate: string | null;
    endDate: string | null;
    price: number;
  };
  /** Phần sửa tay đã lưu. */
  override: SheetOverride;
  /** Admin đã bật sửa phiếu chưa (Cài đặt → Cấp độ PT). */
  canEdit: boolean;
  /** Số tờ của bộ phiếu: gói 100 buổi ra 2 tờ, mỗi tờ 50 ô. */
  pageCount: number;
};

// ── Kích thước bản vẽ ────────────────────────────────────────────────────────
// Cỡ này in ra A4 vẫn đọc rõ chữ và nhìn được mặt người trong ảnh check-out.
const ROWS_PER_BLOCK = 25;
const COL_W = [70, 210, 140, 250, 290, 150]; // STT · Ngày · Giờ · Chữ ký · Ảnh · Cân nặng
const BLOCK_W = COL_W.reduce((a, b) => a + b, 0);
const W = BLOCK_W * 2;
const PAD = 40;
const HEADER_H = 200;
const HEAD_ROW_H = 78;
const ROW_H = 92;
// Khối thông tin hội viên cao 4 dòng × 48 = 192px kể từ mốc +46. INFO_H phải
// dôi ra kha khá so với con số đó, nếu không tiêu đề ô chữ ký dính ngay dưới
// dòng "GIÁ TRỊ GÓI TẬP".
const INFO_H = 340;
const SIGN_H = 340;
const H = HEADER_H + HEAD_ROW_H + ROWS_PER_BLOCK * ROW_H + INFO_H + SIGN_H;

const BRAND = "#f15b5c";
const LINE = "#e0a0a0";
const INK = "#1f2937";

/** "62,5" — số cân theo lối viết Việt, bỏ đuôi ",0" cho gọn cột. */
function fmtKg(kg: number): string {
  return (Math.round(kg * 10) / 10).toString().replace(".", ",");
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

// ── Chữ trên phiếu ──────────────────────────────────────────────────────────
//
// Phiếu phải viết bằng NUNITO như cả app, không phải font mặc định của máy.
// Canvas không ăn theo CSS nên trước đây mỗi lời gọi ctx.font đều ghi cứng
// "system-ui, sans-serif": tờ phiếu đổi mặt chữ theo máy người xem — Windows ra
// Segoe UI, máy Mac ra SF Pro — và không máy nào ra đúng mặt chữ của thương hiệu.
//
// next/font sinh ra một tên họ chữ băm sẵn (kiểu __Nunito_a1b2c3) và gắn vào
// biến CSS --font-nunito ở <body>. Đọc thẳng biến đó thay vì viết "Nunito":
// next/font tự host file chữ chứ không đăng ký tên "Nunito" toàn cục, nên gọi
// đúng tên gốc lại là chữ KHÔNG có.

const FALLBACK_FONT = "system-ui, sans-serif";

/** Họ chữ thật của phiếu, đọc từ biến CSS mà next/font đặt ở <body>. */
function sheetFontFamily(): string {
  if (typeof window === "undefined") return FALLBACK_FONT;
  const v = getComputedStyle(document.body).getPropertyValue("--font-nunito").trim();
  return v ? `${v}, ${FALLBACK_FONT}` : FALLBACK_FONT;
}

/**
 * Đợi Nunito nạp xong rồi mới vẽ.
 *
 * Canvas KHÔNG tự kích hoạt việc tải font: gọi ctx.font với một họ chữ chưa nạp
 * thì trình duyệt lặng lẽ vẽ bằng font thay thế, không báo lỗi gì. Mở phiếu ngay
 * lần đầu vào trang là dính đúng cảnh đó. Nạp trước cả ba kiểu đang dùng (thường,
 * đậm, nghiêng) vì mỗi kiểu là một file riêng.
 *
 * Không nạp được thì vẫn vẽ — tờ phiếu bằng font hệ thống còn hơn không có phiếu.
 */
async function ensureSheetFont(family: string): Promise<void> {
  if (family === FALLBACK_FONT || typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`400 21px ${family}`),
      document.fonts.load(`700 21px ${family}`),
      document.fonts.load(`italic 400 21px ${family}`),
    ]);
  } catch {
    // Bỏ qua: vẽ tiếp bằng thứ đang có.
  }
}

/**
 * Chốt lại họ chữ sau khi đã thử đặt thật vào canvas.
 *
 * ctx.font NUỐT LẶNG chuỗi sai: gán một giá trị không phân tích được thì nó giữ
 * nguyên giá trị cũ và không báo gì, nên cả tờ phiếu sẽ vẽ bằng "10px sans-serif"
 * mặc định — chữ tí xíu, không ai đoán ra vì sao. Gán thử rồi đọc lại: cỡ chữ
 * mình vừa yêu cầu còn đó thì chuỗi hợp lệ, không thì quay về font hệ thống.
 */
function usableFont(ctx: CanvasRenderingContext2D, family: string): string {
  const probe = `bold 46px ${family}`;
  const prev = ctx.font;
  ctx.font = probe;
  const ok = ctx.font.includes("46px");
  ctx.font = prev;
  return ok ? family : FALLBACK_FONT;
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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Tờ đang xem, đếm từ 0. */
  const [page, setPage] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async (): Promise<SheetData | null> => {
    const res = await fetch(`/api/clients/${clientId}/checkin-sheet?enrollmentId=${enrollmentId}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Không tải được phiếu check-in");
    return body as SheetData;
  }, [clientId, enrollmentId]);

  // ── Nạp dữ liệu ──────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const body = await load();
        if (alive && body) setData(body);
      } catch (e) {
        if (alive) setError((e as Error).message || "Có lỗi xảy ra khi tải phiếu");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [load]);

  /**
   * Lưu phần sửa tay rồi NẠP LẠI PHIẾU TỪ SERVER trước khi đóng trình sửa.
   *
   * Nạp lại chứ không tự vá dữ liệu đang giữ trên máy: phiếu in ra phải là bản
   * server dựng — số cân mang theo, thứ tự dòng sau khi đổi ngày, phần bị cắt vì
   * quá 50 dòng đều do server quyết. Vá ở client thì cái PT nhìn thấy sau khi
   * lưu có thể khác cái lần sau mở lại, và không ai biết bản nào mới đúng.
   */
  async function handleSave(next: SheetOverride) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/checkin-sheet`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, override: next }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Không lưu được phiếu");
      const fresh = await load();
      if (fresh) setData(fresh);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message || "Có lỗi xảy ra khi lưu phiếu");
    } finally {
      setSaving(false);
    }
  }

  // ── Vẽ phiếu ─────────────────────────────────────────────────────────────
  // Vẽ MỘT tờ của bộ phiếu. Mỗi tờ 50 ô và tự đứng được một mình — đủ tiêu đề,
  // khối thông tin hội viên và ba ô chữ ký — vì trên giấy mỗi tờ là một tờ ký
  // riêng. `page` đếm từ 0.
  const draw = useCallback(async (d: SheetData, pageIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Nunito phải có sẵn TRƯỚC nét chữ đầu tiên: canvas vẽ bằng thứ đang có tại
    // đúng lúc gọi ctx.fillText, nạp font sau đó thì bản vẽ không tự sửa lại.
    const family = sheetFontFamily();
    await ensureSheetFont(family);
    const font = usableFont(ctx, family);

    // Ô đầu tiên của tờ này trong cả bộ: tờ 2 bắt đầu từ ô thứ 51, và STT in ra
    // phải chạy tiếp 51…100 chứ không quay về 1 — nếu không, hai tờ của cùng một
    // lộ trình đọc lên như hai lộ trình khác nhau.
    const firstRow = pageIndex * ROWS_PER_SHEET;
    const pageRows = d.rows.slice(firstRow, firstRow + ROWS_PER_SHEET);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "middle";

    // Tiêu đề
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.font = `bold 46px ${font}`;
    ctx.fillText(`PHỤ LỤC HỢP ĐỒNG SỐ ${String(pageIndex + 1).padStart(2, "0")}`, W / 2, 56);
    ctx.font = `italic 24px ${font}`;
    ctx.fillStyle = "#6b7280";
    ctx.fillText(
      `(Đính kèm Hợp đồng huấn luyện viên cá nhân số ${d.contractCode ?? "................"})`,
      W / 2, 104
    );
    ctx.font = `bold 34px ${font}`;
    ctx.fillStyle = INK;
    ctx.fillText("PHIẾU CHECK-IN BUỔI TẬP", W / 2, 156);
    if (d.pageCount > 1) {
      ctx.font = `bold 22px ${font}`;
      ctx.fillStyle = BRAND;
      ctx.fillText(`Tờ ${pageIndex + 1}/${d.pageCount} · buổi ${firstRow + 1}–${firstRow + ROWS_PER_SHEET}`, W / 2, 186);
      ctx.fillStyle = INK;
    }

    // ── Bảng: 2 khối 25 dòng đặt cạnh nhau ─────────────────────────────────
    const HEAD = ["STT", "Ngày cung cấp dịch vụ", "Thời gian", "Chữ ký khách hàng", "Ảnh check-out của khách hàng", "Cân nặng (kg)"];
    const tableTop = HEADER_H;

    // Mốc x của từng cột trong cả hai khối
    const colX: number[] = [];
    let x = 0;
    for (let b = 0; b < 2; b++) for (const w of COL_W) { colX.push(x); x += w; }
    colX.push(W);

    // Hàng tiêu đề
    ctx.fillStyle = "#fdf2f2";
    ctx.fillRect(0, tableTop, W, HEAD_ROW_H);
    ctx.font = `bold 19px ${font}`;
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
    ctx.font = `21px ${font}`;
    for (let i = 0; i < ROWS_PER_BLOCK; i++) {
      const y = bodyTop + i * ROW_H;
      for (let b = 0; b < 2; b++) {
        const row = pageRows[i + b * ROWS_PER_BLOCK];
        const base = b * COL_W.length;
        ctx.fillStyle = INK;
        ctx.textAlign = "center";
        ctx.fillText(String(firstRow + i + 1 + b * ROWS_PER_BLOCK), colX[base] + COL_W[0] / 2, y + ROW_H / 2);
        if (row) {
          ctx.fillText(fmtDate(row.date), colX[base + 1] + COL_W[1] / 2, y + ROW_H / 2);
          ctx.fillText(sheetTime(row.checkOutAt), colX[base + 2] + COL_W[2] / 2, y + ROW_H / 2);
          if (row.weight != null) {
            // Số cân mang theo từ lần cân trước in nhạt + nghiêng: nhìn là biết
            // hôm đó khách không lên cân, chứ không phải cân ra đúng con số này.
            ctx.font = row.weightMeasured
              ? `bold 22px ${font}`
              : `italic 20px ${font}`;
            ctx.fillStyle = row.weightMeasured ? INK : "#9ca3af";
            ctx.fillText(fmtKg(row.weight), colX[base + 5] + COL_W[5] / 2, y + ROW_H / 2);
            ctx.font = `21px ${font}`;
            ctx.fillStyle = INK;
          }
        }
      }
    }

    // Ảnh chữ ký và ảnh check-out — nạp hết rồi vẽ, để không bị vẽ dở dang.
    const jobs: Promise<void>[] = [];
    for (let i = 0; i < ROWS_PER_BLOCK; i++) {
      const y = bodyTop + i * ROW_H;
      for (let b = 0; b < 2; b++) {
        const row = pageRows[i + b * ROWS_PER_BLOCK];
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
      ctx.font = `bold 23px ${font}`;
      ctx.fillStyle = INK;
      ctx.fillText(label, PAD, iy);
      ctx.font = `23px ${font}`;
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

    // Chú thích cho cột cân nặng — chỉ ghi khi phiếu thật sự có số cân mang
    // theo, để tờ nào cũng đúng với chính nó chứ không nói thừa.
    if (pageRows.some((r) => r.weight != null && !r.weightMeasured)) {
      ctx.font = `italic 19px ${font}`;
      ctx.fillStyle = "#9ca3af";
      ctx.fillText(
        "(*) Cân nặng in nhạt là số cân của lần cân gần nhất trước buổi, không phải số đo trong ngày tập.",
        PAD, iy + 4
      );
    }

    // ── Ba ô chữ ký ────────────────────────────────────────────────────────
    const signTop = tableBottom + INFO_H;
    const third = (W - PAD * 2) / 3;
    const NAME_Y = signTop + 210;
    const titles = ["Chữ ký khách hàng", "Chữ ký HLV", "Đại diện trung tâm"];
    ctx.textAlign = "center";
    titles.forEach((t, k) => {
      const cx = PAD + third * k + third / 2;
      ctx.font = `bold 25px ${font}`;
      ctx.fillStyle = INK;
      ctx.fillText(t, cx, signTop);
      ctx.font = `italic 20px ${font}`;
      ctx.fillStyle = "#6b7280";
      ctx.fillText("(Ký, ghi rõ họ tên)", cx, signTop + 34);
    });

    // Ô khách hàng dùng lại chính chữ ký khách đã ký lúc check-in — lấy buổi có
    // chữ ký SỚM NHẤT của lộ trình, để phiếu xuất lần nào cũng ra một bản giống
    // nhau thay vì đổi theo buổi mới nhất.
    const clientSig = d.rows.find((r) => r.signatureUrl)?.signatureUrl ?? null;
    const sigImg = await loadImage(clientSig);
    if (sigImg) {
      drawFitted(ctx, sigImg, PAD + 20, signTop + 52, third - 40, 130);
    }

    // Tên sẵn ở cả ba ô như tờ giấy vẫn ghi.
    ctx.font = `bold 24px ${font}`;
    ctx.fillStyle = INK;
    ctx.fillText(d.clientName, PAD + third / 2, NAME_Y);
    ctx.fillText(d.ptName, PAD + third + third / 2, NAME_Y);
    ctx.fillStyle = BRAND;
    ctx.fillText(d.fmName || "Fitness Manager", PAD + third * 2 + third / 2, NAME_Y);

    if (pageRows.length === 0) {
      ctx.font = `italic 24px ${font}`;
      ctx.fillStyle = "#9ca3af";
      ctx.fillText(
        pageIndex === 0
          ? "Lộ trình này chưa có buổi nào đã check-out."
          : "Tờ này chưa có buổi nào — để ký tiếp khi khách tập sang nửa sau lộ trình.",
        W / 2, bodyTop + 40
      );
    }
  }, []);

  // Sửa "Tổng số buổi tập" có thể làm bộ phiếu ngắn lại — đang đứng ở tờ 2 mà bộ
  // rút còn 1 tờ thì phải kéo về, không thì màn hình trống trơn không hiểu vì sao.
  const pageCount = data?.pageCount ?? 1;
  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  // Vẽ lại mỗi khi dữ liệu đổi, mỗi khi lật tờ, và mỗi khi rời trình sửa. Vế cuối
  // là bắt buộc: canvas bị gỡ khỏi màn hình lúc đang sửa, nên bấm Huỷ mà chỉ
  // trông vào `data` đổi thì phiếu quay lại là một tấm trắng. Lưu xong thì `data`
  // đã là bản mới server dựng, nên đúng cái PT vừa sửa hiện ngay trên phiếu.
  useEffect(() => {
    if (data && !editing) draw(data, page);
  }, [data, editing, page, draw]);

  /** Tên file, bỏ dấu cho mọi hệ điều hành mở được. */
  function fileName(d: SheetData, pageIndex: number): string {
    const safe = d.clientName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const suffix = d.pageCount > 1 ? `-to-${pageIndex + 1}` : "";
    return `Phieu-check-in-${safe}-${packageName}${suffix}.png`;
  }

  function saveCanvas(canvas: HTMLCanvasElement, name: string): Promise<void> {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      }, "image/png");
    });
  }

  /**
   * Tải CẢ BỘ phiếu, mỗi tờ một ảnh.
   *
   * Vẽ lần lượt từng tờ lên chính canvas đang hiện rồi lưu ngay — vẫn giữ đúng
   * luật cũ "cái tải về là cái đang nhìn thấy", chỉ là nhìn thấy lần lượt. Tải
   * mỗi tờ đang mở thì PT xuất thiếu tờ lúc nào không biết, mà bộ phiếu thiếu
   * một tờ là phụ lục hợp đồng thiếu một nửa số buổi.
   *
   * Xong thì trả canvas về đúng tờ PT đang xem.
   */
  async function download() {
    const canvas = canvasRef.current;
    if (!canvas || !data || downloading) return;
    setDownloading(true);
    try {
      for (let p = 0; p < data.pageCount; p++) {
        await draw(data, p);
        await saveCanvas(canvas, fileName(data, p));
      }
    } finally {
      if (canvasRef.current) await draw(data, page);
      setDownloading(false);
    }
  }

  const doneCount   = data?.rows.length ?? 0;
  const manualCount = data?.rows.filter((r) => r.manual).length ?? 0;
  const appCount    = doneCount - manualCount;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-base font-extrabold text-gray-900">
              {editing ? "Sửa phiếu check-in" : "Phiếu check-in buổi tập"}
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold text-gray-400">
              {data
                ? `${data.clientName} · gói ${data.packageName} · ${appCount}/${data.totalSessions} buổi đã check-out`
                  + (manualCount > 0 ? ` · ${manualCount} buổi ghi tay` : "")
                  + (pageCount > 1 ? ` · ${pageCount} tờ` : "")
                : "Đang tải…"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {/* Cây bút chỉ hiện khi Admin đã bật ở Cài đặt → Cấp độ PT. */}
            {data?.canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-[#fff0f0] hover:text-[#f15b5c]"
                title="Sửa phiếu check-in"
                aria-label="Sửa phiếu check-in"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-gray-100 p-4">
          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm font-bold text-red-500">
              {error}
            </p>
          )}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-24 text-sm font-semibold text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang dựng phiếu…
            </div>
          ) : editing && data ? (
            <CheckinSheetEditor
              rows={data.rows}
              original={data.original}
              override={data.override ?? EMPTY_OVERRIDE}
              capacity={pageCount * ROWS_PER_SHEET}
              saving={saving}
              onCancel={() => { setError(""); setEditing(false); }}
              onSave={handleSave}
            />
          ) : data ? (
            <>
              {/* Thanh lật tờ — chỉ hiện khi bộ phiếu có nhiều hơn một tờ. */}
              {pageCount > 1 && (
                <div className="mx-auto mb-3 flex max-w-4xl items-center justify-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0 || downloading}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-600 transition-colors hover:border-[#f15b5c] hover:text-[#f15b5c] disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-600"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Tờ trước
                  </button>
                  <span className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-sm">
                    Tờ {page + 1}/{pageCount}
                    <span className="ml-1.5 font-semibold text-gray-400">
                      buổi {page * ROWS_PER_SHEET + 1}–{(page + 1) * ROWS_PER_SHEET}
                    </span>
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={page >= pageCount - 1 || downloading}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-600 transition-colors hover:border-[#f15b5c] hover:text-[#f15b5c] disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-600"
                  >
                    Tờ sau
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <canvas
                ref={canvasRef}
                className="mx-auto block h-auto w-full max-w-full rounded-lg bg-white shadow-sm"
              />
            </>
          ) : null}
        </div>

        {/* Trên điện thoại: hai nút chiếm trọn một hàng, câu hướng dẫn xuống hàng
            riêng bên dưới (order-last + basis-full). Màn rộng thì nó về đúng chỗ
            cũ, nằm giữa hai nút. Vẫn là MỘT thẻ chữ, không nhân đôi câu chữ.
            Lúc đang sửa thì ẩn đi: trình sửa có cặp nút Lưu/Huỷ của nó, và tải
            ảnh khi chưa lưu sẽ ra tờ phiếu cũ chứ không phải cái đang sửa. */}
        {!editing && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-gray-100 px-5 py-4">
            <button
              onClick={download}
              disabled={loading || !data || downloading}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-40 sm:flex-none sm:justify-start"
              style={{ backgroundColor: BRAND }}
            >
              {downloading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Download className="h-4 w-4" />}
              {pageCount > 1 ? `Tải cả ${pageCount} tờ` : "Tải ảnh phiếu"}
            </button>
            <p className="order-last basis-full text-xs leading-snug text-gray-400 sm:order-none sm:min-w-0 sm:flex-1 sm:basis-auto">
              {pageCount > 1
                ? `Tải về ${pageCount} ảnh PNG — mỗi tờ một ảnh — để lưu vào hồ sơ lương của buổi dạy.`
                : "Tải về dạng ảnh PNG để lưu vào hồ sơ lương của buổi dạy."}
            </p>
            <button
              onClick={onClose}
              disabled={downloading}
              className="h-11 shrink-0 rounded-xl border border-gray-200 px-5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
