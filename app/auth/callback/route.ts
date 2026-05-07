import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookies) { cookiesToSet.push(...cookies); },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    console.error("[auth/callback] exchange failed:", error?.message);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const user = data.session.user;
  const isNewUser = (new Date().getTime() - new Date(user.created_at).getTime()) < 30_000;

  // Ensure user_settings row exists
  await supabase.from("user_settings").upsert(
    { user_id: user.id },
    { onConflict: "user_id", ignoreDuplicates: true }
  );

  // Send welcome email for new users
  if (isNewUser) {
    const displayName = user.user_metadata?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there";
    fetch(`${origin}/api/email/welcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, name: displayName }),
    }).catch(() => {});
  }

  // Check if onboarding is complete
  const { data: settings } = await supabase
    .from("user_settings")
    .select("onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  const redirectPath = settings?.onboarding_completed ? next : "/onboarding";
  const response = NextResponse.redirect(`${origin}${redirectPath}`);

  // Write auth cookies onto the redirect response so the browser receives them
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));

  return response;
}
