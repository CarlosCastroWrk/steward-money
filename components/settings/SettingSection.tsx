"use client";

import { ReactNode } from "react";

interface SettingSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SettingSection({ title, description, children }: SettingSectionProps) {
  return (
    <section className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold text-zinc-100">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-[12px] text-zinc-500">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
