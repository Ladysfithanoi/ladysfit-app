"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Teacher = { id: string; name: string };

/** Bỏ dấu + chữ thường: gõ "mai ly" hay "MAI LY" đều ra "Vũ Mai Ly". */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase().trim();
}

/**
 * Ô chọn HLV có tìm kiếm — thay cho <select> liệt kê cả trăm nhân sự.
 *
 * `suggestedIds` (người đã dạy khách này) nổi lên đầu danh sách, nên đa số lần
 * chọn chỉ cần một cú bấm. Danh sách xổ xuống dùng position: fixed (z-90, trên phiếu check-in z-80) vì ô nằm trong
 * bảng cuộn ngang — absolute sẽ bị khung bảng cắt mất.
 */
export function TeacherPicker({
  teachers,
  value,
  fallbackName,
  suggestedIds,
  onChange,
  className,
}: {
  teachers: Teacher[];
  value: string;
  /** Tên hiển thị khi `value` không còn trong danh sách (HLV đã nghỉ). */
  fallbackName?: string;
  suggestedIds: string[];
  onChange: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = teachers.find((t) => t.id === value);
  const label = value === "" ? "— Không rõ —" : selected?.name ?? (fallbackName || "HLV không còn trong hệ thống");

  // Danh sách hiện ra: "Không rõ" + người gợi ý (đã dạy khách) + những người còn lại.
  const options = useMemo(() => {
    const q = fold(query);
    const match = (t: Teacher) => q === "" || fold(t.name).includes(q);
    const suggested = suggestedIds
      .map((id) => teachers.find((t) => t.id === id))
      .filter((t): t is Teacher => !!t && match(t));
    const suggestedSet = new Set(suggested.map((t) => t.id));
    const rest = teachers.filter((t) => !suggestedSet.has(t.id) && match(t));
    return {
      list: [
        ...(q === "" ? [{ id: "", name: "— Không rõ —" }] : []),
        ...suggested,
        ...rest,
      ],
      suggestedCount: suggested.length,
    };
  }, [teachers, suggestedIds, query]);

  function place() {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    const spaceBelow = window.innerHeight - r.bottom;
    const up = spaceBelow < 280 && r.top > spaceBelow;
    setPos({ left: r.left, top: up ? r.top : r.bottom, width: Math.max(r.width, 220), up });
  }

  // Đóng là xoá chữ đang gõ, nên lúc mở `options` đã là danh sách đầy đủ.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function openList() {
    place();
    const idx = options.list.findIndex((t) => t.id === value);
    setActive(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  // Bấm ra ngoài / cuộn trang thì đóng — danh sách fixed sẽ trôi lệch khỏi ô.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!boxRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Giữ dòng đang chọn bằng phím trong tầm nhìn.
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const t = options.list[active];
      if (t) pick(t.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      {open ? (
        <div className={cn(className, "flex items-center gap-1 ring-2 ring-[#f15b5c]/40")}>
          <Search className="h-3 w-3 flex-shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            placeholder="Gõ tên HLV…"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="text-gray-300 hover:text-gray-500">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={openList}
          className={cn(className, "flex items-center justify-between gap-1 text-left")}
          title={label}
        >
          <span className={cn("truncate", value === "" && "text-gray-400")}>{label}</span>
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-gray-400" />
        </button>
      )}

      {open && pos && (
        <div
          ref={listRef}
          className="fixed z-[90] max-h-64 overflow-y-auto rounded-xl border border-gray-100 bg-white py-1 shadow-xl"
          style={{
            left: pos.left,
            width: pos.width,
            ...(pos.up ? { bottom: window.innerHeight - pos.top + 4 } : { top: pos.top + 4 }),
          }}
        >
          {options.list.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">Không tìm thấy HLV nào</p>
          )}
          {options.list.map((t, idx) => {
            const isSuggested = t.id !== "" && idx < (query === "" ? 1 : 0) + options.suggestedCount;
            const firstRest = idx === (query === "" ? 1 : 0) + options.suggestedCount && options.suggestedCount > 0;
            return (
              <div key={t.id || "none"}>
                {isSuggested && idx === (query === "" ? 1 : 0) && (
                  <p className="px-3 pb-0.5 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-[#f15b5c]">Đã dạy khách này</p>
                )}
                {firstRest && (
                  <p className="mt-1 border-t border-gray-100 px-3 pb-0.5 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">Nhân sự khác</p>
                )}
                <button
                  type="button"
                  data-idx={idx}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => pick(t.id)}
                  className={cn(
                    "block w-full truncate px-3 py-1.5 text-left text-xs",
                    idx === active ? "bg-[#f15b5c]/10 text-gray-900" : "text-gray-700",
                    t.id === value && "font-bold",
                    t.id === "" && "text-gray-400",
                  )}
                >
                  {t.name}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
