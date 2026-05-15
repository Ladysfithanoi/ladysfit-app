import { PHASE_OPTIONS, WORKOUT_TYPE_OPTIONS } from "@/lib/workout-structure";

// dbValues that RESTRICTED role is allowed to use per phase
const RESTRICTED_ALLOWED_TYPES: Record<string, string[]> = {
  "Giai đoạn 2": ["Skinny Fat", "Cân bằng"],
  "Giai đoạn 3": ["Duy trì"],
  // Giai đoạn 1: fully open (no workoutType restriction)
};

/** True if this phase + workoutType combination is allowed for the role */
export function isPhaseAllowed(
  role: string | undefined,
  phase: string,
  workoutType?: string,
  isSubstitute?: boolean,
  enableLevelSystem?: boolean
): boolean {
  if (isSubstitute) return true;
  if (enableLevelSystem === false) return true;
  if (role !== "RESTRICTED") return true; // FREE and PT have full access
  if (phase === "Giai đoạn 1") return true;
  if (!workoutType || workoutType === phase) return false;
  return (RESTRICTED_ALLOWED_TYPES[phase] ?? []).includes(workoutType);
}

/** All phases are visible to all roles; restriction is on workout type only */
export function getAllowedPhaseOptions() {
  return PHASE_OPTIONS;
}

/** Filtered workout type options for the given phase and role */
export function getAllowedWorkoutTypeOptions(
  role: string | undefined,
  phase: string,
  isSubstitute?: boolean,
  enableLevelSystem?: boolean
): { label: string; dbValue: string }[] {
  const all = WORKOUT_TYPE_OPTIONS[phase] ?? [];
  if (isSubstitute) return all;
  if (enableLevelSystem === false) return all;
  if (role !== "RESTRICTED") return all; // FREE and PT have full access
  const allowed = RESTRICTED_ALLOWED_TYPES[phase];
  if (!allowed) return all; // GD1 has no types — pass through
  return all.filter((opt) => allowed.includes(opt.dbValue));
}
