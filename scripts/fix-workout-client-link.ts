/**
 * One-time repair: ensures every completed consultation has its WorkoutProgram
 * linked to the converted client.
 *
 * Handles two cases:
 *  A) Program exists with consultationId but clientId=null  → update clientId
 *  B) No program exists but workoutDesignJson is present    → create from JSON
 *
 * Run once:  npx tsx scripts/fix-workout-client-link.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type DraftMovement = {
  movementCode: string;
  movementName: string;
  selectedExercise: string;
  customExercise?: string;
  sets: number;
  reps: string;
};
type DraftSession = { key: string; sessionType: string; movements: DraftMovement[] };
type WorkoutDesign = {
  phase: string;
  workoutType: string;
  sessionsPerWeek: number;
  startWeek: number;
  sessions: DraftSession[];
};

async function main() {
  const completed = await prisma.consultation.findMany({
    where: { status: "COMPLETED", convertedClientId: { not: null } },
    select: { id: true, convertedClientId: true, workoutDesignJson: true, createdById: true },
  });

  console.log(`Found ${completed.length} completed consultation(s)`);
  let linked = 0;
  let created = 0;

  for (const c of completed) {
    const clientId = c.convertedClientId!;

    // Case A: link orphaned pre-created programs
    const updateResult = await prisma.workoutProgram.updateMany({
      where: { consultationId: c.id, clientId: null },
      data: { clientId },
    });
    if (updateResult.count > 0) {
      console.log(`  [A] consultation ${c.id} → linked ${updateResult.count} program(s) to client ${clientId}`);
      linked += updateResult.count;
      continue;
    }

    // Already has a program linked? Skip.
    const existing = await prisma.workoutProgram.count({ where: { consultationId: c.id } });
    if (existing > 0) {
      console.log(`  [OK] consultation ${c.id} already has program(s) linked`);
      continue;
    }

    // Case B: no program at all — create from workoutDesignJson if available
    if (!c.workoutDesignJson) {
      console.log(`  [SKIP] consultation ${c.id} — no workoutDesignJson`);
      continue;
    }

    let design: WorkoutDesign;
    try {
      design = JSON.parse(c.workoutDesignJson) as WorkoutDesign;
    } catch {
      console.error(`  [ERROR] consultation ${c.id} — invalid workoutDesignJson`);
      continue;
    }

    if (!design.sessions?.length) {
      console.log(`  [SKIP] consultation ${c.id} — design has no sessions`);
      continue;
    }

    const startWeek = design.startWeek ?? 1;

    const program = await prisma.workoutProgram.create({
      data: {
        clientId,
        consultationId: c.id,
        createdById: c.createdById,
        phase: design.phase,
        workoutType: design.workoutType,
        sessionsPerWeek: design.sessionsPerWeek,
        currentWeek: startWeek,
      },
    });

    const week = await prisma.workoutWeek.create({
      data: { programId: program.id, weekNumber: startWeek },
    });

    for (let i = 0; i < design.sessions.length; i++) {
      const s = design.sessions[i];
      await prisma.workoutSession.create({
        data: {
          programId: program.id,
          weekId: week.id,
          sessionName: `Buổi ${s.key} — ${s.sessionType}`,
          order: i,
          movements: {
            create: s.movements.map((m, mi) => ({
              movementCode: m.movementCode,
              movementName: m.movementName,
              selectedExercise:
                m.selectedExercise === "__custom__" ? (m.customExercise ?? "") : m.selectedExercise,
              sets: m.sets,
              reps: m.reps,
              order: mi,
            })),
          },
        },
      });
    }

    console.log(
      `  [B] consultation ${c.id} → created program ${program.id} for client ${clientId} (${design.sessions.length} sessions)`
    );
    created++;
  }

  console.log(`\nDone. Linked: ${linked}, Created: ${created}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
