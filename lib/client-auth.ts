import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("[client-auth] missing credentials");
          return null;
        }

        const email = credentials.email.trim().toLowerCase();
        console.log("[client-auth] looking up email:", email);

        // Try exact match first, fall back to case-insensitive search
        let client = await prisma.client.findUnique({
          where: { email },
        });
        if (!client) {
          client = await prisma.client.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
          });
          console.log("[client-auth] case-insensitive fallback found:", !!client);
        }

        console.log("[client-auth] client found:", !!client, "has password:", !!client?.password);

        if (!client?.password) return null;

        const valid = await bcrypt.compare(credentials.password, client.password);
        console.log("[client-auth] password valid:", valid);
        if (!valid) return null;

        return {
          id: client.id,
          name: client.fullName,
          email: client.email ?? "",
          role: Role.PT,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: { ...session.user, id: token.sub ?? "" },
      };
    },
  },
};
