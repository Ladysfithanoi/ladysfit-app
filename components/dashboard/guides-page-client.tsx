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

// Which roleGroup tabs each system role can see
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

const RG_STYLE: Record<string, { active: string; inactive: string; catActive: string }> = {
  CEO: {
    active:    "bg-violet-600 text-white border-violet-600 shadow-sm",
    inactive:  "bg-white text-violet-700 border-violet-200 hover:border-violet-300 hover:bg-violet-50",
    catActive: "bg-violet-600 text-white border-violet-600",
  },
  COO: {
    active:    "bg-blue-600 text-white border-blue-600 shadow-sm",
    inactive:  "bg-white text-blue-700 border-blue-200 hover:border-blue-300 hover:bg-blue-50",
    catActive: "bg-blue-600 text-white border-blue-600",
  },
  FM: {
    active:    "bg-emerald-600 text-white border-emerald-600 shadow-sm",
    inactive:  "bg-white text-emerald-700 border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50",
    catActive: "bg-emerald-600 text-white border-emerald-600",
  },
  PT: {
    active:    "bg-amber-500 text-white border-amber-500 shadow-sm",
    inactive:  "bg-white text-amber-700 border-amber-200 hover:border-amber-300 hover:bg-amber-50",
    catActive: "bg-amber-500 text-white border-amber-500",
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
  const [activeCat, setActiveCat] = useState<string>("");
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

  // Tier 1 tabs: all roleGroups this user is allowed to see, in fixed order
  const roleGroupTabs = ROLE_GROUP_ORDER.filter((rg) => allowedRoleGroups(role).includes(rg));

  // Auto-select the first roleGroup tab when session resolves
  useEffect(() => {
    if (roleGroupTabs.length > 0 && !roleGroupTabs.includes(activeRG)) {
      setActiveRG(roleGroupTabs[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleGroupTabs.join(",")]);

  // Guides belonging to the active roleGroup
  const rgGuides = guides.filter((g) => g.roleGroup === activeRG);

  // Ordered unique categories within the active roleGroup
  const categories: string[] = [];
  const seenCats = new Set<string>();
  for (const g of rgGuides) {
    if (!seenCats.has(g.category)) { seenCats.add(g.category); categories.push(g.category); }
  }

  // Auto-select first category when roleGroup changes or categories update
  useEffect(() => {
    if (categories.length > 0 && !categories.includes(activeCat)) {
      setActiveCat(categories[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRG, categories.join(",")]);

  // Final guides grid: filtered by both active roleGroup and category
  const shownGuides = rgGuides.filter((g) => g.category === activeCat);

  const style = RG_STYLE[activeRG] ?? RG_STYLE.PT;
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

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Đang tải...</div>
      ) : (
        <>
          {/* ── TẦNG 1: Role group tabs ─────────────────────────────── */}
          <div className="flex gap-2 flex-wrap mb-5">
            {roleGroupTabs.map((rg) => {
              const count = guides.filter((g) => g.roleGroup === rg).length;
              const isActive = rg === activeRG;
              const s = RG_STYLE[rg];
              return (
                <button
                  key={rg}
                  onClick={() => { setActiveRG(rg); setActiveCat(""); }}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-extrabold border transition-all",
                    isActive ? s.active : s.inactive
                  )}
                >
                  {rg}
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full font-bold leading-none",
                    isActive ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── TẦNG 2: Category sub-tabs ───────────────────────────── */}
          {categories.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-6 pb-4 border-b border-gray-100">
              {categories.map((cat) => {
                const isActive = cat === activeCat;
                const catCount = rgGuides.filter((g) => g.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCat(cat)}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold border transition-all",
                      isActive
                        ? style.catActive
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                    )}
                  >
                    {cat}
                    <span className={cn(
                      "text-[10px] px-1 py-0.5 rounded-full font-bold leading-none",
                      isActive ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500"
                    )}>
                      {catCount}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Guide cards ─────────────────────────────────────────── */}
          {shownGuides.length === 0 ? (
            <div className="py-20 text-center">
              <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-300">
                {rgGuides.length === 0
                  ? "Chưa có bài hướng dẫn cho nhóm này. Admin sẽ cập nhật sớm."
                  : "Không có bài hướng dẫn trong danh mục này."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {shownGuides.map((guide) => (
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
          )}
        </>
      )}

      {/* ── Video player modal ──────────────────────────────────────── */}
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
                  RG_STYLE[playing.roleGroup]?.catActive ?? "bg-gray-50 text-gray-600 border-gray-200"
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
