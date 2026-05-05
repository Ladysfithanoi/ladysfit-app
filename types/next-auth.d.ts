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
    };
  }

  interface User {
    role: Role;
    branchId?: string | null;
    managedBranchIds?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    branchId?: string | null;
  }
}
