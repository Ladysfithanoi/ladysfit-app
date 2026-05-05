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
    const cookieName = `${useSecureCookies ? "__Secure-" : ""}my-client-token`;
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
