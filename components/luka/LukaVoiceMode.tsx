"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type OrbState = "idle" | "listening" | "thinking" | "speaking";
type Exchange = { question: string; answer: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSR(): any | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null;
}

function OrbAnimation({ state }: { state: OrbState }) {
  return (
    <>
      <style>{`
        @keyframes orbIdle {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes orbListen {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(124,58,237,0.5); }
          50% { transform: scale(1.12); box-shadow: 0 0 0 24px rgba(124,58,237,0); }
        }
        @keyframes orbThink {
          from { transform: rotate(0deg) scale(1.02); }
          to   { transform: rotate(360deg) scale(1.02); }
        }
        @keyframes orbSpeak {
          0%   { transform: scale(1);    box-shadow: 0 0 0 0  rgba(124,58,237,0.6); }
          33%  { transform: scale(1.08); box-shadow: 0 0 0 16px rgba(124,58,237,0.2); }
          66%  { transform: scale(1.04); box-shadow: 0 0 0 32px rgba(124,58,237,0); }
          100% { transform: scale(1);    box-shadow: 0 0 0 0  rgba(124,58,237,0.6); }
        }
        .orb-idle     { animation: orbIdle   2.4s ease-in-out infinite; }
        .orb-listen   { animation: orbListen 0.8s ease-in-out infinite; }
        .orb-think    { animation: orbThink  1.8s linear infinite; }
        .orb-speak    { animation: orbSpeak  1.0s ease-in-out infinite; }
      `}</style>
      <div className="relative flex items-center justify-center">
        {/* Outer glow ring */}
        <div
          className={`absolute rounded-full bg-purple-600/20 transition-all duration-500 ${
            state === "listening" ? "h-52 w-52" : state === "speaking" ? "h-48 w-48" : "h-44 w-44"
          }`}
        />
        {/* Inner glow */}
        <div
          className={`absolute rounded-full bg-purple-600/30 transition-all duration-300 ${
            state === "listening" ? "h-40 w-40" : state === "speaking" ? "h-36 w-36" : "h-34 w-34"
          }`}
        />
        {/* Core orb */}
        <div
          className={`relative z-10 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-700 shadow-2xl shadow-purple-900/60 ${
            state === "idle" ? "orb-idle" :
            state === "listening" ? "orb-listen" :
            state === "thinking" ? "orb-think" :
            "orb-speak"
          }`}
        >
          {/* Wave icon inside orb */}
          <svg viewBox="0 0 40 40" className="h-10 w-10 text-white/80" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            {state === "idle" && (
              <path d="M8 20h2M14 14v12M20 10v20M26 14v12M32 20h2" />
            )}
            {state === "listening" && (
              <path d="M5 20h3M11 12v16M17 8v24M23 12v16M29 20h3" />
            )}
            {state === "thinking" && (
              <>
                <circle cx="20" cy="20" r="8" strokeDasharray="4 2" />
                <circle cx="20" cy="20" r="3" />
              </>
            )}
            {state === "speaking" && (
              <path d="M6 20h4M13 13v14M20 9v22M27 13v14M34 20h4" />
            )}
          </svg>
        </div>
      </div>
    </>
  );
}

export function LukaVoiceMode({ onClose }: { onClose: () => void }) {
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [statusText, setStatusText] = useState("Tap to start talking");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (typeof window === "undefined" || !window.speechSynthesis) { onDone?.(); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.05;
    utt.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female"))
      ?? voices.find((v) => v.lang.startsWith("en"))
      ?? voices[0];
    if (preferred) utt.voice = preferred;
    utt.onstart = () => { setOrbState("speaking"); setStatusText("Luka is speaking…"); };
    utt.onend = () => { setOrbState("idle"); setStatusText("Tap to keep talking"); onDone?.(); };
    utt.onerror = () => { setOrbState("idle"); onDone?.(); };
    synthRef.current = utt;
    window.speechSynthesis.speak(utt);
  }, []);

  const sendToLuka = useCallback(async (text: string) => {
    if (!text.trim()) { setOrbState("idle"); setStatusText("Tap to start talking"); return; }
    setOrbState("thinking");
    setStatusText("Luka is thinking…");
    try {
      const res = await fetch("/api/luka", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
      });
      const data = await res.json();
      const answer = data.reply ?? "Sorry, something went wrong.";
      if (data.refreshNeeded) router.refresh();
      setExchanges((prev) => [...prev, { question: text, answer }].slice(-5));
      setCurrentQuestion("");
      speak(answer);
    } catch {
      speak("Sorry, I couldn't connect. Please try again.");
    }
  }, [router, speak]);

  const startListening = useCallback(() => {
    const SR = getSR();
    if (!SR) {
      setStatusText("Voice not supported in this browser");
      return;
    }
    if (orbState === "speaking") {
      window.speechSynthesis?.cancel();
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcript = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join("");
      setCurrentQuestion(transcript);
    };
    rec.onend = () => {
      setCurrentQuestion((q) => { if (q.trim()) sendToLuka(q); else { setOrbState("idle"); setStatusText("Tap to start talking"); } return q; });
    };
    rec.onerror = () => { setOrbState("idle"); setStatusText("Tap to try again"); };
    recognitionRef.current = rec;
    rec.start();
    setOrbState("listening");
    setStatusText("Listening…");
    setCurrentQuestion("");
  }, [orbState, sendToLuka]);

  const handleOrbTap = useCallback(() => {
    if (orbState === "listening") {
      recognitionRef.current?.stop();
    } else if (orbState === "idle") {
      startListening();
    }
  }, [orbState, startListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-[var(--bg)] px-6 pb-16 pt-12">
      {/* Close button */}
      <div className="flex w-full justify-end">
        <button
          onClick={() => { recognitionRef.current?.stop(); window.speechSynthesis?.cancel(); onClose(); }}
          className="rounded-full border border-[var(--border)] p-2.5 text-[var(--text-3)] transition hover:text-[var(--text-1)]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Conversation history */}
      <div className="w-full max-w-sm flex-1 overflow-y-auto space-y-3 pt-4">
        {exchanges.map((ex, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-end">
              <p className="max-w-xs rounded-2xl rounded-br-sm bg-emerald-700 px-3 py-2 text-sm text-white">{ex.question}</p>
            </div>
            <div className="flex justify-start">
              <p className="max-w-xs rounded-2xl rounded-bl-sm bg-[var(--luka-msg-bg)] px-3 py-2 text-sm text-[var(--text-1)]">{ex.answer}</p>
            </div>
          </div>
        ))}
        {currentQuestion && (
          <div className="flex justify-end">
            <p className="max-w-xs rounded-2xl rounded-br-sm bg-emerald-700/60 px-3 py-2 text-sm text-white italic">{currentQuestion}</p>
          </div>
        )}
      </div>

      {/* Orb */}
      <div className="flex flex-col items-center gap-6 py-6">
        <button onClick={handleOrbTap} className="focus:outline-none" aria-label="Tap to speak">
          <OrbAnimation state={orbState} />
        </button>
        <p className="text-sm text-[var(--text-3)]">{statusText}</p>
      </div>
    </div>
  );
}
