"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Trophy } from "lucide-react";

type TransformPhoto = {
  id:            string;
  weightBefore:  number;
  weightAfter:   number;
  durationMonths: number;
  imageUrl:      string;
};

// ── Filter definitions ──────────────────────────────────────────────────

type WeightFilter = { label: string; weightMin?: number; weightMax?: number };
type DurationFilter = { label: string; durationMin?: number; durationMax?: number };

const WEIGHT_FILTERS: WeightFilter[] = [
  { label: "Tất cả" },
  { label: "Dưới 60kg",  weightMax: 60 },
  { label: "60 - 70kg",  weightMin: 60,  weightMax: 70 },
  { label: "70 - 80kg",  weightMin: 70,  weightMax: 80 },
  { label: "80 - 90kg",  weightMin: 80,  weightMax: 90 },
  { label: "Trên 90kg",  weightMin: 90 },
];

const DURATION_FILTERS: DurationFilter[] = [
  { label: "Tất cả" },
  { label: "1 - 3 tháng",   durationMin: 1,  durationMax: 3  },
  { label: "3 - 6 tháng",   durationMin: 4,  durationMax: 6  },
  { label: "6 - 12 tháng",  durationMin: 7,  durationMax: 12 },
  { label: "Trên 12 tháng", durationMin: 13 },
];

// ── Lightbox ────────────────────────────────────────────────────────────

function Lightbox({
  photos,
  index,
  onClose,
}: {
  photos:  TransformPhoto[];
  index:   number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(index);
  const photo = photos[current];

  const prev = useCallback(() => setCurrent((i) => Math.max(0, i - 1)),  []);
  const next = useCallback(() => setCurrent((i) => Math.min(photos.length - 1, i + 1)), [photos.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")      onClose();
      if (e.key === "ArrowLeft")   prev();
      if (e.key === "ArrowRight")  next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  if (!photo) return null;
  const kgLost = photo.weightBefore - photo.weightAfter;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.88)" }}
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
        onClick={onClose}
      >
        <X className="w-7 h-7" />
      </button>

      {/* Counter */}
      <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm font-semibold">
        {current + 1} / {photos.length}
      </span>

      {/* Prev */}
      {current > 0 && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors p-2"
          onClick={(e) => { e.stopPropagation(); prev(); }}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {/* Image */}
      <div
        className="relative max-h-[80vh] max-w-[60vw] min-w-[260px]"
        style={{ aspectRatio: "3/4" }}
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={photo.imageUrl}
          alt={`Transform -${kgLost.toFixed(0)}kg`}
          fill
          className="object-contain"
          sizes="60vw"
        />
        {/* Info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-4 rounded-b-xl">
          <p className="text-white font-extrabold text-base">
            −{kgLost.toFixed(1)} kg trong {photo.durationMonths} tháng
          </p>
          <p className="text-white/70 text-sm mt-0.5">
            {photo.weightBefore} kg → {photo.weightAfter} kg
          </p>
        </div>
      </div>

      {/* Next */}
      {current < photos.length - 1 && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors p-2"
          onClick={(e) => { e.stopPropagation(); next(); }}
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export function TransformGallery() {
  const [weightIdx,   setWeightIdx]   = useState(0);
  const [durationIdx, setDurationIdx] = useState(0);
  const [photos,      setPhotos]      = useState<TransformPhoto[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [total,       setTotal]       = useState<number | null>(null); // total ever loaded (to detect empty DB)
  const [lightbox,    setLightbox]    = useState<number | null>(null);

  const wf = WEIGHT_FILTERS[weightIdx];
  const df = DURATION_FILTERS[durationIdx];

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (wf.weightMin   !== undefined) p.set("weightMin",   String(wf.weightMin));
    if (wf.weightMax   !== undefined) p.set("weightMax",   String(wf.weightMax));
    if (df.durationMin !== undefined) p.set("durationMin", String(df.durationMin));
    if (df.durationMax !== undefined) p.set("durationMax", String(df.durationMax));

    fetch(`/api/transform-photos?${p}`)
      .then((r) => r.json())
      .then((data: TransformPhoto[]) => {
        setPhotos(data);
        if (total === null || (weightIdx === 0 && durationIdx === 0)) {
          setTotal(data.length);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightIdx, durationIdx]);

  const hasAny = total !== null && total > 0;

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
        <p className="text-sm font-extrabold text-gray-800">Kết quả thực tế tại Ladysfit</p>
      </div>
      <p className="text-xs text-gray-400 font-semibold mb-4">Hình ảnh khách hàng đã transform</p>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <select
          value={weightIdx}
          onChange={(e) => setWeightIdx(Number(e.target.value))}
          className="flex-1 h-8 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white px-2 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 cursor-pointer"
        >
          {WEIGHT_FILTERS.map((f, i) => (
            <option key={i} value={i}>{f.label}</option>
          ))}
        </select>
        <select
          value={durationIdx}
          onChange={(e) => setDurationIdx(Number(e.target.value))}
          className="flex-1 h-8 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white px-2 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 cursor-pointer"
        >
          {DURATION_FILTERS.map((f, i) => (
            <option key={i} value={i}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400 animate-pulse">Đang tải...</div>
      ) : !hasAny ? (
        <div className="py-10 text-center">
          <Trophy className="w-8 h-8 text-gray-100 mx-auto mb-2" />
          <p className="text-xs text-gray-300 font-semibold">
            Admin chưa thêm ảnh transform.
          </p>
          <p className="text-xs text-gray-300">Vào Cài đặt để thêm ảnh.</p>
        </div>
      ) : photos.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-xs text-gray-400 font-semibold italic">
            Chưa có ảnh transform phù hợp với bộ lọc này
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, i) => {
            const kgLost = photo.weightBefore - photo.weightAfter;
            return (
              <button
                key={photo.id}
                onClick={() => setLightbox(i)}
                className="group text-left focus:outline-none"
              >
                {/* Image */}
                <div
                  className="relative w-full overflow-hidden rounded-xl bg-gray-100"
                  style={{ aspectRatio: "3/4" }}
                >
                  <Image
                    src={photo.imageUrl}
                    alt={`Transform -${kgLost.toFixed(0)}kg`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 768px) 30vw, 15vw"
                  />
                  {/* Badge */}
                  <div
                    className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-white text-[10px] font-extrabold leading-tight"
                    style={{ backgroundColor: "#f15b5c" }}
                  >
                    −{kgLost.toFixed(0)} kg
                  </div>
                </div>
                {/* Stats */}
                <div className="mt-1.5 px-0.5">
                  <p className="text-[11px] font-extrabold leading-tight" style={{ color: "#f15b5c" }}>
                    −{kgLost.toFixed(1)} kg trong {photo.durationMonths} tháng
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                    {photo.weightBefore} → {photo.weightAfter} kg
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {lightbox !== null && (
        <Lightbox
          photos={photos}
          index={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
