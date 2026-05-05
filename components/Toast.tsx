"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

type ToastType = "success" | "error" | "info";
type Toast = { id: number; message: string; type: ToastType };

const ToastContext = createContext<(msg: string, type?: ToastType) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const show = useCallback((message: string, type: ToastType = "success") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), type === "error" ? 4000 : 3000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed right-4 top-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-md animate-slide-in ${
              t.type === "success"
                ? "border-green-800/60 bg-zinc-900/95 text-green-400"
                : t.type === "error"
                ? "border-red-800/60 bg-zinc-900/95 text-red-400"
                : "border-zinc-700/60 bg-zinc-900/95 text-zinc-300"
            }`}
          >
            <span className="text-base leading-none">
              {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "·"}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
