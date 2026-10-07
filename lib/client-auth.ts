import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { Role } from "@prisma/client";
import { decode } from "next-auth/jwt";
import { assertSessionDevice, authorizeLogin } from "@/lib/login-device";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canSimulateCustomer, ensureSimulatedCustomer, TEST_CUSTOMER_EMAIL } from "@/lib/simulate";

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
    // Cài đặt → Giả lập → Khách hàng: Admin vào cổng /my dưới tên khách giả lập
    // do app tạo (lib/simulate.ts). Không có mật khẩu — quyền lấy từ phiên Admin
    // đang đăng nhập ở cùng trình duyệt (cookie phiên nhân viên).
    CredentialsProvider({
      id: "client-simulate",
      name: "Client simulate",
      credentials: {},
      async authorize(_credentials, req) {
        const staff = await readStaffToken(cookieHeaderOf(req));
        if (!staff?.sub || staff.actAs || !(await canSimulateCustomer(staff.sub))) return null;
        try {
          await assertSessionDevice("STAFF", staff);
        } catch {
          return null;
        }
        const clientId = await ensureSimulatedCustomer();
        const client = await prisma.client.findUnique({
          where:  { id: clientId },
          select: { id: true, fullName: true, email: true },
        });
        if (!client) return null;
        return { id: client.id, name: client.fullName, email: client.email, role: Role.PT, simBy: staff.sub };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.did = user.did;
        if (user.simBy) token.simBy = user.simBy;
      }
      if (token.simBy) {
        // Phiên giả lập không gắn máy; chỉ sống khi vẫn trỏ vào khách giả lập
        // và người giả lập vẫn là Admin.
        const client = token.sub
          ? await prisma.client.findUnique({ where: { id: token.sub }, select: { email: true } })
          : null;
        if (client?.email !== TEST_CUSTOMER_EMAIL || !(await canSimulateCustomer(token.simBy))) {
          throw new Error("Phiên giả lập khách hàng đã hết");
        }
        return token;
      }
      // Máy bị gỡ khỏi danh sách tin cậy → throw để NextAuth huỷ phiên.
      await assertSessionDevice("CLIENT", token);
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: { ...session.user, id: token.sub ?? "", deviceId: token.did, simulatedBy: token.simBy },
      };
    },
  },
};

// ─── Đọc phiên nhân viên từ cookie (cho provider "client-simulate") ──────────

function cookieHeaderOf(req: unknown): string {
  const headers = (req as { headers?: Headers | Record<string, string | undefined> } | undefined)?.headers;
  if (!headers) return "";
  if (typeof (headers as Headers).get === "function") return (headers as Headers).get("cookie") ?? "";
  return (headers as Record<string, string | undefined>).cookie ?? "";
}

/** Giải mã JWT nhân viên; NextAuth chia cookie lớn thành name.0, name.1… */
async function readStaffToken(cookieHeader: string) {
  const name = authOptions.cookies?.sessionToken?.name ?? "next-auth.session-token";
  const jar = new Map<string, string>();
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) jar.set(part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim()));
  }
  let raw = jar.get(name);
  if (!raw) {
    const chunks: string[] = [];
    for (let n = 0; jar.has(`${name}.${n}`); n++) chunks.push(jar.get(`${name}.${n}`)!);
    raw = chunks.join("");
  }
  if (!raw) return null;
  try {
    return await decode({ token: raw, secret: process.env.NEXTAUTH_SECRET ?? "" });
  } catch {
    return null;
  }
}
