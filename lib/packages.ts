export type PackageDef = {
  name: string;
  stage: "1" | "2" | "3";
  stageLabel: string;
  sessions: number;
  connectSessions?: number;
  durationDays: number;
  price: number;
  discountedPrice?: number;
  commitment: string;
  conditions: string;
  canBuyMultiple: boolean;
};

export const PACKAGES: Record<string, PackageDef> = {
  L0: {
    name: "L0",
    stage: "1",
    stageLabel: "Lộ trình trải nghiệm - Giai đoạn 1",
    sessions: 4,
    durationDays: 30,
    price: 2_000_000,
    commitment: "Trải nghiệm 4 buổi tập cùng PT",
    conditions:
      "Được hoàn tiền: sau khi tập xong buổi 1, và khi tập hết 4 buổi. PT nhận 50.000đ/buổi dạy. Chỉ mua 1 lần.",
    canBuyMultiple: false,
  },
  L1: {
    name: "L1",
    stage: "1",
    stageLabel: "Giai đoạn 1 - Giảm cân nhanh",
    sessions: 21,
    durationDays: 30,
    price: 12_000_000,
    discountedPrice: 6_000_000,
    commitment: "Cam kết giảm 2–5 kg",
    conditions: "Tập tối thiểu 6 buổi/tuần. Cân nặng thực > chiều cao tối thiểu 3 kg. Chỉ mua 1 lần.",
    canBuyMultiple: false,
  },
  L2: {
    name: "L2",
    stage: "1",
    stageLabel: "Giai đoạn 1 - Giảm cân nhanh",
    sessions: 60,
    durationDays: 80,
    price: 36_000_000,
    discountedPrice: 15_000_000,
    commitment: "Cam kết giảm 5–9 kg",
    conditions: "Tập tối thiểu 6 buổi/tuần. Cân nặng thực > chiều cao tối thiểu 6 kg. Chỉ mua 1 lần.",
    canBuyMultiple: false,
  },
  L3: {
    name: "L3",
    stage: "2",
    stageLabel: "Giai đoạn 2 - Hoàn thiện vóc dáng",
    sessions: 50,
    durationDays: 120,
    price: 25_000_000,
    commitment: "Giảm 2–5 kg hoặc BDF xuống 18–20%",
    conditions: "Tập tối thiểu 4 buổi/tuần. Mua được nhiều lần.",
    canBuyMultiple: true,
  },
  L4: {
    name: "L4",
    stage: "2",
    stageLabel: "Giai đoạn 2 - Hoàn thiện vóc dáng",
    sessions: 100,
    durationDays: 180,
    price: 45_000_000,
    commitment: "Giảm 5–9 kg hoặc BDF xuống 18–20%",
    conditions: "Tập tối thiểu 4 buổi/tuần. Mua được nhiều lần.",
    canBuyMultiple: true,
  },
  L5: {
    name: "L5",
    stage: "3",
    stageLabel: "Giai đoạn 3 - Duy trì thói quen",
    sessions: 72,
    connectSessions: 24,
    durationDays: 180,
    price: 36_000_000,
    commitment: "72 buổi PT + 24 buổi Connect Workout",
    conditions: "Bảo lưu 2 lần miễn phí (tối đa 30 ngày/lần). Nghỉ thai sản 9–18 tháng. Gia hạn: 500k/10 ngày, 1tr/30 ngày.",
    canBuyMultiple: true,
  },
  Loyalfit: {
    name: "Loyalfit",
    stage: "3",
    stageLabel: "Giai đoạn 3 - Duy trì thói quen",
    sessions: 36,
    durationDays: 90,
    price: 15_000_000,
    commitment: "Tối đa 12 buổi/tháng",
    conditions: "Chỉ dành cho khách hàng đã từng mua sản phẩm tại LDF.",
    canBuyMultiple: true,
  },
  "Cư dân": {
    name: "Cư dân",
    stage: "1",
    stageLabel: "Lộ trình tài trợ - Gói cư dân",
    sessions: 21,
    durationDays: 30,
    price: 0,
    commitment: "Cam kết giảm 2–5 kg",
    conditions: "Gói tài trợ dành cho cư dân toà nhà. Cấu trúc như L1 (21 buổi / 30 ngày). PT nhận 35.000đ/buổi dạy, không ghi nhận doanh số. Chỉ mua 1 lần.",
    canBuyMultiple: false,
  },
  KOC: {
    name: "KOC",
    stage: "1",
    stageLabel: "Lộ trình tặng - Hợp đồng KOC",
    sessions: 60,
    durationDays: 60,
    price: 0,
    commitment: "Cam kết giảm 3–9.9kg trong 60 buổi / 60 ngày",
    conditions: "Nữ, tuổi 25–45, cân nặng ≥ 70kg, chiều cao < 160cm. FM xác nhận cân đầu & cuối.",
    canBuyMultiple: false,
  },
};

/** Gói tài trợ cho cư dân toà nhà — miễn phí, PT nhận 35k/buổi, không tính doanh số. */
export const RESIDENT_PACKAGE = "Cư dân";

/** Gói được tài trợ (khách không trả tiền) → không sinh doanh số cho PT. */
export function isSponsoredPackage(packageName: string) {
  return packageName === RESIDENT_PACKAGE || packageName === "KOC";
}

/** Gói trải nghiệm 4 buổi — có riêng một bậc tiền buổi dạy. */
export const TRIAL_PACKAGE = "L0";

export const SESSION_PAY_RESIDENT = 35_000;
export const SESSION_PAY_TRIAL = 50_000;
export const SESSION_PAY_L1_L2_LOYAL = 60_000;
export const SESSION_PAY_L3_L4_L5 = 100_000;

/**
 * Tiền công 1 buổi dạy trả cho PT, theo tên gói của khách được dạy.
 * KOC/KOL không dùng hàm này — hai loại hợp đồng đó có cách tính hoa hồng riêng.
 */
export function sessionPayRate(packageName: string): number {
  if (packageName === RESIDENT_PACKAGE) return SESSION_PAY_RESIDENT;
  if (packageName === TRIAL_PACKAGE) return SESSION_PAY_TRIAL;
  return ["L1", "L2", "Loyalfit"].includes(packageName)
    ? SESSION_PAY_L1_L2_LOYAL
    : SESSION_PAY_L3_L4_L5;
}

export function formatPrice(n: number) {
  const m = n / 1_000_000;
  return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + " triệu";
}
