"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const INPUT = "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-[var(--text-1)] placeholder-[var(--text-3)] outline-none transition focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30";

  async function handleGoogleSignIn() {
    setErrorMessage(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      setErrorMessage(error.message);
      setGoogleLoading(false);
    }
    // On success the browser redirects — no setLoading(false) needed
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setIsLoading(false);
      if (error) { setErrorMessage(error.message); return; }
      router.push("/");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      setIsLoading(false);
      if (error) { setErrorMessage(error.message); return; }
      router.push("/onboarding");
      router.refresh();
    }
  }

  return (
    <section className="flex min-h-screen flex-col items-center justify-center px-6 py-12"
      style={{ background: "radial-gradient(ellipse at top, var(--accent-glow) 0%, var(--bg-base) 60%)" }}
    >
      {/* Wordmark */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-[18px] shadow-lg"
          style={{ background: "var(--accent)", boxShadow: "0 0 32px var(--accent-glow)" }}
        >
          <span className="text-3xl font-black text-white" style={{ letterSpacing: "-1.5px" }}>S</span>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-1)]"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            Steward Money
          </h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">your money, with intention</p>
        </div>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {/* Google OAuth — primary option */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || isLoading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm font-medium text-[var(--text-1)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-50"
        >
          {googleLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--text-3)] border-t-[var(--text-1)]" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
              <path d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" fill="#FFC107"/>
              <path d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" fill="#FF3D00"/>
              <path d="M24 44c5.5 0 10.4-2.1 14.1-5.4l-6.5-5.5C29.6 35 26.9 36 24 36c-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.6 40.1 16.3 44 24 44z" fill="#4CAF50"/>
              <path d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.5 5.5C37.3 38.9 44 33.9 44 24c0-1.3-.1-2.7-.4-3.5z" fill="#1976D2"/>
            </svg>
          )}
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-xs text-[var(--text-3)]">or</span>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>

        {/* Email/password */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-3">
          {/* Tab switcher */}
          <div className="flex rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
            <button type="button" onClick={() => { setMode("signin"); setErrorMessage(null); }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${mode === "signin" ? "bg-[var(--bg-card)] text-[var(--text-1)] shadow-sm" : "text-[var(--text-3)] hover:text-[var(--text-2)]"}`}>
              Sign in
            </button>
            <button type="button" onClick={() => { setMode("signup"); setErrorMessage(null); }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${mode === "signup" ? "bg-[var(--bg-card)] text-[var(--text-1)] shadow-sm" : "text-[var(--text-3)] hover:text-[var(--text-2)]"}`}>
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              required className={INPUT} placeholder="Email address" autoComplete="email" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required className={INPUT} placeholder="Password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"} />

            {errorMessage && (
              <p className="rounded-xl border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </p>
            )}

            <button type="submit" disabled={isLoading || googleLoading}
              className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {isLoading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        {mode === "signup" && (
          <p className="text-center text-xs text-[var(--text-3)]">
            By creating an account you agree to our terms of service.
          </p>
        )}

        {/* Apple OAuth note — requires Apple Developer membership + native app */}
        {/* Apple Sign-In intentionally omitted: requires iOS app entitlement and Apple Developer Program */}
      </div>
    </section>
  );
}
