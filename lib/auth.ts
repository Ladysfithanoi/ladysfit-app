import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

// ─── In-memory login rate limiter ────────────────────────────────────────────
// Tracks failed attempts per IP. Resets after 15 minutes.
// Note: single-instance only. Use Redis/Upstash for multi-instance deployments.

const loginFailures = new Map<string, { count: number; windowStart: number }>();
const MAX_FAILURES  = 5;
const WINDOW_MS     = 15 * 60 * 1000; // 15 minutes

function getClientIp(req: unknown): string {
  if (!req || typeof req !== "object") return "unknown";
  const headers = (req as { headers?: Record<string, string | string[]> }).headers;
  if (!headers) return "unknown";
  const forwarded = headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  if (Array.isArray(forwarded) && forwarded.length > 0) return forwarded[0].split(",")[0].trim();
  return "unknown";
}

function isRateLimited(ip: string): boolean {
  const entry = loginFailures.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.windowStart > WINDOW_MS) {
    loginFailures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(ip: string): void {
  const now   = Date.now();
  const entry = loginFailures.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    loginFailures.set(ip, { count: 1, windowStart: now });
  } else {
    entry.count++;
  }
}

function clearFailures(ip: string): void {
  loginFailures.delete(ip);
}

// ─── Auth options ─────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours — expire after one working day
  },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",      type: "email"    },
        password: { label: "Mật khẩu",  type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const ip = getClientIp(req);

        if (isRateLimited(ip)) {
          throw new Error("Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        });

        if (!user?.password) {
          recordFailure(ip);
          return null;
        }

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) {
          recordFailure(ip);
          return null;
        }

        clearFailures(ip);

        return {
          id:       user.id,
          email:    user.email,
          name:     user.name,
          role:     user.role,
          branchId: user.branchId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role     = user.role;
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
            id:               "",
            role:             token.role ?? Role.FREE,
            branchId:         token.branchId ?? null,
            managedBranchIds: [],
          },
        };
      }

      const dbUser = await prisma.user.findUnique({
        where:  { id: token.sub },
        select: {
          name:             true,
          role:             true,
          branchId:         true,
          freeUpgradedAt:   true,
          managedBranches:  { select: { branchId: true } },
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
            data:  { role: "RESTRICTED", freeUpgradedAt: null },
          });
          resolvedRole = Role.RESTRICTED;
        }
      }

      return {
        ...session,
        user: {
          ...session.user,
          id:               token.sub,
          name:             dbUser?.name ?? session.user.name,
          role:             resolvedRole,
          branchId:         dbUser?.branchId ?? token.branchId ?? null,
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
