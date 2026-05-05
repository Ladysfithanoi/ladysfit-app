import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user?.password) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          branchId: user.branchId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.branchId = user.branchId;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.sub) {
        return {
          ...session,
          user: {
            ...session.user,
            id: "",
            role: token.role ?? Role.FREE,
            branchId: token.branchId ?? null,
            managedBranchIds: [],
          },
        };
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: token.sub },
        select: {
          name: true,
          role: true,
          branchId: true,
          freeUpgradedAt: true,
          managedBranches: { select: { branchId: true } },
        },
      });

      let resolvedRole = dbUser?.role ?? token.role ?? Role.FREE;

      // Auto-downgrade FREE to RESTRICTED if 30-day window expired (day-based, no time skew)
      if (resolvedRole === "FREE" && dbUser?.freeUpgradedAt) {
        const upgraded = new Date(dbUser.freeUpgradedAt);
        upgraded.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysUsed = Math.floor((today.getTime() - upgraded.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUsed >= 30) {
          await prisma.user.update({
            where: { id: token.sub },
            data: { role: "RESTRICTED", freeUpgradedAt: null },
          });
          resolvedRole = Role.RESTRICTED;
        }
      }

      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub,
          name: dbUser?.name ?? session.user.name,
          role: resolvedRole,
          branchId: dbUser?.branchId ?? token.branchId ?? null,
          managedBranchIds: dbUser?.managedBranches?.map((m) => m.branchId) ?? [],
        },
      };
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/dashboard`;
    },
  },
};
