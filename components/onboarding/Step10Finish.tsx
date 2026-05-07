"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, PlaidLinkOnSuccess } from "react-plaid-link";
import { StepWrapper } from "@/components/onboarding/StepWrapper";
import { StepProps } from "@/components/onboarding/types";

function describeSavingsRule(rule: string) {
  const map: Record<string, string> = {
    percentage: "% of income",
    fixed_per_paycheck: "Fixed per paycheck",
    fixed_per_month: "Fixed per month",
    leftover: "Whatever is left after bills",
    manual: "Manual only"
  };
  return map[rule] ?? rule;
}

function PlaidConnect() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "connected" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{ accounts: number } | null>(null);

  useEffect(() => {
    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.link_token) throw new Error(d.error ?? "Failed to initialize bank connection");
        setLinkToken(d.link_token);
        setStatus("idle");
      })
      .catch((e: Error) => {
        console.error("[onboarding/plaid]", e.message);
        setErrorMsg(e.message);
        setStatus("error");
      });
  }, []);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(async (publicToken, metadata) => {
    setStatus("loading");
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bank connection failed");
      setResult({ accounts: data.accounts_synced ?? 0 });
      setStatus("connected");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Bank connection failed";
      console.error("[onboarding/plaid]", msg);
      setErrorMsg(msg);
      setStatus("error");
    }
  }, []);

  const { open, ready } = usePlaidLink({ token: linkToken ?? "", onSuccess });

  if (status === "connected" && result) {
    return (
      <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
        ✓ Connected — {result.accounts} account{result.accounts !== 1 ? "s" : ""} imported
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {status === "error" ? (
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">
          {errorMsg ?? "Bank connection didn't go through."} You can connect later from Accounts in Settings.
        </div>
      ) : (
        <button
          type="button"
          onClick={() => open()}
          disabled={!ready || status === "loading"}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm font-medium text-[var(--text-1)] transition hover:bg-[var(--bg-hover)] disabled:opacity-40"
        >
          {status === "loading" && !linkToken ? "Initializing…" : "Connect your bank"}
        </button>
      )}
    </div>
  );
}

export function Step10Finish({ formData, onNext, onBack, isSaving, error }: StepProps) {
  const nextPaycheck = [...formData.incomeSources]
    .map((source) => source.next_expected_date)
    .filter(Boolean)
    .sort()[0];

  return (
    <StepWrapper
      title={`You're all set, ${formData.display_name || "there"}`}
      subtitle="Connect your bank to import live balances, or skip and do it later."
      onBack={onBack}
      onNext={onNext}
      isFirstStep={false}
      isLastStep
      isSaving={isSaving}
      hideFooter
    >
      {/* Plaid connect */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-[var(--text-2)]">Bank connection (optional)</p>
        <PlaidConnect />
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 space-y-1.5 text-sm text-[var(--text-2)]">
        <p>Emergency buffer: ${formData.emergency_buffer.toLocaleString()}</p>
        <p>Savings rule: {describeSavingsRule(formData.savings_rule)}</p>
        <p>Income sources: {formData.incomeSources.length}</p>
        <p>Accounts added: {formData.accounts.length}</p>
        {nextPaycheck && <p>Next paycheck: {nextPaycheck}</p>}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={isSaving}
        className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white disabled:opacity-60 transition hover:opacity-90"
      >
        {isSaving ? "Setting up…" : "Go to my dashboard"}
      </button>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </StepWrapper>
  );
}
