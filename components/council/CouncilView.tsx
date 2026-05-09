"use client";

import { useState } from "react";
import { TOKENS } from "@/lib/design-system";

const AGENT_COLORS: Record<string, string> = {
  luka: "#7c5cff",
  solomon: "#d4a857",
  silas: "#2dd4bf",
  argus: "#60a5fa",
  eden: "#ec4899",
  nova: "#a78bfa",
};

const AGENT_ROLES: Record<string, string> = {
  luka: "Financial Advisor",
  solomon: "Wisdom Keeper",
  silas: "Pattern Analyst",
  argus: "Risk Watchdog",
  eden: "Vision Keeper",
  nova: "Foresight Agent",
};

interface AgentResponse {
  agent: string;
  color: string;
  role: string;
  response: string;
}

interface CouncilResult {
  question: string;
  responses: AgentResponse[];
  synthesis: string;
}

const SUGGESTED_QUESTIONS = [
  "Should I pay off debt or invest right now?",
  "Am I spending in alignment with my values?",
  "What should I focus on financially this month?",
  "Is it safe to make a large purchase?",
];

export function CouncilView() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<CouncilResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(q?: string) {
    const finalQuestion = q ?? question;
    if (!finalQuestion.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/agents/council", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: finalQuestion }),
      });
      if (!res.ok) throw new Error("Council failed");
      const data = await res.json();
      setResult(data);
    } catch {
      setError("The council could not convene. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 px-4 pb-10 pt-5 md:px-8 md:pt-8">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--text-1)]">The Council</h1>
        <p className="mt-0.5 text-sm text-[var(--text-3)]">Six agents. One question. Real answers.</p>
      </header>

      {/* Question input */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask the council anything about your finances..."
          rows={3}
          className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-blue-500/60 focus:outline-none transition-colors"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => { setQuestion(q); handleSubmit(q); }}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1 text-[10px] text-[var(--text-3)] transition-colors hover:border-blue-500/40 hover:text-blue-400"
              >
                {q}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={loading || !question.trim()}
            className="shrink-0 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--accent-deep)] disabled:opacity-40"
          >
            {loading ? "Convening…" : "Convene"}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {["luka", "solomon", "silas", "argus", "eden", "nova"].map((agent) => (
            <div key={agent} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-7 w-7 rounded-full shimmer" />
                <div className="h-3 w-24 rounded shimmer" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-full rounded shimmer" />
                <div className="h-3 w-3/4 rounded shimmer" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-400">{error}</div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-3)] italic">&ldquo;{result.question}&rdquo;</p>

          {/* Agent responses */}
          <div className="space-y-3">
            {result.responses.map((r) => (
              <div
                key={r.agent}
                className="rounded-xl border bg-[var(--bg-card)] p-4 transition-colors"
                style={{ borderColor: `${r.color}30` }}
              >
                <div className="mb-2 flex items-center gap-2.5">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: r.color }}
                  >
                    {r.agent.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold" style={{ color: r.color }}>
                      {r.agent.charAt(0).toUpperCase() + r.agent.slice(1)}
                    </p>
                    <p className="text-[10px] text-[var(--text-3)]">{r.role}</p>
                  </div>
                </div>
                <p className="text-sm text-[var(--text-2)] leading-relaxed">{r.response}</p>
              </div>
            ))}
          </div>

          {/* Synthesis */}
          <div
            className="rounded-xl border p-5"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--accent) 6%, transparent)",
            }}
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)]">Council Synthesis</p>
            <p className="text-sm text-[var(--text-2)] leading-relaxed">{result.synthesis}</p>
          </div>

          {/* New question */}
          <button
            type="button"
            onClick={() => { setResult(null); setQuestion(""); }}
            className="w-full rounded-xl border border-[var(--border)] py-3 text-sm text-[var(--text-3)] transition-colors hover:text-[var(--text-2)]"
          >
            Ask another question
          </button>
        </div>
      )}
    </div>
  );
}
