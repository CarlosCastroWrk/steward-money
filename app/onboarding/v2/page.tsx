"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, PlaidLinkOnSuccess } from "react-plaid-link";
import { createClient } from "@/lib/supabase/client";

type Screen = "welcome" | "step1" | "step2" | "step3" | "step4";

const LIFE_STAGES = [
  { id: "student",      label: "Student",         emoji: "🎓" },
  { id: "early_career", label: "Early career",    emoji: "🚀" },
  { id: "established",  label: "Established",     emoji: "💼" },
  { id: "family",       label: "Building family", emoji: "🏠" },
  { id: "entrepreneur", label: "Entrepreneur",    emoji: "⚡" },
  { id: "other",        label: "Other",           emoji: "✨" },
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

async function saveAndComplete(form: FormState): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { window.location.href = "/login"; return; }

  await supabase.from("user_settings").upsert({
    user_id: user.id,
    display_name: form.name.trim() || null,
    life_stage: form.lifeStage || "other",
    main_goal: form.goal.trim() || null,
    onboarding_completed: true,
    onboarding_version: "v2",
    emergency_buffer: 0,
    giving_enabled: false,
    giving_value: 10,
    savings_value: 10,
    weekly_groceries_min: 0,
    weekly_gas_min: 0,
    weekly_eating_out_cap: 0,
    weekly_misc_cap: 0,
  }, { onConflict: "user_id" });

  // Hard navigation so middleware reads fresh onboarding_completed from DB
  window.location.href = "/";
}

const HAS_GOOGLE_CLIENT_ID = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

export default function OnboardingV2() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({ name: "", lifeStage: "", goal: "" });

  async function finishOnboarding() {
    setSaving(true);
    await saveAndComplete(form);
    // saveAndComplete does a hard redirect; setSaving stays true until redirect
  }

  function goToNextAfterGoal() {
    if (HAS_GOOGLE_CLIENT_ID) {
      setScreen("step4");
    } else {
      finishOnboarding();
    }
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
      <div className="flex min-h-screen flex-col bg-[var(--bg)] px-6 pt-12">
        <StepHeader step={1} total={3} onBack={() => setScreen("welcome")} />
        <div className="mx-auto w-full max-w-sm flex-1 pt-8">
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Who are you?</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Steward tailors itself to your situation.</p>

          <div className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
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
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                Where are you at?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {LIFE_STAGES.map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, lifeStage: stage.id }))}
                    className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left transition-all ${
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

        <div className="mx-auto w-full max-w-sm" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}>
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
      <div className="flex min-h-screen flex-col bg-[var(--bg)] px-6 pt-12">
        <StepHeader step={2} total={3} onBack={() => setScreen("step1")} />
        <div className="mx-auto w-full max-w-sm flex-1 pt-8">
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Connect your bank</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            See real balances and transactions. Takes 30 seconds.
          </p>

          <div className="mt-8 space-y-3">
            <PlaidConnectButton onConnected={() => setScreen("step3")} />

            <button
              type="button"
              onClick={finishOnboarding}
              disabled={saving}
              className="w-full rounded-xl border border-[var(--border-default)] py-3.5 text-sm text-[var(--text-muted)] transition-all hover:text-[var(--text-secondary)] disabled:opacity-40"
            >
              {saving ? "Saving…" : "Skip for now"}
            </button>
          </div>

          <p className="mt-6 text-center text-[11px] text-[var(--text-dim)]">
            Bank-level encryption via Plaid. We never store your credentials.
          </p>
        </div>
      </div>
    );
  }

  if (screen === "step3") {
    const totalSteps = HAS_GOOGLE_CLIENT_ID ? 4 : 3;
    return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] px-6 pt-12">
      <StepHeader step={3} total={totalSteps} onBack={() => setScreen("step2")} />
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

      <div
        className="mx-auto w-full max-w-sm space-y-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
      >
        <button
          type="button"
          onClick={HAS_GOOGLE_CLIENT_ID ? goToNextAfterGoal : finishOnboarding}
          disabled={saving}
          className="w-full rounded-2xl bg-[var(--accent)] py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-[var(--accent)]/30 transition-all hover:bg-[var(--accent-deep)] disabled:opacity-40 active:scale-[0.98]"
        >
          {saving ? "Setting up…" : HAS_GOOGLE_CLIENT_ID ? "Continue" : "Enter Steward"}
        </button>
        {!form.goal.trim() && (
          <button
            type="button"
            onClick={finishOnboarding}
            disabled={saving}
            className="w-full text-center text-xs text-[var(--text-dim)] transition-colors hover:text-[var(--text-muted)]"
          >
            Skip and set later
          </button>
        )}
      </div>
    </div>
    );
  }

  // step4 — optional calendar connection (only shown when NEXT_PUBLIC_GOOGLE_CLIENT_ID is set)
  return <CalendarOnboardingStep onFinish={finishOnboarding} saving={saving} />;
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
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex gap-1.5">
          {Array.from({ length: total }, (_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i + 1 === step
                  ? "w-6 bg-[var(--accent)]"
                  : i + 1 < step
                  ? "w-3 bg-[var(--accent)]/40"
                  : "w-3 bg-[var(--border-default)]"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-[var(--text-dim)]">
          {step}/{total}
        </span>
      </div>
    </div>
  );
}

// Outer shell: fetches the link token, then hands it to PlaidLinkReady.
// Keeping these separate ensures usePlaidLink is never called with token="",
// which prevents it from initializing properly in react-plaid-link v4.
function PlaidConnectButton({ onConnected }: { onConnected: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.link_token) {
          setLinkToken(d.link_token);
        } else {
          setFetchError("Could not initialize bank connection.");
        }
      })
      .catch(() => setFetchError("Could not reach server. You can skip and connect later."));
  }, []);

  if (fetchError) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] py-3.5 text-[15px] font-semibold text-white opacity-40"
        >
          Connect my bank
        </button>
        <p className="text-center text-xs text-[var(--color-expense)]">{fetchError}</p>
      </div>
    );
  }

  if (!linkToken) {
    return (
      <button
        type="button"
        disabled
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] py-3.5 text-[15px] font-semibold text-white opacity-40"
      >
        Loading…
      </button>
    );
  }

  return <PlaidLinkReady token={linkToken} onConnected={onConnected} />;
}

// Inner component: only rendered once a valid token exists.
// usePlaidLink gets a real token on first call and becomes ready immediately.
function PlaidLinkReady({ token, onConnected }: { token: string; onConnected: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      setSyncing(true);
      setError("");
      try {
        const res = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            institution_name: metadata.institution?.name ?? null,
            institution_id: metadata.institution?.institution_id ?? null,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? "Exchange failed");
        }
        setConnected(true);
        onConnected();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. You can skip and try later.");
      } finally {
        setSyncing(false);
      }
    },
    [onConnected]
  );

  const { open, ready } = usePlaidLink({ token, onSuccess });

  if (connected) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-[var(--color-income)]/30 bg-[var(--color-income)]/10 px-4 py-3.5">
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--color-income)]" />
        <p className="text-sm text-[var(--text-primary)]">Bank connected!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => open()}
        disabled={!ready || syncing}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-[var(--accent)]/30 transition-all hover:bg-[var(--accent-deep)] disabled:opacity-40 active:scale-[0.98]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
        {syncing ? "Connecting…" : ready ? "Connect my bank" : "Preparing…"}
      </button>
      {error && <p className="text-center text-xs text-[var(--color-expense)]">{error}</p>}
    </div>
  );
}

// ─── Step 4: Calendar opt-in ──────────────────────────────────────────────────

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

function CalendarOnboardingStep({ onFinish, saving }: { onFinish: () => void; saving: boolean }) {
  const [gsiLoaded, setGsiLoaded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  useEffect(() => {
    if (window.google?.accounts) {
      setGsiLoaded(true);
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => setGsiLoaded(true);
      document.head.appendChild(script);
    }
  }, []);

  function handleConnect() {
    if (!clientId || !gsiLoaded || !window.google) return;
    setConnecting(true);

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      callback: async (resp) => {
        if (resp.error || !resp.access_token) {
          setConnecting(false);
          return;
        }
        await fetch("/api/calendar/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: resp.access_token }),
        });
        await fetch("/api/calendar/sync", { method: "POST" });
        setConnected(true);
        setConnecting(false);
        setTimeout(() => onFinish(), 1200);
      },
    });

    client.requestAccessToken();
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] px-6 pt-12">
      <StepHeader step={4} total={4} onBack={() => {}} />
      <div className="mx-auto w-full max-w-sm flex-1 pt-8">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Sync your calendar?</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">
          This is optional but powerful. When I know what&apos;s on your calendar, I can give you smarter guidance. A wedding in 3 months means save now. A business trip means budget for travel.
        </p>

        {connected ? (
          <div className="mt-8 flex items-center gap-3 rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-4 py-4">
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400" />
            <p className="text-sm text-[var(--text-primary)]">Calendar connected. Setting up your account…</p>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting || !gsiLoaded}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] py-3.5 text-[15px] font-semibold text-[var(--text-primary)] transition-all hover:border-[var(--border-strong)] disabled:opacity-40 active:scale-[0.98]"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" fill="#FFC107"/>
                <path d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" fill="#FF3D00"/>
                <path d="M24 44c5.5 0 10.4-2.1 14.1-5.4l-6.5-5.5C29.6 35 26.9 36 24 36c-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.6 40.1 16.3 44 24 44z" fill="#4CAF50"/>
                <path d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.5 5.5C37.3 38.9 44 33.9 44 24c0-1.3-.1-2.7-.4-3.5z" fill="#1976D2"/>
              </svg>
              {connecting ? "Connecting…" : "Connect Google Calendar"}
            </button>

            <button
              type="button"
              onClick={onFinish}
              disabled={saving}
              className="w-full rounded-2xl bg-[var(--accent)] py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-[var(--accent)]/30 transition-all hover:bg-[var(--accent-deep)] disabled:opacity-40 active:scale-[0.98]"
            >
              {saving ? "Setting up…" : "Skip for now — Enter Steward"}
            </button>

            <p className="text-center text-[11px] text-[var(--text-dim)]">Read-only access. We never modify your calendar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
