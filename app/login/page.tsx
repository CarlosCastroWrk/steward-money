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

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setIsLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  };

  const handleCreateAccount = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password
    });

    setIsLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.push("/onboarding");
    router.refresh();
  };

  return (
    <section className="flex min-h-screen items-center justify-center bg-zinc-900 p-6 text-zinc-100">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <h1 className="text-2xl font-semibold">Log in to Steward Money</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Use your email and password to sign in or create an account.
        </p>

        <form onSubmit={handleSignIn} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm text-zinc-400">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none ring-0 placeholder:text-zinc-500 focus:border-zinc-600"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm text-zinc-400">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none ring-0 placeholder:text-zinc-500 focus:border-zinc-600"
              placeholder="••••••••"
            />
          </div>

          {errorMessage ? (
            <p className="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">
              {errorMessage}
            </p>
          ) : null}

          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-zinc-100 px-4 py-2 font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={handleCreateAccount}
              disabled={isLoading}
              className="rounded-md border border-zinc-700 px-4 py-2 font-medium text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create account
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
