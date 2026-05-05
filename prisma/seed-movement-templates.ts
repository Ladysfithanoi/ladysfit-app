import { PrismaClient } from "@prisma/client";
import { SESSION_TYPES } from "../lib/workout-constants";
import { SESSION_TYPE_MOVEMENT_TEMPLATES } from "../lib/workout-structure";

const prisma = new PrismaClient();

async function main() {
  await prisma.workoutMovementTemplate.deleteMany();

  const records: { phaseKey: string; sessionType: string; movement: string }[] = [];

  for (const [phaseKey, config] of Object.entries(SESSION_TYPES)) {
    const parts = phaseKey.split(": ");
    const workoutType = parts.length > 1 ? parts.slice(1).join(": ") : undefined;

    for (const sessionType of config.types) {
      const templateKey = workoutType ? `${workoutType}|${sessionType}` : sessionType;
      const slots = SESSION_TYPE_MOVEMENT_TEMPLATES[templateKey] ?? [];

      for (const slot of slots) {
        records.push({ phaseKey, sessionType, movement: slot.code });
      }
    }
  }

  const result = await prisma.workoutMovementTemplate.createMany({
    data: records,
    skipDuplicates: true,
  });

  console.log(`Seeded ${result.count} movement templates`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
