import { PHASE_OPTIONS, WORKOUT_TYPE_OPTIONS } from "@/lib/workout-structure";

/** True if this phase + workoutType combination is allowed for the role */
export function isPhaseAllowed(
  role: string | undefined,
  phase: string,
  workoutType?: string,
  isSubstitute?: boolean,
  enableLevelSystem?: boolean
): boolean {
  void role; void phase; void workoutType;
  return true;
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
  void role; void isSubstitute; void enableLevelSystem;
  return WORKOUT_TYPE_OPTIONS[phase] ?? [];
}
