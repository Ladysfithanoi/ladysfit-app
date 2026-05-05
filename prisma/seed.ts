import { PrismaClient, Role, ClientStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function genWeightLogs(
  startWeight: number,
  targetWeight: number,
  totalDays = 28,
  factor = 0.75
) {
  const logs: { date: Date; weight: number }[] = [];
  for (let d = totalDays; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    date.setHours(7, 0, 0, 0);
    const idx = totalDays - d;
    const progress = idx / totalDays;
    const loss = progress * (startWeight - targetWeight) * factor;
    const variation = Math.sin(idx * 0.9) * 0.15;
    const weight = Math.round((startWeight - loss + variation) * 10) / 10;
    logs.push({ date: new Date(date), weight });
  }
  return logs;
}

async function main() {
  // Branches
  const branchesData = [
    { id: "branch-nguyen-xien", name: "Ladysfit Nguyễn Xiển" },
    { id: "branch-vu-tong-phan", name: "Ladysfit Vũ Tông Phan" },
    { id: "branch-tran-duy-hung", name: "Ladysfit Trần Duy Hưng" },
    { id: "branch-my-dinh", name: "Ladysfit Mỹ Đình" },
    { id: "branch-xa-dan", name: "Ladysfit Xã Đàn" },
    { id: "branch-pham-van-dong", name: "Ladysfit Phạm Văn Đồng" },
  ];

  const branches = await Promise.all(
    branchesData.map((b) =>
      prisma.branch.upsert({
        where: { id: b.id },
        update: { name: b.name },
        create: { id: b.id, name: b.name },
      })
    )
  );

  const branchNguyenXien = branches[0];
  const branchMyDinh = branches[3];

  console.log(`✓ Branches: ${branches.map((b) => b.name).join(", ")}`);

  // Admin
  const adminHash = await bcrypt.hash("Admin@123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@ladysfit.vn" },
    update: {},
    create: {
      email: "admin@ladysfit.vn",
      name: "Admin",
      password: adminHash,
      role: Role.ADMIN,
      branchId: branchNguyenXien.id,
    },
  });

  // PT1
  const ptHash = await bcrypt.hash("PT@123456", 12);
  const pt1 = await prisma.user.upsert({
    where: { email: "pt1@ladysfit.vn" },
    update: {},
    create: {
      email: "pt1@ladysfit.vn",
      name: "Nguyễn Thị Mai",
      password: ptHash,
      role: Role.RESTRICTED,
      branchId: branchNguyenXien.id,
    },
  });

  // PT2
  const pt2 = await prisma.user.upsert({
    where: { email: "pt2@ladysfit.vn" },
    update: {},
    create: {
      email: "pt2@ladysfit.vn",
      name: "Trần Thị Lan",
      password: ptHash,
      role: Role.FREE,
      branchId: branchMyDinh.id,
    },
  });

  console.log(`✓ Users: ${admin.email}, ${pt1.email}, ${pt2.email}`);

  // 3 clients assigned to pt1
  const clientsData = [
    {
      id: "client-1",
      fullName: "Lê Thị Hoa",
      phone: "0901234567",
      dateOfBirth: new Date("1995-03-15"),
      initialWeight: 72,
      targetWeight: 58,
      height: 158,
      initialWaist: 82,
      initialHip: 98,
      status: ClientStatus.ACTIVE,
      factor: 0.75,
    },
    {
      id: "client-2",
      fullName: "Phạm Thị Bích",
      phone: "0912345678",
      dateOfBirth: new Date("1992-07-22"),
      initialWeight: 78,
      targetWeight: 62,
      height: 162,
      initialWaist: 88,
      initialHip: 102,
      status: ClientStatus.ACTIVE,
      factor: 0.65,
    },
    {
      id: "client-3",
      fullName: "Nguyễn Thị Thu",
      phone: "0923456789",
      dateOfBirth: new Date("1998-11-08"),
      initialWeight: 64,
      targetWeight: 54,
      height: 155,
      initialWaist: 76,
      initialHip: 93,
      status: ClientStatus.RESERVED,
      factor: 1.05,
    },
  ];

  for (const c of clientsData) {
    const logs = genWeightLogs(c.initialWeight, c.targetWeight, 28, c.factor);
    const currentWeight = logs[logs.length - 1].weight;

    await prisma.client.upsert({
      where: { id: c.id },
      update: { currentWeight },
      create: {
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        dateOfBirth: c.dateOfBirth,
        initialWeight: c.initialWeight,
        currentWeight,
        targetWeight: c.targetWeight,
        height: c.height,
        initialWaist: c.initialWaist,
        initialHip: c.initialHip,
        assignedPTId: pt1.id,
        branchId: branchNguyenXien.id,
        status: c.status,
        goalNote: "Giảm cân, cải thiện vóc dáng",
      },
    });

    await prisma.weightLog.deleteMany({ where: { clientId: c.id } });
    await prisma.weightLog.createMany({
      data: logs.map((l) => ({ clientId: c.id, date: l.date, weight: l.weight })),
    });

    console.log(`✓ Client ${c.fullName}: ${logs.length} weight logs, current ${currentWeight}kg`);
  }

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
