/**
 * One-time script: populate sessionTypes, defaultReps, templateKey for all WorkoutPhase rows.
 * Run with: npx tsx prisma/seed-phase-session-types.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PHASE_DATA: Record<string, { sessionTypes: string[]; defaultReps: string; templateKey: string }> = {
  "Giai đoạn 1": {
    sessionTypes: ["Tạ 1", "Tạ 2", "Circuit", "Cardio"],
    defaultReps: "15-20",
    templateKey: "",
  },
  "Giai đoạn 2: Giảm béo": {
    sessionTypes: ["Tạ 1", "Tạ 2", "Circuit", "Cardio"],
    defaultReps: "12-15",
    templateKey: "Giảm béo",
  },
  "Giai đoạn 2: Skinny Fat": {
    sessionTypes: ["Full 1", "Full 2", "Mông"],
    defaultReps: "12-15",
    templateKey: "Skinny Fat",
  },
  "Giai đoạn 2: Chuyên mông 1": {
    sessionTypes: ["Lower 1", "Upper 1", "Lower 2", "Glute"],
    defaultReps: "12-15",
    templateKey: "Chuyên mông 1",
  },
  "Giai đoạn 2: Chuyên mông 2": {
    sessionTypes: ["Full 1", "Full 2", "Full 3", "Circuit"],
    defaultReps: "12-15",
    templateKey: "Chuyên mông 2",
  },
  "Giai đoạn 2: Cân bằng": {
    sessionTypes: ["Lower 1", "Upper 1", "Lower 2", "Upper 2"],
    defaultReps: "12-15",
    templateKey: "Cân bằng",
  },
  "Giai đoạn 3: GD3 Chuyên mông 2": {
    sessionTypes: ["Full 1", "Full 2", "Full 3"],
    defaultReps: "10-12",
    templateKey: "GD3 Chuyên mông 2",
  },
  "Giai đoạn 3: Duy trì": {
    sessionTypes: ["Upper", "Lower", "Full", "Circuit"],
    defaultReps: "10-12",
    templateKey: "Duy trì",
  },
  "Giai đoạn 3: Power Training": {
    sessionTypes: ["Full 1", "Full 2", "Full 3"],
    defaultReps: "10-12",
    templateKey: "Power Training",
  },
};

async function main() {
  const phases = await prisma.workoutPhase.findMany();
  console.log(`Found ${phases.length} phases`);

  for (const phase of phases) {
    const data = PHASE_DATA[phase.name];
    if (!data) {
      console.log(`  ⚠ No data for phase "${phase.name}" — skipping`);
      continue;
    }
    await prisma.workoutPhase.update({
      where: { id: phase.id },
      data: {
        sessionTypes: data.sessionTypes,
        defaultReps: data.defaultReps,
        templateKey: data.templateKey,
      },
    });
    console.log(`  ✓ "${phase.name}" → sessionTypes: [${data.sessionTypes.join(", ")}], defaultReps: ${data.defaultReps}, templateKey: "${data.templateKey}"`);
  }

  // Also back-fill phaseId on WorkoutProgram records where it's missing
  console.log("\nBack-filling phaseId on WorkoutProgram records...");
  const programs = await prisma.workoutProgram.findMany({
    where: { phaseId: null },
    select: { id: true, phase: true, workoutType: true },
  });
  console.log(`  Found ${programs.length} programs without phaseId`);

  for (const prog of programs) {
    // Try exact match on phase name first
    let matchedPhase = phases.find((p) => p.name === prog.phase);

    // If not found, try matching by workoutType sub-type
    if (!matchedPhase && prog.workoutType) {
      matchedPhase = phases.find(
        (p) => PHASE_DATA[p.name]?.templateKey === prog.workoutType
      );
    }

    if (matchedPhase) {
      await prisma.workoutProgram.update({
        where: { id: prog.id },
        data: { phaseId: matchedPhase.id },
      });
      console.log(`  ✓ Program ${prog.id}: phase="${prog.phase}" → phaseId=${matchedPhase.id}`);
    } else {
      console.log(`  ⚠ Program ${prog.id}: phase="${prog.phase}" workoutType="${prog.workoutType}" — no matching phase found`);
    }
  }

  console.log("\n✅ Done!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
