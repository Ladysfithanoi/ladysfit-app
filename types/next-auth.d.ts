import { Role } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: Role;
      branchId?: string | null;
      managedBranchIds: string[];
      // id dòng trusted_devices của máy đang dùng (lib/login-device.ts)
      deviceId?: string;
      // Có khi Admin đang giả lập tài khoản này (Cài đặt → Giả lập)
      impersonator?: { id: string; name: string | null };
      // Cổng khách hàng: id Admin đang giả lập khách test (lib/client-auth.ts)
      simulatedBy?: string;
    };
  }

  interface User {
    role: Role;
    branchId?: string | null;
    managedBranchIds?: string[];
    did?: string;
    simBy?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    branchId?: string | null;
    did?: string;
    // id tài khoản Admin đang đóng vai (lib/simulate.ts)
    actAs?: string;
    // Phiên cổng khách do Admin giả lập (lib/client-auth.ts)
    simBy?: string;
  }
}
