import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const isOnboardingPage = pathname.startsWith("/onboarding");

  if (!user) {
    if (isLoginPage) {
      return response;
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginPage) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  // Always use the new onboarding flow
  if (pathname === "/onboarding") {
    const v2Url = request.nextUrl.clone();
    v2Url.pathname = "/onboarding/v2";
    return NextResponse.redirect(v2Url);
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  const onboardingCompleted = settings?.onboarding_completed === true;

  if (!onboardingCompleted && !isOnboardingPage && !pathname.startsWith("/api/")) {
    const onboardingUrl = request.nextUrl.clone();
    onboardingUrl.pathname = "/onboarding/v2";
    return NextResponse.redirect(onboardingUrl);
  }

  return response;
}

export const config = {
  // Exclude static assets AND /auth/callback — the callback must run before
  // middleware so it can exchange the OAuth code and set the session cookie.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|auth/callback).*)"]
};
