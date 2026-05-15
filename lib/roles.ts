/** All role values that represent a Personal Trainer (staff PT). */
export const PT_ROLES = ["FREE", "RESTRICTED", "PT"] as const;

/** Returns true if the role belongs to the PT staff group. */
export function isPTRole(role: string | null | undefined): boolean {
  return PT_ROLES.includes(role as (typeof PT_ROLES)[number]);
}
