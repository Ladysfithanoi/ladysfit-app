import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { assertSessionDevice, authorizeLogin } from "@/lib/login-device";
import { canSimulate } from "@/lib/simulate";

// ─── Auth options ─────────────────────────────────────────────────────────────

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
const SESSION_UPDATE_AGE = 24 * 60 * 60;   // renew JWT once per day while user is active

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
    updateAge: SESSION_UPDATE_AGE,
  },
  // Explicit cookie config keeps sessions alive on mobile (Safari/Chrome Mobile).
  // secure=true + sameSite=lax ensures the cookie survives across app-to-browser
  // navigations while still being sent on same-site requests.
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: SESSION_MAX_AGE,
      },
    },
  },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",      type: "email"    },
        password: { label: "Mật khẩu",  type: "password" },
        otp:      { label: "Mã xác minh", type: "text"   },
      },
      async authorize(credentials, req) {
        // Mật khẩu + giới hạn thử sai + xác minh máy lạ bằng mã email: lib/login-device.ts
        const result = await authorizeLogin("STAFF", credentials, req);
        if (!result) return null;
        const { account, did } = result;
        return {
          id:       account.id,
          email:    account.email,
          name:     account.name,
          role:     account.role ?? Role.PT,
          branchId: account.branchId ?? null,
          did,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        // Initial sign-in: populate token from the authorized user object
        token.role     = user.role;
        token.branchId = user.branchId;
        token.iat      = Math.floor(Date.now() / 1000);
        token.did      = user.did;
      }
      // Máy bị gỡ khỏi danh sách tin cậy → throw để NextAuth huỷ phiên.
      await assertSessionDevice("STAFF", token);
      // On explicit session.update() calls (e.g. after role change), refresh iat
      if (trigger === "update") {
        token.iat = Math.floor(Date.now() / 1000);
        // Cài đặt → Giả lập: Admin đóng vai FM/PT. null = thoát giả lập.
        // Kiểm quyền ở server, không tin dữ liệu client gửi lên — xem lib/simulate.ts.
        const target = (session as { simulateUserId?: unknown } | undefined)?.simulateUserId;
        if (target === null) {
          delete token.actAs;
        } else if (typeof target === "string" && token.sub && await canSimulate(token.sub, target)) {
          token.actAs = target;
        }
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
            role:             token.role ?? Role.PT,
            branchId:         token.branchId ?? null,
            managedBranchIds: [],
          },
        };
      }

      // Đang giả lập → mọi màn và API thấy tài khoản được đóng vai. Kiểm lại mỗi
      // lần: Admin bị hạ quyền hoặc tài khoản đích bị xoá thì tự thoát giả lập.
      let impersonator: { id: string; name: string | null } | undefined;
      let effectiveId = token.sub;
      if (token.actAs) {
        const real = await prisma.user.findUnique({
          where:  { id: token.sub },
          select: { id: true, name: true, role: true },
        });
        if (real?.role === Role.ADMIN && await canSimulate(token.sub, token.actAs)) {
          impersonator = { id: real.id, name: real.name };
          effectiveId  = token.actAs;
        }
      }

      const dbUser = await prisma.user.findUnique({
        where:  { id: effectiveId },
        select: {
          name:             true,
          email:            true,
          role:             true,
          branchId:         true,
          managedBranches:  { select: { branchId: true } },
        },
      });

      const resolvedRole = dbUser?.role ?? (impersonator ? Role.PT : token.role ?? Role.PT);

      return {
        ...session,
        user: {
          ...session.user,
          id:               effectiveId,
          name:             dbUser?.name ?? session.user.name,
          email:            impersonator ? dbUser?.email ?? session.user.email : session.user.email,
          role:             resolvedRole,
          branchId:         dbUser?.branchId ?? token.branchId ?? null,
          managedBranchIds: dbUser?.managedBranches?.map((m) => m.branchId) ?? [],
          deviceId:         token.did,
          impersonator,
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
