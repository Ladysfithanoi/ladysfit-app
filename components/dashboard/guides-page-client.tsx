"use client";

import { useState, useEffect, useCallback } from "react";
import { PlayCircle, X, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type UserGuide = {
  id: string;
  title: string;
  category: string;
  youtubeUrl: string;
  order: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  LEAD:        "Setup Doanh số",
  KPI:         "Mục tiêu & KPI",
  GIAO_AN:     "Giáo án / Bài tập",
  KHACH_HANG:  "Quản lý Khách hàng",
  CAI_DAT:     "Cài đặt hệ thống",
  KHAC:        "Khác",
};

const CATEGORY_COLORS: Record<string, string> = {
  LEAD:       "bg-emerald-50 text-emerald-700 border-emerald-200",
  KPI:        "bg-blue-50 text-blue-700 border-blue-200",
  GIAO_AN:    "bg-purple-50 text-purple-700 border-purple-200",
  KHACH_HANG: "bg-amber-50 text-amber-700 border-amber-200",
  CAI_DAT:    "bg-gray-50 text-gray-700 border-gray-200",
  KHAC:       "bg-rose-50 text-rose-700 border-rose-200",
};

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function YouTubeThumbnail({ url, title }: { url: string; title: string }) {
  const vid = extractYouTubeId(url);
  if (!vid) return (
    <div className="w-full aspect-video bg-gray-100 flex items-center justify-center rounded-xl">
      <PlayCircle className="w-10 h-10 text-gray-300" />
    </div>
  );
  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
      <img
        src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`}
        alt={title}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors">
        <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
          <PlayCircle className="w-9 h-9 text-[#f15b5c]" />
        </div>
      </div>
    </div>
  );
}

export function GuidesPageClient() {
  const [guides, setGuides]           = useState<UserGuide[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [playing, setPlaying]         = useState<UserGuide | null>(null);

  const fetchGuides = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user-guides");
      if (res.ok) setGuides(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGuides(); }, [fetchGuides]);

  const categories = ["ALL", ...Array.from(new Set(guides.map((g) => g.category)))];

  const visible = activeCategory === "ALL"
    ? guides
    : guides.filter((g) => g.category === activeCategory);

  const playingVidId = playing ? extractYouTubeId(playing.youtubeUrl) : null;

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <BookOpen className="w-6 h-6 text-[#f15b5c]" />
          <h1 className="text-xl font-extrabold text-gray-900">Hướng dẫn sử dụng</h1>
        </div>
        <p className="text-sm text-gray-400">Video hướng dẫn vận hành hệ thống LOTS</p>
      </div>

      {/* Category filter tabs */}
      {!loading && guides.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-6">
          {categories.map((cat) => {
            const label = cat === "ALL" ? "Tất cả" : (CATEGORY_LABELS[cat] ?? cat);
            const count = cat === "ALL" ? guides.length : guides.filter((g) => g.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all",
                  activeCategory === cat
                    ? "bg-[#f15b5c] text-white border-[#f15b5c] shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                )}
              >
                {label}
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full font-bold",
                  activeCategory === cat ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Guide grid */}
      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Đang tải...</div>
      ) : visible.length === 0 ? (
        <div className="py-20 text-center">
          <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-300">
            {guides.length === 0
              ? "Chưa có bài hướng dẫn nào. Admin sẽ cập nhật sớm."
              : "Không có bài hướng dẫn trong danh mục này"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map((guide) => (
            <div
              key={guide.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setPlaying(guide)}
            >
              <YouTubeThumbnail url={guide.youtubeUrl} title={guide.title} />
              <div className="p-4">
                <span className={cn(
                  "inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border mb-2",
                  CATEGORY_COLORS[guide.category] ?? "bg-gray-50 text-gray-600 border-gray-200"
                )}>
                  {CATEGORY_LABELS[guide.category] ?? guide.category}
                </span>
                <h3 className="text-sm font-bold text-gray-800 leading-snug line-clamp-2">
                  {guide.title}
                </h3>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video player modal */}
      {playing && playingVidId && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setPlaying(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex-1 pr-4">
                  <span className={cn(
                    "inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border mb-1",
                    CATEGORY_COLORS[playing.category] ?? "bg-gray-50 text-gray-600 border-gray-200"
                  )}>
                    {CATEGORY_LABELS[playing.category] ?? playing.category}
                  </span>
                  <h2 className="text-base font-bold text-gray-900">{playing.title}</h2>
                </div>
                <button
                  onClick={() => setPlaying(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  key={playingVidId}
                  src={`https://www.youtube.com/embed/${playingVidId}?autoplay=1&modestbranding=1&rel=0&controls=1`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                  title={playing.title}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
