import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = ["/", "/login", "/register", "/blog", "/roadmap", "/contributors", "/sponsors", "/changelog", "/privacy", "/terms", "/brand"];
const authRoutes = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get("better-auth.session_token")?.value;

  const isPublicRoute = publicRoutes.some(route =>
    pathname === route || pathname.startsWith(`${route}/`)
  );
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  if (!sessionToken && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (sessionToken && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\..*).*)"],
};
