import { NextRequest, NextResponse } from "next/server";

  const protectedPagePaths = ["/", "/chat", "/decisions", "/graph", "/timeline", "/settings", "/team", "/brief"];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const hasSession = Boolean(request.cookies.get("onecontext_session")?.value);
  const isProtectedPage = protectedPagePaths.some((protectedPath) => path === protectedPath || path.startsWith(`${protectedPath}/`));
  const isProtectedApi = path.startsWith("/api/v1/projects") || path.startsWith("/api/v1/context") || path === "/api/v1/chat" || (path.startsWith("/api/v1/teams") && path !== "/api/v1/teams/join" && path !== "/api/v1/teams/events");

  if (!hasSession && isProtectedPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }
  if (!hasSession && isProtectedApi) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 });
  return NextResponse.next();
}

export const config = { matcher: ["/", "/chat/:path*", "/decisions/:path*", "/graph/:path*", "/timeline/:path*", "/settings/:path*", "/team/:path*", "/brief/:path*", "/api/v1/projects/:path*", "/api/v1/context/:path*", "/api/v1/chat", "/api/v1/teams/:path*"] };
