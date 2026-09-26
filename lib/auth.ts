import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { assertSessionDevice, authorizeLogin } from "@/lib/login-device";

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
    async jwt({ token, user, trigger }) {
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

      const dbUser = await prisma.user.findUnique({
        where:  { id: token.sub },
        select: {
          name:             true,
          role:             true,
          branchId:         true,
          managedBranches:  { select: { branchId: true } },
        },
      });

      const resolvedRole = dbUser?.role ?? token.role ?? Role.PT;

      return {
        ...session,
        user: {
          ...session.user,
          id:               token.sub,
          name:             dbUser?.name ?? session.user.name,
          role:             resolvedRole,
          branchId:         dbUser?.branchId ?? token.branchId ?? null,
          managedBranchIds: dbUser?.managedBranches?.map((m) => m.branchId) ?? [],
          deviceId:         token.did,
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
