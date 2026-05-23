"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Auto-saves `data` to localStorage under `key` using an 800ms debounce.
 * Only fires when `enabled` is true (pass `false` during loading / read-only).
 * Returns `clearDraft()` — call it after a successful API save.
 */
export function useFormAutoSave<T>(
  key: string,
  data: T,
  enabled: boolean = true
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Serialize once per render for stable dep comparison.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const serialized = JSON.stringify(data);

  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, serialized);
      } catch {
        // localStorage unavailable (SSR, private browsing quota)
      }
    }, 800);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, serialized, enabled]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {}
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [key]);

  return { clearDraft };
}

/** Read a draft from localStorage without using a hook (safe to call inside callbacks). */
export function loadDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
