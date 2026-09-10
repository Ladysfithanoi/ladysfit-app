"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Sự kiện Chrome bắn ra khi trang đủ điều kiện cài. TypeScript chưa có sẵn kiểu này.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ladysfit-pwa-dismissed-until";
const DISMISS_DAYS = 14;

function dismissedRecently() {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() < until;
  } catch {
    // Chế độ ẩn danh có thể chặn localStorage — cứ coi như chưa từ chối.
    return false;
  }
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS dùng cờ riêng, không theo chuẩn display-mode.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/**
 * Mời cài Ladysfit vào màn hình chính điện thoại.
 *
 * Android/Chrome bắn sự kiện `beforeinstallprompt` → hiện nút "Cài đặt" bấm phát
 * là xong. Safari trên iPhone không có sự kiện đó, cài chỉ qua menu Chia sẻ, nên
 * ở iOS ta hiện hướng dẫn hai bước thay vì nút bấm.
 */
export function PwaInstall() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    // Đăng ký service worker (Chrome đòi có thì mới cho cài).
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Không đăng ký được thì app vẫn chạy bình thường, chỉ là không cài được.
      });
    }

    if (isStandalone() || dismissedRecently()) return;

    const onPrompt = (event: Event) => {
      // Chặn thanh mời mặc định của Chrome để dùng banner của mình.
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iPhone: không có sự kiện nào để chờ, tự hiện hướng dẫn.
    if (isIos()) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const close = () => {
    try {
      localStorage.setItem(
        DISMISS_KEY,
        String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000)
      );
    } catch {
      // Không lưu được thì lần sau hỏi lại, chấp nhận được.
    }
    setPrompt(null);
    setShowIosHint(false);
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    // Dù đồng ý hay không, sự kiện chỉ dùng được một lần.
    setPrompt(null);
  };

  if (!prompt && !showIosHint) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-md items-start gap-3 rounded-xl border border-border bg-white p-3 shadow-lg">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={44}
          height={44}
          className="mt-0.5 shrink-0 rounded-lg"
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Cài Ladysfit vào điện thoại
          </p>

          {prompt ? (
            <>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Mở thẳng từ màn hình chính, không cần vào trình duyệt nữa.
              </p>
              <Button size="sm" className="mt-2.5" onClick={install}>
                <Download className="h-4 w-4" />
                Cài đặt
              </Button>
            </>
          ) : (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Bấm nút Chia sẻ{" "}
              <Share className="inline h-3.5 w-3.5 align-[-2px]" /> ở thanh dưới
              Safari, rồi chọn{" "}
              <span className="font-medium text-foreground">
                Thêm vào MH chính
              </span>
              .
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={close}
          aria-label="Để sau"
          className="-mr-1 -mt-1 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
