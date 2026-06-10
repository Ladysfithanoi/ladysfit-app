import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Staff dashboard — requires staff JWT (default cookie)
  if (pathname.startsWith("/dashboard")) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Client portal — requires client JWT (custom cookie)
  if (
    pathname.startsWith("/my") &&
    !pathname.startsWith("/my/login") &&
    !pathname.startsWith("/api/my/auth")
  ) {
    const useSecureCookies = process.env.NODE_ENV === "production";
    // Must match the cookie name set in lib/client-auth.ts (renamed to -v2 in
    // commit 8bd687c). If these drift, a freshly-logged-in client has the new
    // cookie but middleware looks for the old name → it can't find the token and
    // bounces them straight back to /my/login (login spins, then nothing).
    const cookieName = `${useSecureCookies ? "__Secure-" : ""}my-client-token-v2`;
    const token = await getToken({
      req: request,
      cookieName,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token) {
      return NextResponse.redirect(new URL("/my/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/my/:path*"],
};
