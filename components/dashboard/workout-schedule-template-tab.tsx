"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  sessionTypes: string[];
};
type MovementTemplate = {
  id: string;
  phaseKey: string;
  sessionType: string;
  movement: string;
};
type ScheduleRow = {
  phaseKey: string;
  sessionType: string;
  movement: string;
  exercise: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

// Base phase (bỏ hậu tố ": Skinny Fat") để tra thư viện bài tập, vì bài tập lưu
// theo giai đoạn gốc.
function basePhase(name: string): string {
  return name.split(":")[0].trim();
}

const rowKey = (phaseKey: string, sessionType: string, movement: string) =>
  `${phaseKey}|||${sessionType}|||${movement}`;

// Lấy danh sách bài tập của (giai đoạn gốc, chuyển động) TỪ "Danh sách bài tập".
// Không cache lâu dài để mỗi lần mở trang luôn phản ánh đúng thư viện hiện tại.
async function fetchExerciseNames(phaseName: string, movement: string): Promise<string[]> {
  const base = basePhase(phaseName);
  try {
    const res = await fetch(
      `/api/exercises?phase=${encodeURIComponent(base)}&movement=${encodeURIComponent(movement)}`
    );
    if (!res.ok) return [];
    const data: { name: string }[] = await res.json();
    return Array.isArray(data) ? Array.from(new Set(data.map((e) => e.name))) : [];
  } catch {
    return [];
  }
}

// ── Exercise picker (một chuyển động) ────────────────────────────────────────

function ExercisePicker({
  options,
  optionsLoading,
  value,
  onChange,
  status,
}: {
  options: string[];
  optionsLoading: boolean;
  value: string;
  onChange: (v: string) => void;
  status: "idle" | "saving" | "saved";
}) {
  // Nếu bài tập đã lưu không còn trong thư viện, vẫn hiển thị để không mất dữ liệu.
  const showValue = value && !options.includes(value);

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
      >
        <option value="">{optionsLoading ? "Đang tải bài tập…" : "— Chưa chọn —"}</option>
        {showValue && <option value={value}>{value} (ngoài thư viện)</option>}
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <span className="w-4 shrink-0">
        {status === "saving" && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
        {status === "saved" && <Check className="w-4 h-4 text-emerald-500" />}
      </span>
    </div>
  );
}

// ── Tab ──────────────────────────────────────────────────────────────────────

export function WorkoutScheduleTemplateTab() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [templates, setTemplates] = useState<MovementTemplate[]>([]);
  const [schedule, setSchedule] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [rowStatus, setRowStatus] = useState<Map<string, "saving" | "saved">>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    const [phasesRes, tplRes, schedRes] = await Promise.all([
      fetch("/api/admin/phases"),
      fetch("/api/exercises/movements"),
      fetch("/api/workout-templates"),
    ]);
    const phasesData: Phase[] = phasesRes.ok ? await phasesRes.json() : [];
    const tplData: MovementTemplate[] = tplRes.ok ? await tplRes.json() : [];
    const schedData: ScheduleRow[] = schedRes.ok ? await schedRes.json() : [];

    const activePhases = (Array.isArray(phasesData) ? phasesData : []).filter((p) => p.isActive);
    setPhases(activePhases);
    setTemplates(Array.isArray(tplData) ? tplData : []);
    setSchedule(
      new Map(
        (Array.isArray(schedData) ? schedData : []).map((r) => [
          rowKey(r.phaseKey, r.sessionType, r.movement),
          r.exercise,
        ])
      )
    );
    setSelectedPhase((prev) => prev || activePhases[0]?.name || "");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const phase = phases.find((p) => p.name === selectedPhase) ?? null;

  // Nhóm chuyển động của giai đoạn đang chọn theo loại buổi (giữ thứ tự loại buổi
  // của giai đoạn; các loại buổi chưa có mẫu vẫn hiển thị nếu có chuyển động).
  const sessionGroups = useMemo(() => {
    if (!phase) return [] as { sessionType: string; movements: MovementTemplate[] }[];
    const byType = new Map<string, MovementTemplate[]>();
    for (const t of templates) {
      if (t.phaseKey !== phase.name) continue;
      let arr = byType.get(t.sessionType);
      if (!arr) byType.set(t.sessionType, (arr = []));
      arr.push(t);
    }
    const orderedTypes = [
      ...phase.sessionTypes.filter((t) => byType.has(t)),
      ...Array.from(byType.keys()).filter((t) => !phase.sessionTypes.includes(t)),
    ];
    return orderedTypes.map((sessionType) => ({
      sessionType,
      movements: (byType.get(sessionType) ?? []).slice(),
    }));
  }, [phase, templates]);

  // Bài tập cho từng chuyển động của giai đoạn đang chọn — tải TRỰC TIẾP từ "Danh
  // sách bài tập" mỗi khi đổi giai đoạn / mở lại trang, nên luôn đúng thư viện hiện
  // tại (không bị fix cứng). Gộp theo mã chuyển động để tránh gọi trùng.
  const [optionsByMovement, setOptionsByMovement] = useState<Map<string, string[]>>(new Map());
  const [optionsLoading, setOptionsLoading] = useState(false);

  useEffect(() => {
    if (!phase) {
      setOptionsByMovement(new Map());
      return;
    }
    const uniqMovements = Array.from(
      new Set(sessionGroups.flatMap((g) => g.movements.map((m) => m.movement)))
    );
    if (uniqMovements.length === 0) {
      setOptionsByMovement(new Map());
      return;
    }
    let active = true;
    setOptionsLoading(true);
    Promise.all(
      uniqMovements.map(async (mv) => [mv, await fetchExerciseNames(phase.name, mv)] as const)
    ).then((entries) => {
      if (!active) return;
      setOptionsByMovement(new Map(entries));
      setOptionsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [phase, sessionGroups]);

  async function saveRow(sessionType: string, movement: string, exercise: string) {
    if (!phase) return;
    const key = rowKey(phase.name, sessionType, movement);
    setSchedule((prev) => new Map(prev).set(key, exercise));
    setRowStatus((prev) => new Map(prev).set(key, "saving"));
    try {
      const res = await fetch("/api/workout-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phaseKey: phase.name, sessionType, movement, exercise }),
      });
      if (!res.ok) throw new Error();
      setRowStatus((prev) => new Map(prev).set(key, "saved"));
      setTimeout(() => {
        setRowStatus((prev) => {
          const next = new Map(prev);
          if (next.get(key) === "saved") next.delete(key);
          return next;
        });
      }, 1500);
    } catch {
      setRowStatus((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Đang tải…
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[#fff0f0] flex items-center justify-center shrink-0">
          <ClipboardList className="w-5 h-5 text-[#f15b5c]" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">Lịch tập mẫu</h2>
          <p className="text-sm text-gray-500">
            Chọn bài tập mặc định cho từng chuyển động của mỗi loại buổi. PT có thể bấm
            <span className="font-semibold"> “Copy từ lịch mẫu” </span> khi soạn giáo án để
            điền nhanh (vẫn đổi bài tập khác được).
          </p>
        </div>
      </div>

      {/* Phase selector */}
      <div className="flex flex-wrap gap-2 mb-5">
        {phases.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedPhase(p.name)}
            className={cn(
              "px-3 py-2 rounded-xl text-sm font-semibold transition-all",
              p.name === selectedPhase
                ? "bg-[#f15b5c] text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      {!phase ? (
        <p className="text-sm text-gray-400">Chưa có giai đoạn nào.</p>
      ) : sessionGroups.length === 0 ? (
        <p className="text-sm text-gray-400">
          Giai đoạn này chưa có chuyển động nào trong thư viện. Hãy thêm ở mục “Danh sách bài tập”.
        </p>
      ) : (
        <div className="space-y-5">
          {sessionGroups.map(({ sessionType, movements }) => (
            <div key={sessionType} className="border border-gray-100 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <span className="text-sm font-bold text-gray-700">{sessionType}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {movements.map((m) => {
                  const key = rowKey(phase.name, sessionType, m.movement);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 px-4 py-2.5 flex-col sm:flex-row sm:items-center"
                    >
                      <span className="text-xs font-semibold text-gray-600 w-full sm:w-40 shrink-0">
                        {m.movement}
                      </span>
                      <div className="flex-1 w-full">
                        <ExercisePicker
                          options={optionsByMovement.get(m.movement) ?? []}
                          optionsLoading={optionsLoading}
                          value={schedule.get(key) ?? ""}
                          onChange={(v) => saveRow(sessionType, m.movement, v)}
                          status={rowStatus.get(key) ?? "idle"}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
