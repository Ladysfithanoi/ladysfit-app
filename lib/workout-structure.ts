export { SESSION_TYPES } from "./workout-constants";
export type { SessionTypeConfig } from "./workout-constants";
import { SESSION_TYPES } from "./workout-constants";

export const SESSIONS_PER_WEEK_OPTIONS = [2, 3, 4, 5] as const;

export type MovementSlot = {
  code: string;
  name: string;
  defaultSets: number;
  defaultReps: string;
};

// ── Phase options shown to user ─────────────────────────────────────────
export const PHASE_OPTIONS = [
  { value: "Giai đoạn 1", label: "Giai đoạn 1 — Giảm cân nhanh" },
  { value: "Giai đoạn 2", label: "Giai đoạn 2 — Hoàn thiện vóc dáng" },
  { value: "Giai đoạn 3", label: "Giai đoạn 3 — Duy trì thói quen" },
] as const;

// ── Workout type (Mục tiêu) options per phase ────────────────────────────
// Phase 1 has no sub-type; phases 2 & 3 have sub-types with DB value mapping
export const WORKOUT_TYPE_OPTIONS: Record<string, { label: string; dbValue: string }[]> = {
  "Giai đoạn 1": [], // no sub-type selection
  "Giai đoạn 2": [
    { label: "Skinny Fat",      dbValue: "Skinny Fat" },
    { label: "Giảm béo",        dbValue: "Giảm béo" },
    { label: "Chuyên mông 1",   dbValue: "Chuyên mông 1" },
    { label: "Chuyên mông 2",   dbValue: "Chuyên mông 2" },
    { label: "Cân bằng",        dbValue: "Cân bằng" },
  ],
  "Giai đoạn 3": [
    { label: "Chuyên mông 2",   dbValue: "GD3 Chuyên mông 2" },
    { label: "Duy trì",         dbValue: "Duy trì" },
    { label: "Power Training",  dbValue: "Power Training" },
  ],
};

// workoutType stored in DB for phase 1 (no sub-type)
export const PHASE1_WORKOUT_TYPE = "Giai đoạn 1";


// ── Movement slot templates per session type ─────────────────────────────
// Shorthand for code=name slots
const S = (code: string, sets: number, reps: string): MovementSlot => ({
  code, name: code, defaultSets: sets, defaultReps: reps,
});

export const SESSION_TYPE_MOVEMENT_TEMPLATES: Record<string, MovementSlot[]> = {
  // ── Giai đoạn 1 ─────────────────────────────────────────────────────
  "Tạ 1": [
    { code: "A1. Squat",          name: "A1. Squat",          defaultSets: 4, defaultReps: "10–12" },
    { code: "A2. Pull",           name: "A2. Pull",           defaultSets: 4, defaultReps: "10–12" },
    { code: "B1. Hinge",          name: "B1. Hinge",          defaultSets: 3, defaultReps: "10–12" },
    { code: "B2. Push",           name: "B2. Push",           defaultSets: 3, defaultReps: "10–12" },
    { code: "C1. Lower Isolate",  name: "C1. Lower Isolate",  defaultSets: 3, defaultReps: "12–15" },
    { code: "C2. Upper Isolate",  name: "C2. Upper Isolate",  defaultSets: 3, defaultReps: "12–15" },
    { code: "D1. HIT",            name: "D1. HIT",            defaultSets: 3, defaultReps: "40 giây" },
    { code: "D2. HIT",            name: "D2. HIT",            defaultSets: 3, defaultReps: "40 giây" },
  ],
  "Tạ 2": [
    { code: "A1. Hinge",          name: "A1. Hinge",          defaultSets: 4, defaultReps: "10–12" },
    { code: "A2. Push",           name: "A2. Push",           defaultSets: 4, defaultReps: "10–12" },
    { code: "B1. Squat",          name: "B1. Squat",          defaultSets: 3, defaultReps: "10–12" },
    { code: "B2. Pull",           name: "B2. Pull",           defaultSets: 3, defaultReps: "10–12" },
    { code: "C1. Lower Isolate",  name: "C1. Lower Isolate",  defaultSets: 3, defaultReps: "12–15" },
    { code: "C2. Upper Isolate",  name: "C2. Upper Isolate",  defaultSets: 3, defaultReps: "12–15" },
    { code: "D1. HIT",            name: "D1. HIT",            defaultSets: 3, defaultReps: "40 giây" },
    { code: "D2. HIT",            name: "D2. HIT",            defaultSets: 3, defaultReps: "40 giây" },
  ],
  "Circuit": [
    { code: "A1. Push",   name: "A1. Push",   defaultSets: 3, defaultReps: "15–20" },
    { code: "A2. Hinge",  name: "A2. Hinge",  defaultSets: 3, defaultReps: "15–20" },
    { code: "A3. Pull",   name: "A3. Pull",   defaultSets: 3, defaultReps: "15–20" },
    { code: "A4. Squat",  name: "A4. Squat",  defaultSets: 3, defaultReps: "15–20" },
    { code: "B1. HIT",    name: "B1. HIT",    defaultSets: 4, defaultReps: "40 giây" },
    { code: "B2. HIT",    name: "B2. HIT",    defaultSets: 4, defaultReps: "40 giây" },
  ],
  "Cardio": [
    { code: "A1. MIT",  name: "A1. MIT",  defaultSets: 1, defaultReps: "15–20 phút" },
    { code: "A2. MIT",  name: "A2. MIT",  defaultSets: 1, defaultReps: "15–20 phút" },
    { code: "A3. MIT",  name: "A3. MIT",  defaultSets: 1, defaultReps: "15–20 phút" },
    { code: "A4. MIT",  name: "A4. MIT",  defaultSets: 1, defaultReps: "15–20 phút" },
    { code: "A5. MIT",  name: "A5. MIT",  defaultSets: 1, defaultReps: "15–20 phút" },
    { code: "A6. MIT",  name: "A6. MIT",  defaultSets: 1, defaultReps: "15–20 phút" },
  ],

  // ── Giai đoạn 2: Skinny Fat ──────────────────────────────────────────
  "Skinny Fat|Full 1": [
    S("A1. Squat", 4, "8–10"), S("A2. Pull", 4, "8–10"),
    S("B1. Hinge", 4, "8–10"), S("B2. Push", 4, "8–10"),
    S("C1. Lower Isolate", 3, "12–15"), S("C2. Upper Isolate", 3, "12–15"),
  ],
  "Skinny Fat|Mông": [
    S("A. Hinge", 4, "8–10"),
    S("B1. Squat", 4, "8–10"), S("B2. Hinge", 4, "8–10"),
    S("C1. Lower Isolate", 3, "12–15"), S("C2. Glute Attack", 4, "12–15"),
  ],
  "Skinny Fat|Full 2": [
    S("A1. Hinge", 4, "8–10"), S("A2. Push", 4, "8–10"),
    S("B1. Squat", 4, "8–10"), S("B2. Pull", 4, "8–10"),
    S("C1. Lower Isolate", 3, "12–15"), S("C2. Upper Isolate", 3, "12–15"),
  ],

  // ── Giai đoạn 2: Chuyên mông 1 ───────────────────────────────────────
  "Chuyên mông 1|Lower 1": [
    S("A1. Squat", 4, "8–10"), S("A2. Hinge", 4, "8–10"),
    S("B1. Squat", 4, "8–10"), S("B2. Hinge", 4, "8–10"),
    S("C1. Lower Isolate", 3, "12–15"), S("C2. Lower Isolate", 3, "12–15"),
  ],
  "Chuyên mông 1|Upper 1": [ // displayed as "Upper" in dropdown
    S("A1. Push", 4, "8–10"), S("A2. Pull", 4, "8–10"),
    S("B1. Push", 4, "8–10"), S("B2. Pull", 4, "8–10"),
    S("C1. Upper Isolate", 3, "12–15"),
    S("D1. HIT", 3, "40 giây"), S("D2. HIT", 3, "40 giây"),
  ],
  "Chuyên mông 1|Lower 2": [
    S("A1. Hinge", 4, "8–10"), S("A2. Squat", 4, "8–10"),
    S("B1. Hinge", 4, "8–10"), S("B2. Squat", 4, "8–10"),
    S("C1. Lower Isolate", 3, "12–15"), S("C2. Lower Isolate", 3, "12–15"),
  ],
  "Chuyên mông 1|Glute": [
    S("A1. Hinge", 4, "8–10"), S("A2. Squat", 4, "8–10"),
    S("B1. Glute Attack", 4, "12–15"), S("B2. Glute Attack", 4, "12–15"),
    S("B3. Glute Attack", 3, "12–15"), S("B4. Glute Attack", 3, "12–15"),
  ],

  // ── Giai đoạn 2: Chuyên mông 2 ───────────────────────────────────────
  "Chuyên mông 2|Full 1": [
    S("A1. Hinge", 4, "8–10"), S("A2. Push", 4, "8–10"),
    S("B1. Squat", 4, "8–10"), S("B2. Pull", 4, "8–10"),
    S("C1. Hinge", 3, "8–10"), S("C2. Glute Attack", 4, "12–15"),
    S("D. Core", 3, "15–20"),
  ],
  "Chuyên mông 2|Full 2": [
    S("A1. Squat", 4, "8–10"), S("A2. Pull", 4, "8–10"),
    S("B1. Hinge", 4, "8–10"), S("B2. Push", 4, "8–10"),
    S("C1. Squat", 3, "8–10"), S("C2. Glute Attack", 4, "12–15"),
    S("D. Core", 3, "15–20"),
  ],
  "Chuyên mông 2|Full 3": [
    S("A1. Hinge", 4, "8–10"), S("A2. Pull", 4, "8–10"),
    S("B1. Squat", 4, "8–10"), S("B2. Push", 4, "8–10"),
    S("C1. Hinge", 3, "8–10"), S("C2. Glute Attack", 4, "12–15"),
    S("D. Core", 3, "15–20"),
  ],
  "Chuyên mông 2|Circuit": [
    S("A1. Push", 3, "15–20"), S("A2. Hinge", 3, "15–20"),
    S("A3. Pull", 3, "15–20"), S("A4. Squat", 3, "15–20"),
    S("B1. HIT", 3, "40 giây"), S("B2. HIT", 3, "40 giây"),
  ],

  // ── Giai đoạn 2: Giảm béo ────────────────────────────────────────────
  "Giảm béo|Tạ 1": [
    S("A1. Squat", 4, "8–10"), S("A2. Pull", 4, "8–10"),
    S("B1. Hinge", 4, "8–10"), S("B2. Push", 4, "8–10"),
    S("C1. Lower Isolate", 3, "12–15"), S("C2. Upper Isolate", 3, "12–15"),
    S("D1. HIT", 3, "40 giây"), S("D2. HIT", 3, "40 giây"),
  ],
  "Giảm béo|Tạ 2": [
    S("A1. Hinge", 4, "8–10"), S("A2. Push", 4, "8–10"),
    S("B1. Squat", 4, "8–10"), S("B2. Pull", 4, "8–10"),
    S("C1. Lower Isolate", 3, "12–15"), S("C2. Upper Isolate", 3, "12–15"),
    S("D1. HIT", 3, "40 giây"), S("D2. HIT", 3, "40 giây"),
  ],
  "Giảm béo|Circuit": [
    S("A1. Push", 3, "15–20"), S("A2. Hinge", 3, "15–20"),
    S("A3. Pull", 3, "15–20"), S("A4. Squat", 3, "15–20"),
    S("A5. Push", 3, "15–20"), S("A6. Hinge", 3, "15–20"),
    S("A7. Pull", 3, "15–20"), S("A8. Squat", 3, "15–20"),
  ],
  "Giảm béo|Cardio": [
    S("A1. MIT", 1, "15–20 phút"), S("A2. MIT", 1, "15–20 phút"),
    S("A3. MIT", 1, "15–20 phút"), S("A4. MIT", 1, "15–20 phút"),
    S("A5. MIT", 1, "15–20 phút"), S("A6. MIT", 1, "15–20 phút"),
    S("A7. MIT", 1, "15–20 phút"), S("A8. MIT", 1, "15–20 phút"),
  ],

  // ── Giai đoạn 2: Cân bằng ────────────────────────────────────────────
  "Cân bằng|Upper 1": [
    S("A1. Push", 4, "8–10"), S("A2. Pull", 4, "8–10"),
    S("B1. Upper Isolate", 3, "12–15"), S("B2. Upper Isolate", 3, "12–15"),
    S("C1. HIT", 3, "40 giây"), S("C2. HIT", 3, "40 giây"),
  ],
  "Cân bằng|Lower 1": [
    S("A1. Squat", 4, "8–10"), S("A2. Hinge", 4, "8–10"),
    S("B1. Squat", 4, "8–10"), S("B2. Lower Isolate", 3, "12–15"),
    S("C. Glute Attack", 4, "12–15"),
  ],
  "Cân bằng|Upper 2": [
    S("A1. Pull", 4, "8–10"), S("A2. Push", 4, "8–10"),
    S("B1. Upper Isolate", 3, "12–15"), S("B2. Upper Isolate", 3, "12–15"),
    S("C1. HIT", 3, "40 giây"), S("C2. HIT", 3, "40 giây"),
  ],
  "Cân bằng|Lower 2": [
    S("A1. Hinge", 4, "8–10"), S("A2. Squat", 4, "8–10"),
    S("B1. Hinge", 4, "8–10"), S("B2. Lower Isolate", 3, "12–15"),
    S("C. Glute Attack", 4, "12–15"),
  ],

  // ── Duy trì (GĐ3) ────────────────────────────────────────────────────
  // ── Giai đoạn 3: Chuyên mông 2 ───────────────────────────────────────────
  "GD3 Chuyên mông 2|Full 1": [
    S("A1. Hinge", 4, "8–10"), S("A2. Pull", 4, "8–10"),
    S("B1. Squat", 4, "8–10"), S("B2. Push", 4, "8–10"),
    S("C1. Hinge", 3, "8–10"), S("C2. Upper Isolate", 3, "12–15"),
    S("D. Core", 3, "15–20"),
  ],
  "GD3 Chuyên mông 2|Full 2": [
    S("A1. Squat", 4, "8–10"), S("A2. Pull", 4, "8–10"),
    S("B1. Hinge", 4, "8–10"), S("B2. Push", 4, "8–10"),
    S("C1. Squat", 3, "8–10"), S("C2. Upper Isolate", 3, "12–15"),
    S("D. Core", 3, "15–20"),
  ],
  "GD3 Chuyên mông 2|Full 3": [
    S("A1. Hinge", 4, "8–10"), S("A2. Pull", 4, "8–10"),
    S("B1. Squat", 4, "8–10"), S("B2. Push", 4, "8–10"),
    S("C1. Squat", 3, "8–10"), S("C2. Upper Isolate", 3, "12–15"),
    S("D. Core", 3, "15–20"),
  ],

  // ── Giai đoạn 3: Duy trì ─────────────────────────────────────────────────
  "Duy trì|Upper": [
    S("A1. Push", 4, "8–10"), S("A2. Pull", 4, "8–10"),
    S("B1. Push", 3, "10–12"), S("B2. Pull", 3, "10–12"),
    S("C1. Upper Isolate", 3, "12–15"), S("C2. Upper Isolate", 3, "12–15"),
    S("D1. HIT", 3, "40 giây"), S("D2. HIT", 3, "40 giây"),
  ],
  "Duy trì|Lower": [
    S("A1. Squat", 4, "8–10"), S("A2. Hinge", 4, "8–10"),
    S("B1. Squat", 3, "10–12"), S("B2. Hinge", 3, "10–12"),
    S("C1. Lower Isolate", 3, "12–15"), S("C2. Glute Attack", 4, "12–15"),
  ],
  "Duy trì|Full": [
    S("A1. Squat", 4, "8–10"), S("A2. Pull", 4, "8–10"),
    S("B1. Hinge", 4, "8–10"), S("B2. Push", 4, "8–10"),
    S("C1. Pull", 3, "10–12"), S("C2. Lower Isolate", 3, "12–15"),
    S("D1. HIT", 3, "40 giây"), S("D2. HIT", 3, "40 giây"),
  ],
  "Duy trì|Circuit": [
    S("A1. Push", 3, "15–20"), S("A2. Hinge", 3, "15–20"),
    S("A3. Pull", 3, "15–20"), S("A4. Squat", 3, "15–20"),
    S("A5. Push", 3, "15–20"), S("A6. Hinge", 3, "15–20"),
    S("A7. Pull", 3, "15–20"), S("A8. Squat", 3, "15–20"),
  ],

  // ── Giai đoạn 3: Power Training ──────────────────────────────────────────
  "Power Training|Full 1": [
    S("A1. Plyo Lower", 4, "6–8"), S("A2. Push", 4, "8–10"),
    S("B1. Plyo Upper", 4, "6–8"), S("B2. Pull", 4, "8–10"),
    S("C1. Plyo Lower", 3, "6–8"), S("C2. Core", 3, "15–20"),
  ],
  "Power Training|Full 2": [
    S("A1. Squat", 4, "6–8"), S("A2. Pull", 4, "8–10"),
    S("B1. Hinge", 4, "8–10"), S("B2. Push", 4, "8–10"),
    S("C1. Lower Isolate", 3, "12–15"), S("C2. Core", 3, "15–20"),
  ],
  "Power Training|Full 3": [
    S("A1. Plyo Upper", 4, "6–8"), S("A2. Push", 4, "8–10"),
    S("B1. Plyo Lower", 4, "6–8"), S("B2. Pull", 4, "8–10"),
    S("C1. Plyo Upper", 3, "6–8"), S("C2. Core", 3, "15–20"),
  ],
};

// ── Movement base code lookup (for exercise filtering) ──────────────────
export const MOVEMENT_BASE_CODES: Record<string, string> = {
  warmup:      "warmup",
  quad_1:      "quad",
  quad_2:      "quad",
  hamstring_1: "hamstring",
  hamstring_2: "hamstring",
  glute_1:     "glute",
  glute_2:     "glute",
  glute_3:     "glute",
  inner_thigh: "inner_thigh",
  calf:        "calf",
  back_1:      "back",
  back_2:      "back",
  shoulder:    "shoulder",
  arm:         "arm",
  core_1:      "core",
  core_2:      "core",
  core_3:      "core",
  cardio:      "cardio",
  cooldown:    "cooldown",
};

// ── Phase default reps (system-controlled, read-only in UI) ─────────────
export const PHASE_DEFAULT_REPS: Record<string, string> = {
  "Giai đoạn 1": "15-20",
  "Giai đoạn 2": "12-15",
  "Giai đoạn 3": "10-12",
};

export function getDefaultReps(phase: string): string {
  return PHASE_DEFAULT_REPS[phase] ?? PHASE_DEFAULT_REPS[basePhase(phase)] ?? "15-20";
}

// ── Helpers ──────────────────────────────────────────────────────────────
export function getPhaseLabel(phaseValue: string): string {
  return PHASE_OPTIONS.find((p) => p.value === phaseValue)?.label ?? phaseValue;
}

export function getSessionTypeOptions(
  phase: string,
  workoutType: string
): { value: string; label: string }[] {
  const key = workoutType === phase ? phase : `${phase}: ${workoutType}`;
  const config = SESSION_TYPES[key];
  if (!config) return [];
  return config.types.map((t, i) => ({
    value: t,
    label: config.displayLabels?.[i] ?? t,
  }));
}

export function getSlotsForSessionType(sessionType: string, workoutType?: string): MovementSlot[] {
  if (workoutType) {
    const key = `${workoutType}|${sessionType}`;
    if (SESSION_TYPE_MOVEMENT_TEMPLATES[key]) return SESSION_TYPE_MOVEMENT_TEMPLATES[key];
    // WorkoutPhase DB names include sub-type (e.g. "Giai đoạn 2: Skinny Fat") — extract it
    if (workoutType.includes(":")) {
      const subType = workoutType.split(":").slice(1).join(":").trim();
      const subKey = `${subType}|${sessionType}`;
      if (SESSION_TYPE_MOVEMENT_TEMPLATES[subKey]) return SESSION_TYPE_MOVEMENT_TEMPLATES[subKey];
    }
  }
  return SESSION_TYPE_MOVEMENT_TEMPLATES[sessionType] ?? [];
}

/** Extract base phase name (e.g. "Giai đoạn 2: Skinny Fat" → "Giai đoạn 2") */
export function basePhase(phase: string): string {
  return phase.split(":")[0].trim();
}
