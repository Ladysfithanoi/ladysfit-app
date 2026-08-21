import { prisma } from "@/lib/prisma";
import {
  getSlotsForSessionType,
  slotsFromMovementCodes,
  type MovementSlot,
} from "@/lib/workout-structure";

// ── Chuyển động nền tảng của một giai đoạn — nguồn là KHO BÀI TẬP ────────────
//
// Admin dựng giai đoạn (WorkoutPhase) và chuyển động nền tảng của từng buổi ở
// /dashboard/exercises. Chuyển động nằm ở bảng WorkoutMovementTemplate, khoá
// theo (phaseKey, sessionType).
//
// Mọi chỗ dựng sẵn giáo án PHẢI đọc từ đây. Mẫu tĩnh trong lib/workout-structure
// chỉ biết các giai đoạn có từ đầu, nên giai đoạn Admin mới tạo sẽ ra buổi tập
// RỖNG nếu chỉ đọc mẫu tĩnh — đúng lỗi "thấy tên buổi nhưng không thấy chuyển
// động bên trong". Mẫu tĩnh giờ chỉ còn là đường lui khi giai đoạn chưa có
// chuyển động nào trong kho.
//
// `phaseKey` là tên giai đoạn Admin nhìn thấy trong Kho bài tập:
//   • Giai đoạn Admin tự tạo  → đúng bằng WorkoutPhase.name.
//   • Giai đoạn có sẵn        → khoá của mẫu tĩnh, có kèm loại tập
//                               ("Giai đoạn 2: Skinny Fat"). Nếu WorkoutPhase chỉ
//                               tên trống loại tập thì ghép thêm templateKey mới ra
//                               đúng khoá — xem `phaseKeysOf`.

/** Chuyển động của một giai đoạn, nhóm theo tên buổi: { "Tạ 1": ["A1. Squat", …] }. */
export type PhaseMovements = Record<string, string[]>;

/** Giai đoạn cần tra chuyển động — lấy thẳng từ WorkoutPhase. */
export type PhaseKeySource = { name: string; templateKey?: string | null };

/** Các phaseKey có thể ứng với một giai đoạn, theo thứ tự ưu tiên. */
function phaseKeysOf(phase: PhaseKeySource): string[] {
  const keys = [phase.name];
  const templateKey = phase.templateKey?.trim();
  if (templateKey && !phase.name.includes(":")) {
    keys.push(`${phase.name}: ${templateKey}`);
  }
  return keys;
}

/** Đọc chuyển động của nhiều giai đoạn trong một truy vấn, khoá theo tên giai đoạn. */
export async function loadMovementsForPhases(
  phases: PhaseKeySource[]
): Promise<Map<string, PhaseMovements>> {
  const out = new Map<string, PhaseMovements>();
  if (phases.length === 0) return out;

  const allKeys = Array.from(new Set(phases.flatMap(phaseKeysOf)));

  // Cùng thứ tự với /api/exercises/movements, để giáo án dựng ra khớp đúng thứ
  // tự Admin nhìn thấy trong Kho bài tập ("A1…", "B1…", "C1…").
  const rows = await prisma.workoutMovementTemplate.findMany({
    where: { phaseKey: { in: allKeys } },
    orderBy: [{ sessionType: "asc" }, { movement: "asc" }],
    select: { phaseKey: true, sessionType: true, movement: true },
  });

  const byKey = new Map<string, PhaseMovements>();
  for (const r of rows) {
    let byType = byKey.get(r.phaseKey);
    if (!byType) {
      byType = {};
      byKey.set(r.phaseKey, byType);
    }
    if (!byType[r.sessionType]) byType[r.sessionType] = [];
    byType[r.sessionType].push(r.movement);
  }

  for (const phase of phases) {
    const hit = phaseKeysOf(phase)
      .map((k) => byKey.get(k))
      .find((m) => m != null);
    out.set(phase.name, hit ?? {});
  }
  return out;
}

/** Đọc chuyển động của một giai đoạn. Trả {} nếu giai đoạn chưa có gì trong kho. */
export async function loadPhaseMovements(phase: PhaseKeySource): Promise<PhaseMovements> {
  const map = await loadMovementsForPhases([phase]);
  return map.get(phase.name) ?? {};
}

/**
 * Slot của một buổi: ưu tiên Kho bài tập, rơi về mẫu tĩnh khi buổi đó chưa có
 * chuyển động nào (giai đoạn cũ chưa chạy seed-movement-templates).
 */
export function slotsForSession(
  movements: PhaseMovements,
  sessionType: string,
  templateKey?: string | null,
  defaultReps?: string | null
): MovementSlot[] {
  const codes = movements[sessionType];
  if (codes && codes.length > 0) {
    return slotsFromMovementCodes(
      codes,
      sessionType,
      templateKey || undefined,
      defaultReps || undefined
    );
  }
  return getSlotsForSessionType(sessionType, templateKey || undefined);
}
