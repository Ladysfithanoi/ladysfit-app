"use client";

import { useEffect } from "react";
import { Button } from "./button";

interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: "danger" | "default";
  loading?: boolean;
}

export function AlertDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  onConfirm,
  variant = "default",
  loading = false,
}: AlertDialogProps) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-base font-extrabold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed whitespace-pre-line">{description}</p>
        <div className="flex gap-3">
          {variant === "danger" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="flex-1 h-10 rounded-xl px-5"
              >
                {cancelLabel}
              </Button>
              <Button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 h-10 rounded-xl text-white font-semibold"
                style={{ backgroundColor: "#ef4444" }}
              >
                {loading ? "Đang xử lý..." : confirmLabel}
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 h-10 rounded-xl text-white font-semibold"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {loading ? "Đang xử lý..." : confirmLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="h-10 rounded-xl px-5"
              >
                {cancelLabel}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
