import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { Role } from "@prisma/client";
import { assertSessionDevice, authorizeLogin } from "@/lib/login-device";

const useSecureCookies = process.env.NODE_ENV === "production";

export const clientAuthOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/my/login" },
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: `${useSecureCookies ? "__Secure-" : ""}my-client-token-v2`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  providers: [
    CredentialsProvider({
      id: "client-credentials",
      name: "Client",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
        otp: { label: "Mã xác minh", type: "text" },
      },
      async authorize(credentials, req) {
        // Mật khẩu + giới hạn thử sai + xác minh máy lạ bằng mã email: lib/login-device.ts
        const result = await authorizeLogin("CLIENT", credentials, req);
        if (!result) return null;
        const { account, did } = result;
        return {
          id: account.id,
          name: account.name,
          email: account.email,
          role: Role.PT,
          did,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.did = user.did;
      }
      // Máy bị gỡ khỏi danh sách tin cậy → throw để NextAuth huỷ phiên.
      await assertSessionDevice("CLIENT", token);
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: { ...session.user, id: token.sub ?? "", deviceId: token.did },
      };
    },
  },
};
