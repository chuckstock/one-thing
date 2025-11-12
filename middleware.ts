import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const USER_ID_KEY = "pomodoro_user_id";

export function middleware(request: NextRequest) {
  const userId = request.cookies.get(USER_ID_KEY)?.value;
  const isSignInPage = request.nextUrl.pathname === "/signin";
  const isProtectedRoute = request.nextUrl.pathname === "/" || 
                          request.nextUrl.pathname.startsWith("/session");

  // Redirect to signin if accessing protected route without auth
  if (isProtectedRoute && !userId) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  // Redirect to home if accessing signin page while authenticated
  if (isSignInPage && userId) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
