import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/cookie";
import { isValidToken } from "@/lib/auth/token";

const PUBLIC_PATHS = new Set(["/auth", "/api/auth/logout", "/api/health"]);
const PUBLIC_PREFIXES = ["/_next/", "/favicon", "/og"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Pass-through for public assets / endpoints
  if (PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    const res = NextResponse.next();
    res.headers.set("x-pathname", pathname);
    return res;
  }

  const cookieValue = req.cookies.get(AUTH_COOKIE_NAME)?.value ?? "";
  const expected = process.env.LEARNINGS_AI_TOKEN ?? "";

  if (!isValidToken(cookieValue, expected)) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  res.headers.set("x-pathname", pathname);
  return res;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
