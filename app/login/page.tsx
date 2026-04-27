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
  const [mode, setMode] = useState<"signin" | "signup">("signin");

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

  const INPUT = "w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/40";

  return (
    <section className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 py-12">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-900/50">
          <span className="text-2xl font-black text-white" style={{ letterSpacing: "-1px" }}>S</span>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-white tracking-tight">Steward Money</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Your personal financial co-pilot</p>
        </div>
      </div>

      <div className="w-full max-w-sm">
        {/* Tab switcher */}
        <div className="mb-6 flex rounded-xl border border-zinc-800 bg-zinc-900 p-1">
          <button
            type="button"
            onClick={() => { setMode("signin"); setErrorMessage(null); }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${mode === "signin" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setErrorMessage(null); }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${mode === "signup" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={INPUT}
            placeholder="Email address"
            autoComplete="email"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={INPUT}
            placeholder="Password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />

          {errorMessage && (
            <p className="rounded-xl border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-300">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        {mode === "signup" && (
          <p className="mt-4 text-center text-xs text-zinc-600">
            By creating an account you agree to our terms of service.
          </p>
        )}
      </div>
    </section>
  );
}
