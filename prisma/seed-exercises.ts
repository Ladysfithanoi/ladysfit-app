import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ExerciseSeed = { phase: string; type: string; movement: string; name: string };

// ── Giai đoạn 1 exercise pools per movement category ─────────────────────────

const GD1_POOL: Record<string, string[]> = {
  Squat: [
    "Goblet Squat (tạ đơn)",
    "Barbell Back Squat",
    "Squat bodyweight",
    "Leg Press (nhẹ)",
    "Sumo Squat",
    "Split Squat",
  ],
  Pull: [
    "Lat Pulldown (tay rộng)",
    "Seated Cable Row",
    "Dumbbell Row đơn tay",
    "Assisted Pull-Up",
    "Face Pull",
    "Band Pull-Apart",
  ],
  Hinge: [
    "Romanian Deadlift (tạ đơn)",
    "Good Morning (bodyweight)",
    "Kettlebell Swing",
    "Stiff Leg Deadlift",
    "Hip Hinge cáp",
    "Single Leg Hip Hinge",
  ],
  Push: [
    "Dumbbell Bench Press",
    "Push-ups",
    "Incline Dumbbell Press",
    "Cable Chest Fly",
    "Dumbbell Shoulder Press",
    "Resistance Band Press",
  ],
  "Lower Isolate": [
    "Leg Extension",
    "Lying Leg Curl",
    "Glute Bridge",
    "Fire Hydrant",
    "Cable Kickback",
    "Standing Calf Raise",
    "Abduction Machine",
  ],
  "Upper Isolate": [
    "Dumbbell Bicep Curl",
    "Tricep Pushdown (dây)",
    "Dumbbell Lateral Raise",
    "Hammer Curl",
    "Overhead Tricep Extension",
    "Cable Bicep Curl",
  ],
  HIT: [
    "Burpees",
    "Mountain Climbers",
    "Jump Squat",
    "High Knees",
    "Box Step-Up",
    "Jumping Jacks",
    "Skater Jumps",
  ],
  MIT: [
    "Treadmill (tốc độ vừa)",
    "Xe đạp tại chỗ",
    "Elliptical",
    "Bước leo máy (Stair Master)",
    "Rowing Machine",
    "Đi bộ nhanh (incline)",
  ],
};

// All unique GD1 movement codes, derived from the session templates
const GD1_MOVEMENT_CODES = [
  // Tạ 1
  "A1. Squat", "A2. Pull", "B1. Hinge", "B2. Push",
  "C1. Lower Isolate", "C2. Upper Isolate", "D1. HIT", "D2. HIT",
  // Tạ 2 (unique ones; C1/C2/D1/D2 already above)
  "A1. Hinge", "A2. Push", "B1. Squat", "B2. Pull",
  // Circuit (unique ones)
  "A1. Push", "A2. Hinge", "A3. Pull", "A4. Squat", "B1. HIT", "B2. HIT",
  // Cardio
  "A1. MIT", "A2. MIT", "A3. MIT", "A4. MIT", "A5. MIT", "A6. MIT",
];

function getCategory(movement: string): string {
  const idx = movement.indexOf(". ");
  return idx !== -1 ? movement.slice(idx + 2) : movement;
}

const gd1Exercises: ExerciseSeed[] = GD1_MOVEMENT_CODES.flatMap((movement) => {
  const category = getCategory(movement);
  return (GD1_POOL[category] ?? []).map((name) => ({
    phase: "Giai đoạn 1",
    type: category,
    movement,
    name,
  }));
});

// ── Giai đoạn 2 exercise pools per movement category ─────────────────────────

const GD2_POOL: Record<string, string[]> = {
  Squat: [
    "Barbell Back Squat",
    "Hack Squat",
    "Leg Press",
    "Bulgarian Split Squat",
    "Lunges đi bộ",
    "Goblet Squat (tạ đơn)",
  ],
  Pull: [
    "Pull-Up",
    "Barbell Bent-Over Row",
    "Lat Pulldown (tay rộng)",
    "Seated Cable Row",
    "T-Bar Row",
    "Cable Pullover",
  ],
  Hinge: [
    "Romanian Deadlift (tạ đòn)",
    "Sumo Deadlift",
    "Kettlebell Swing",
    "Single Leg Romanian Deadlift",
    "Good Morning",
    "Stiff Leg Deadlift",
  ],
  Push: [
    "Barbell Bench Press",
    "Incline Dumbbell Press",
    "Dumbbell Shoulder Press",
    "Push-ups nâng cao",
    "Cable Chest Fly",
    "Arnold Press",
  ],
  "Lower Isolate": [
    "Leg Extension",
    "Lying Leg Curl",
    "Seated Leg Curl",
    "Single Leg Glute Bridge",
    "Standing Calf Raise",
    "Abduction Machine",
  ],
  "Upper Isolate": [
    "Dumbbell Bicep Curl",
    "Tricep Pushdown (dây)",
    "Dumbbell Lateral Raise",
    "Hammer Curl",
    "Overhead Tricep Extension",
    "Face Pull",
  ],
  "Glute Attack": [
    "Barbell Hip Thrust",
    "Cable Kickback",
    "Single Leg Glute Bridge",
    "Abduction Machine",
    "Banded Hip Thrust",
    "Cable Pull-Through",
    "Single Leg Hip Thrust",
  ],
  HIT: [
    "Burpees",
    "Mountain Climbers",
    "Jump Squat",
    "Box Jump",
    "High Knees",
    "Skater Jumps",
  ],
  MIT: [
    "Treadmill (tốc độ vừa)",
    "Xe đạp tại chỗ",
    "Elliptical",
    "Bước leo máy (Stair Master)",
    "Rowing Machine",
    "Đi bộ nhanh (incline)",
  ],
  Core: [
    "Cable Crunch",
    "Hanging Leg Raise",
    "Ab Rollout",
    "Russian Twist",
    "Bicycle Crunch",
    "Plank",
  ],
};

const GD2_MOVEMENT_CODES = [
  "A. Hinge",
  "A1. Squat", "A1. Hinge", "A1. Push", "A1. Pull", "A1. MIT",
  "A2. Squat", "A2. Hinge", "A2. Push", "A2. Pull", "A2. MIT",
  "A3. Pull", "A3. MIT",
  "A4. Squat", "A4. MIT",
  "A5. Push", "A5. MIT",
  "A6. Hinge", "A6. MIT",
  "A7. Pull", "A7. MIT",
  "A8. Squat", "A8. MIT",
  "B1. Hinge", "B1. Squat", "B1. Push", "B1. HIT", "B1. Glute Attack", "B1. Upper Isolate",
  "B2. Hinge", "B2. Squat", "B2. Push", "B2. Pull", "B2. HIT",
  "B2. Lower Isolate", "B2. Glute Attack", "B2. Upper Isolate",
  "B3. Glute Attack",
  "B4. Glute Attack",
  "C. Glute Attack",
  "C1. Lower Isolate", "C1. Hinge", "C1. Squat", "C1. HIT", "C1. Upper Isolate",
  "C2. Lower Isolate", "C2. Upper Isolate", "C2. Glute Attack", "C2. HIT",
  "D. Core",
  "D1. HIT",
  "D2. HIT",
];

const gd2Exercises: ExerciseSeed[] = GD2_MOVEMENT_CODES.flatMap((movement) => {
  const category = getCategory(movement);
  return (GD2_POOL[category] ?? []).map((name) => ({
    phase: "Giai đoạn 2",
    type: category,
    movement,
    name,
  }));
});

// ── Giai đoạn 3 exercise pools per movement category ─────────────────────────

const GD3_POOL: Record<string, string[]> = {
  Squat: [
    "Front Squat",
    "Barbell Back Squat",
    "Leg Press đơn chân",
    "Bulgarian Split Squat",
    "Pistol Squat hỗ trợ",
    "Goblet Squat nặng",
  ],
  Pull: [
    "Weighted Pull-Up",
    "Meadows Row",
    "Chest Supported Row",
    "Rack Pull",
    "Barbell Bent-Over Row",
    "Cable Pullover nặng",
  ],
  Hinge: [
    "Single Leg Romanian Deadlift",
    "Nordic Curl",
    "Deadlift kiểu Sumo",
    "Romanian Deadlift (tạ đòn)",
    "Good Morning nặng",
    "Stiff Leg Deadlift nặng",
  ],
  Push: [
    "Barbell Bench Press",
    "Incline Barbell Press",
    "Overhead Press",
    "Close-Grip Bench Press",
    "Arnold Press",
    "Dumbbell Shoulder Press nặng",
  ],
  "Lower Isolate": [
    "Leg Extension nặng",
    "Leg Curl nặng",
    "Single Leg Leg Press",
    "Seated Calf Raise",
    "Abduction Machine nặng",
    "Nordic Curl hỗ trợ",
  ],
  "Upper Isolate": [
    "Dumbbell Bicep Curl nặng",
    "Skull Crusher",
    "Dumbbell Lateral Raise nặng",
    "Cable Bicep Curl",
    "Overhead Tricep Extension",
    "Face Pull",
  ],
  "Glute Attack": [
    "Barbell Hip Thrust nặng",
    "Bulgarian Split Squat (mông tập trung)",
    "Cable Pull-Through",
    "Banded Hip Thrust",
    "Single Leg Hip Thrust tạ đòn",
    "Cable Kickback nặng",
  ],
  HIT: [
    "Burpees",
    "Box Jump",
    "Jump Squat nặng",
    "Mountain Climbers",
    "Sprint tại chỗ",
    "Skater Jumps",
  ],
  Core: [
    "Dragon Flag",
    "Toes to Bar",
    "Weighted Cable Crunch",
    "Hanging Windshield Wiper",
    "Plank với trọng tải",
    "Pallof Press",
  ],
  "Plyo Lower": [
    "Box Jump",
    "Jump Squat",
    "Broad Jump",
    "Depth Jump",
    "Skater Jumps",
    "Bounding",
  ],
  "Plyo Upper": [
    "Medicine Ball Slam",
    "Clap Push-Up",
    "Medicine Ball Throw",
    "Explosive Push-Up",
    "Plyo Push-Up",
    "Band Pull-Apart nhanh",
  ],
};

const GD3_MOVEMENT_CODES = [
  "A1. Hinge", "A1. Squat", "A1. Push", "A1. Pull", "A1. Plyo Lower", "A1. Plyo Upper",
  "A2. Pull", "A2. Hinge", "A2. Push",
  "A3. Pull",
  "A4. Squat",
  "A5. Push",
  "A6. Hinge",
  "A7. Pull",
  "A8. Squat",
  "B1. Squat", "B1. Hinge", "B1. Push", "B1. Pull", "B1. Plyo Upper", "B1. Plyo Lower",
  "B2. Push", "B2. Pull", "B2. Hinge",
  "C1. Hinge", "C1. Squat", "C1. Upper Isolate", "C1. Lower Isolate", "C1. Pull", "C1. Plyo Lower", "C1. Plyo Upper",
  "C2. Upper Isolate", "C2. Lower Isolate", "C2. Glute Attack", "C2. Core",
  "D. Core",
  "D1. HIT",
  "D2. HIT",
];

const gd3Exercises: ExerciseSeed[] = GD3_MOVEMENT_CODES.flatMap((movement) => {
  const category = getCategory(movement);
  return (GD3_POOL[category] ?? []).map((name) => ({
    phase: "Giai đoạn 3",
    type: category,
    movement,
    name,
  }));
});

// ── Giai đoạn 2 & 3 exercises (legacy movement codes used by GD2/GD3 templates) ─

const gd23Exercises: ExerciseSeed[] = [
  // WARMUP – all phases
  ...["Giai đoạn 1", "Giai đoạn 2", "Giai đoạn 3"].flatMap((phase) => [
    { phase, type: "warmup", movement: "warmup", name: "Đi bộ máy treadmill" },
    { phase, type: "warmup", movement: "warmup", name: "Đạp xe tại chỗ (thấp)" },
    { phase, type: "warmup", movement: "warmup", name: "Nhảy dây nhẹ" },
    { phase, type: "warmup", movement: "warmup", name: "Xoay khớp toàn thân" },
    { phase, type: "warmup", movement: "warmup", name: "Dynamic stretching" },
  ]),

  // QUAD – GD2 & GD3 only
  ...["Giai đoạn 2"].flatMap((phase) => [
    { phase, type: "quad", movement: "quad", name: "Barbell Back Squat" },
    { phase, type: "quad", movement: "quad", name: "Hack Squat" },
    { phase, type: "quad", movement: "quad", name: "Leg Press" },
    { phase, type: "quad", movement: "quad", name: "Leg Extension" },
    { phase, type: "quad", movement: "quad", name: "Lunges đi bộ" },
    { phase, type: "quad", movement: "quad", name: "Bulgarian Split Squat" },
  ]),
  ...["Giai đoạn 3"].flatMap((phase) => [
    { phase, type: "quad", movement: "quad", name: "Front Squat" },
    { phase, type: "quad", movement: "quad", name: "Sumo Squat nặng" },
    { phase, type: "quad", movement: "quad", name: "Leg Press đơn chân" },
    { phase, type: "quad", movement: "quad", name: "Sissy Squat" },
    { phase, type: "quad", movement: "quad", name: "Jump Squat" },
    { phase, type: "quad", movement: "quad", name: "Pistol Squat hỗ trợ" },
  ]),

  // HAMSTRING – GD2 & GD3 only
  ...["Giai đoạn 2"].flatMap((phase) => [
    { phase, type: "hamstring", movement: "hamstring", name: "Romanian Deadlift (tạ đòn)" },
    { phase, type: "hamstring", movement: "hamstring", name: "Lying Leg Curl" },
    { phase, type: "hamstring", movement: "hamstring", name: "Seated Leg Curl" },
    { phase, type: "hamstring", movement: "hamstring", name: "Nordic Curl hỗ trợ" },
  ]),
  ...["Giai đoạn 3"].flatMap((phase) => [
    { phase, type: "hamstring", movement: "hamstring", name: "Single Leg Romanian Deadlift" },
    { phase, type: "hamstring", movement: "hamstring", name: "Nordic Curl" },
    { phase, type: "hamstring", movement: "hamstring", name: "Leg Curl nặng" },
    { phase, type: "hamstring", movement: "hamstring", name: "Deadlift kiểu Sumo" },
  ]),

  // GLUTE – GD2 & GD3 only
  ...["Giai đoạn 2"].flatMap((phase) => [
    { phase, type: "glute", movement: "glute", name: "Barbell Hip Thrust" },
    { phase, type: "glute", movement: "glute", name: "Cable Kickback" },
    { phase, type: "glute", movement: "glute", name: "Single Leg Glute Bridge" },
    { phase, type: "glute", movement: "glute", name: "Abduction Machine" },
    { phase, type: "glute", movement: "glute", name: "Sumo Deadlift" },
  ]),
  ...["Giai đoạn 3"].flatMap((phase) => [
    { phase, type: "glute", movement: "glute", name: "Barbell Hip Thrust nặng" },
    { phase, type: "glute", movement: "glute", name: "Bulgarian Split Squat (mông tập trung)" },
    { phase, type: "glute", movement: "glute", name: "Cable Pull-Through" },
    { phase, type: "glute", movement: "glute", name: "Banded Hip Thrust" },
    { phase, type: "glute", movement: "glute", name: "Single Leg Hip Thrust tạ đòn" },
  ]),

  // INNER THIGH – all phases
  ...["Giai đoạn 1", "Giai đoạn 2", "Giai đoạn 3"].flatMap((phase) => [
    { phase, type: "inner_thigh", movement: "inner_thigh", name: "Adduction Machine" },
    { phase, type: "inner_thigh", movement: "inner_thigh", name: "Sumo Squat rộng" },
    { phase, type: "inner_thigh", movement: "inner_thigh", name: "Cable Adduction" },
    { phase, type: "inner_thigh", movement: "inner_thigh", name: "Side Lying Leg Raise (đùi trong)" },
    { phase, type: "inner_thigh", movement: "inner_thigh", name: "Pilates Scissor" },
  ]),

  // CALF – all phases
  ...["Giai đoạn 1", "Giai đoạn 2", "Giai đoạn 3"].flatMap((phase) => [
    { phase, type: "calf", movement: "calf", name: "Standing Calf Raise" },
    { phase, type: "calf", movement: "calf", name: "Seated Calf Raise" },
    { phase, type: "calf", movement: "calf", name: "Leg Press Calf Raise" },
    { phase, type: "calf", movement: "calf", name: "Single Leg Calf Raise" },
  ]),

  // BACK – GD2 & GD3 only
  ...["Giai đoạn 2"].flatMap((phase) => [
    { phase, type: "back", movement: "back", name: "Pull-Up" },
    { phase, type: "back", movement: "back", name: "Barbell Bent-Over Row" },
    { phase, type: "back", movement: "back", name: "Cable Pullover" },
    { phase, type: "back", movement: "back", name: "T-Bar Row" },
  ]),
  ...["Giai đoạn 3"].flatMap((phase) => [
    { phase, type: "back", movement: "back", name: "Weighted Pull-Up" },
    { phase, type: "back", movement: "back", name: "Meadows Row" },
    { phase, type: "back", movement: "back", name: "Chest Supported Row" },
    { phase, type: "back", movement: "back", name: "Rack Pull" },
  ]),

  // SHOULDER – all phases
  ...["Giai đoạn 1", "Giai đoạn 2", "Giai đoạn 3"].flatMap((phase) => [
    { phase, type: "shoulder", movement: "shoulder", name: "Dumbbell Lateral Raise" },
    { phase, type: "shoulder", movement: "shoulder", name: "Dumbbell Shoulder Press" },
    { phase, type: "shoulder", movement: "shoulder", name: "Front Raise" },
    { phase, type: "shoulder", movement: "shoulder", name: "Upright Row" },
    { phase, type: "shoulder", movement: "shoulder", name: "Arnold Press" },
    { phase, type: "shoulder", movement: "shoulder", name: "Cable Lateral Raise" },
  ]),

  // ARM – all phases
  ...["Giai đoạn 1", "Giai đoạn 2", "Giai đoạn 3"].flatMap((phase) => [
    { phase, type: "arm", movement: "arm", name: "Dumbbell Bicep Curl" },
    { phase, type: "arm", movement: "arm", name: "Tricep Pushdown (dây)" },
    { phase, type: "arm", movement: "arm", name: "Hammer Curl" },
    { phase, type: "arm", movement: "arm", name: "Overhead Tricep Extension" },
    { phase, type: "arm", movement: "arm", name: "Cable Bicep Curl" },
    { phase, type: "arm", movement: "arm", name: "Skull Crusher" },
  ]),

  // CORE – GD2 & GD3 only
  ...["Giai đoạn 2"].flatMap((phase) => [
    { phase, type: "core", movement: "core", name: "Cable Crunch" },
    { phase, type: "core", movement: "core", name: "Hanging Leg Raise" },
    { phase, type: "core", movement: "core", name: "Ab Rollout" },
    { phase, type: "core", movement: "core", name: "Russian Twist" },
    { phase, type: "core", movement: "core", name: "Bicycle Crunch" },
    { phase, type: "core", movement: "core", name: "V-Up" },
  ]),
  ...["Giai đoạn 3"].flatMap((phase) => [
    { phase, type: "core", movement: "core", name: "Dragon Flag" },
    { phase, type: "core", movement: "core", name: "Toes to Bar" },
    { phase, type: "core", movement: "core", name: "Weighted Cable Crunch" },
    { phase, type: "core", movement: "core", name: "Hanging Windshield Wiper" },
    { phase, type: "core", movement: "core", name: "Plank với trọng tải" },
    { phase, type: "core", movement: "core", name: "Pallof Press" },
  ]),

  // CARDIO – all phases
  ...["Giai đoạn 1", "Giai đoạn 2", "Giai đoạn 3"].flatMap((phase) => [
    { phase, type: "cardio", movement: "cardio", name: "Treadmill nhịp đều" },
    { phase, type: "cardio", movement: "cardio", name: "Xe đạp tại chỗ" },
    { phase, type: "cardio", movement: "cardio", name: "Elliptical" },
    { phase, type: "cardio", movement: "cardio", name: "Nhảy dây" },
    { phase, type: "cardio", movement: "cardio", name: "HIIT 20/10" },
    { phase, type: "cardio", movement: "cardio", name: "Bước leo máy (Stair Master)" },
  ]),

  // COOLDOWN – all phases
  ...["Giai đoạn 1", "Giai đoạn 2", "Giai đoạn 3"].flatMap((phase) => [
    { phase, type: "cooldown", movement: "cooldown", name: "Giãn cơ tĩnh toàn thân" },
    { phase, type: "cooldown", movement: "cooldown", name: "Foam roll toàn thân" },
    { phase, type: "cooldown", movement: "cooldown", name: "Yoga hạ nhiệt" },
    { phase, type: "cooldown", movement: "cooldown", name: "Thở dưỡng sinh" },
  ]),
];

async function main() {
  const mode = process.argv[2];

  if (mode === "gd3") {
    console.log("Seeding Giai đoạn 3 exercises only...");
    await prisma.workoutExercise.deleteMany({ where: { phase: { startsWith: "Giai đoạn 3" } } });
    const result = await prisma.workoutExercise.createMany({ data: gd3Exercises });
    console.log(`Created ${result.count} GD3 exercises.`);
    return;
  }

  console.log("Seeding all workout exercises...");
  await prisma.workoutExercise.deleteMany();

  const allExercises = [...gd1Exercises, ...gd2Exercises, ...gd3Exercises, ...gd23Exercises];
  const result = await prisma.workoutExercise.createMany({ data: allExercises });
  console.log(`Created ${result.count} exercises.`);
  console.log(`  GD1 (new movement codes): ${gd1Exercises.length}`);
  console.log(`  GD2 (new movement codes): ${gd2Exercises.length}`);
  console.log(`  GD3 (new movement codes): ${gd3Exercises.length}`);
  console.log(`  Legacy codes: ${gd23Exercises.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
