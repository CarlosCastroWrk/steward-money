"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Screen = "welcome" | "step1" | "step2" | "step3";

const LIFE_STAGES = [
  { id: "student",       label: "Student",        emoji: "🎓" },
  { id: "early_career",  label: "Early career",   emoji: "🚀" },
  { id: "established",   label: "Established",    emoji: "💼" },
  { id: "family",        label: "Building family", emoji: "🏠" },
  { id: "entrepreneur",  label: "Entrepreneur",   emoji: "⚡" },
  { id: "other",         label: "Other",          emoji: "✨" },
];

const GOAL_PRESETS = [
  "Get out of debt",
  "Build emergency fund",
  "Buy a home",
  "Invest consistently",
  "Travel more",
  "Start a business",
  "Save for school",
];

interface FormState {
  name: string;
  lifeStage: string;
  goal: string;
}

export default function OnboardingV2() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("welcome");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({ name: "", lifeStage: "", goal: "" });

  async function finishOnboarding() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    await supabase.from("user_settings").upsert({
      user_id: user.id,
      display_name: form.name.trim() || null,
      life_stage: form.lifeStage || "other",
      main_goal: form.goal.trim() || null,
      onboarding_completed: true,
      onboarding_version: "v2",
      emergency_buffer: 500,
      giving_enabled: false,
      giving_value: 10,
      savings_value: 10,
      weekly_groceries_min: 100,
      weekly_gas_min: 40,
      weekly_eating_out_cap: 60,
      weekly_misc_cap: 50,
    }, { onConflict: "user_id" });

    router.push("/");
    router.refresh();
  }

  if (screen === "welcome") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-6 text-center">
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)] shadow-2xl shadow-[var(--accent)]/40">
          <span className="font-display text-2xl font-bold text-white">S</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Welcome to Steward
        </h1>
        <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-[var(--text-muted)]">
          Your personal financial OS. Let&apos;s get you set up in 2 minutes.
        </p>
        <button
          type="button"
          onClick={() => setScreen("step1")}
          className="mt-10 rounded-2xl bg-[var(--accent)] px-8 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-[var(--accent)]/30 transition-all hover:bg-[var(--accent-deep)] active:scale-[0.98]"
        >
          Get started
        </button>
        <p className="mt-4 text-xs text-[var(--text-dim)]">No credit card required</p>
      </div>
    );
  }

  if (screen === "step1") {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--bg)] px-6 py-12">
        <StepHeader step={1} total={3} onBack={() => setScreen("welcome")} />
        <div className="mx-auto w-full max-w-sm flex-1 pt-8">
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Who are you?</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Steward tailors itself to your situation.</p>

          <div className="mt-8 space-y-5">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                Your name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="First name"
                autoFocus
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                Where are you at?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {LIFE_STAGES.map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, lifeStage: stage.id }))}
                    className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                      form.lifeStage === stage.id
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]"
                        : "border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <span className="text-base">{stage.emoji}</span>
                    <span className="text-[13px] font-medium">{stage.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm pb-6">
          <button
            type="button"
            onClick={() => setScreen("step2")}
            disabled={!form.name.trim()}
            className="w-full rounded-2xl bg-[var(--accent)] py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-[var(--accent)]/30 transition-all hover:bg-[var(--accent-deep)] disabled:opacity-40 active:scale-[0.98]"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (screen === "step2") {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--bg)] px-6 py-12">
        <StepHeader step={2} total={3} onBack={() => setScreen("step1")} />
        <div className="mx-auto w-full max-w-sm flex-1 pt-8">
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Connect your bank</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            See real balances and transactions. Takes 30 seconds.
          </p>

          <div className="mt-8 space-y-3">
            <PlaidConnectButton />

            <button
              type="button"
              onClick={() => setScreen("step3")}
              className="w-full rounded-xl border border-[var(--border-default)] py-3.5 text-sm text-[var(--text-muted)] transition-all hover:text-[var(--text-secondary)]"
            >
              Skip for now
            </button>
          </div>

          <p className="mt-6 text-center text-[11px] text-[var(--text-dim)]">
            Bank-level encryption via Plaid. We never store your credentials.
          </p>
        </div>
      </div>
    );
  }

  // step3
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] px-6 py-12">
      <StepHeader step={3} total={3} onBack={() => setScreen("step2")} />
      <div className="mx-auto w-full max-w-sm flex-1 pt-8">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          One goal to start
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          What&apos;s the main thing you&apos;re working toward? You can add more later.
        </p>

        <div className="mt-8 space-y-5">
          <input
            type="text"
            value={form.goal}
            onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
            placeholder="e.g. Build a 3-month emergency fund"
            autoFocus
            className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30"
          />

          <div className="flex flex-wrap gap-2">
            {GOAL_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setForm((f) => ({ ...f, goal: preset }))}
                className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                  form.goal === preset
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]"
                    : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-default)]"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-sm space-y-3 pb-6">
        <button
          type="button"
          onClick={finishOnboarding}
          disabled={saving}
          className="w-full rounded-2xl bg-[var(--accent)] py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-[var(--accent)]/30 transition-all hover:bg-[var(--accent-deep)] disabled:opacity-40 active:scale-[0.98]"
        >
          {saving ? "Setting up…" : "Enter Steward"}
        </button>
        {!form.goal.trim() && (
          <button
            type="button"
            onClick={finishOnboarding}
            disabled={saving}
            className="w-full text-center text-xs text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors"
          >
            Skip and set later
          </button>
        )}
      </div>
    </div>
  );
}

function StepHeader({ step, total, onBack }: { step: number; total: number; onBack: () => void }) {
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--text-secondary)]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flex gap-1.5">
          {Array.from({ length: total }, (_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i + 1 === step ? "w-6 bg-[var(--accent)]" : i + 1 < step ? "w-3 bg-[var(--accent)]/40" : "w-3 bg-[var(--border-default)]"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-[var(--text-dim)]">{step}/{total}</span>
      </div>
    </div>
  );
}

function PlaidConnectButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    setLoading(true);
    setError("");
    try {
      const tokenRes = await fetch("/api/plaid/create-link-token", { method: "POST" });
      if (!tokenRes.ok) throw new Error("Could not start bank connection");
      const { link_token } = await tokenRes.json();

      const { open } = await import("react-plaid-link").then((m) => ({ open: m.usePlaidLink }));
      // Plaid Link is initialized via script — we'll open directly
      const script = document.createElement("script");
      script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
      script.onload = () => {
        const plaid = (window as Window & typeof globalThis & { Plaid: { create: (cfg: unknown) => { open: () => void } } }).Plaid;
        const handler = plaid.create({
          token: link_token,
          onSuccess: async (public_token: string) => {
            await fetch("/api/plaid/exchange-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ public_token }),
            });
            setLoading(false);
          },
          onExit: () => setLoading(false),
        });
        handler.open();
      };
      document.head.appendChild(script);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleConnect}
        disabled={loading}
        className="w-full rounded-2xl bg-[var(--accent)] py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-[var(--accent)]/30 transition-all hover:bg-[var(--accent-deep)] disabled:opacity-40 active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/>
          <line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
        {loading ? "Connecting…" : "Connect my bank"}
      </button>
      {error && <p className="mt-2 text-center text-xs text-[var(--color-expense)]">{error}</p>}
    </div>
  );
}
