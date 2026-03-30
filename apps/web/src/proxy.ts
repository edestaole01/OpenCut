import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rotas que não exigem login (conteúdo público)
const publicRoutes = ["/login", "/register", "/privacy", "/terms"];
const authRoutes = ["/login", "/register"];

export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const sessionToken = request.cookies.get("better-auth.session_token")?.value;

	const isPublicRoute = publicRoutes.some(
		(route) => pathname === route || pathname.startsWith(`${route}/`),
	);
	const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

	// Raiz: redireciona conforme autenticação
	if (pathname === "/") {
		if (sessionToken) {
			return NextResponse.redirect(new URL("/dashboard", request.url));
		} else {
			return NextResponse.redirect(new URL("/login", request.url));
		}
	}

	// Rota protegida sem token → login
	if (!sessionToken && !isPublicRoute) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	// Já logado tentando acessar login/register → dashboard
	if (sessionToken && isAuthRoute) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*..*).*)"],
};
