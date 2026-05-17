"use client";

import { useState, useEffect, useCallback } from "react";
import { PlayCircle, X, BookOpen } from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

type UserGuide = {
  id: string;
  title: string;
  roleGroup: string;
  category: string;
  youtubeUrl: string;
  order: number;
};

function allowedRoleGroups(role: string | undefined): string[] {
  switch (role) {
    case "ADMIN":          return ["CEO", "COO", "FM", "PT"];
    case "COO":            return ["COO", "FM", "PT"];
    case "FM":             return ["FM", "PT"];
    case "CEO_FITPARTNER": return ["CEO"];
    case "PT":             return ["PT"];
    default:               return ["PT"];
  }
}

const ROLE_GROUP_ORDER = ["CEO", "COO", "FM", "PT"];

const ROLE_GROUP_COLORS: Record<string, { tab: string; badge: string }> = {
  CEO: {
    tab:   "bg-violet-50 text-violet-700 border-violet-200",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
  },
  COO: {
    tab:   "bg-blue-50 text-blue-700 border-blue-200",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  FM: {
    tab:   "bg-emerald-50 text-emerald-700 border-emerald-200",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  PT: {
    tab:   "bg-amber-50 text-amber-700 border-amber-200",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
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
  const { data: session } = useSession();
  const role = session?.user?.role;

  const [guides, setGuides]     = useState<UserGuide[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeRG, setActiveRG] = useState<string>("");
  const [playing, setPlaying]   = useState<UserGuide | null>(null);

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

  // Determine which roleGroup tabs this user can see, intersected with what exists in DB
  const allowed   = allowedRoleGroups(role);
  const available = ROLE_GROUP_ORDER.filter(
    (rg) => allowed.includes(rg) && guides.some((g) => g.roleGroup === rg)
  );

  // Auto-select first available tab after data loads
  useEffect(() => {
    if (!loading && available.length > 0 && !available.includes(activeRG)) {
      setActiveRG(available[0]);
    }
  }, [loading, available.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guides in the active roleGroup tab
  const tabGuides = guides.filter((g) => g.roleGroup === activeRG);

  // Sub-group by category (preserve insertion order, respecting `order` field)
  const categoryGroups: { cat: string; guides: UserGuide[] }[] = [];
  const seen = new Set<string>();
  for (const g of tabGuides) {
    if (!seen.has(g.category)) {
      seen.add(g.category);
      categoryGroups.push({ cat: g.category, guides: [] });
    }
    categoryGroups.find((c) => c.cat === g.category)!.guides.push(g);
  }

  const playingVidId = playing ? extractYouTubeId(playing.youtubeUrl) : null;
  const colors       = ROLE_GROUP_COLORS[activeRG];

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

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Đang tải...</div>
      ) : guides.length === 0 ? (
        <div className="py-20 text-center">
          <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-300">Chưa có bài hướng dẫn nào. Admin sẽ cập nhật sớm.</p>
        </div>
      ) : (
        <>
          {/* Tier 1 — RoleGroup tabs */}
          {available.length > 1 && (
            <div className="flex gap-2 flex-wrap mb-6">
              {available.map((rg) => {
                const count = guides.filter((g) => g.roleGroup === rg).length;
                const isActive = rg === activeRG;
                return (
                  <button
                    key={rg}
                    onClick={() => setActiveRG(rg)}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all",
                      isActive
                        ? "bg-[#f15b5c] text-white border-[#f15b5c] shadow-sm"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                    )}
                  >
                    {rg}
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full font-bold",
                      isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Tier 2 — Category groups within active tab */}
          {categoryGroups.length === 0 ? (
            <div className="py-20 text-center">
              <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-300">Không có bài hướng dẫn trong mục này</p>
            </div>
          ) : (
            <div className="space-y-8">
              {categoryGroups.map(({ cat, guides: catGuides }) => (
                <div key={cat}>
                  {/* Category header */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className={cn(
                      "inline-block text-xs font-bold px-3 py-1 rounded-full border",
                      colors?.badge ?? "bg-gray-50 text-gray-600 border-gray-200"
                    )}>
                      {cat}
                    </span>
                    <span className="text-xs text-gray-400">{catGuides.length} bài</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  {/* Guide cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {catGuides.map((guide) => (
                      <div
                        key={guide.id}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => setPlaying(guide)}
                      >
                        <YouTubeThumbnail url={guide.youtubeUrl} title={guide.title} />
                        <div className="p-4">
                          <h3 className="text-sm font-bold text-gray-800 leading-snug line-clamp-2">
                            {guide.title}
                          </h3>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Video player modal */}
      {playing && playingVidId && (
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
                  ROLE_GROUP_COLORS[playing.roleGroup]?.badge ?? "bg-gray-50 text-gray-600 border-gray-200"
                )}>
                  {playing.roleGroup} · {playing.category}
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
      )}
    </div>
  );
}
