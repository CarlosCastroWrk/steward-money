"use client";

import { ReactNode } from "react";

interface SettingSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SettingSection({ title, description, children }: SettingSectionProps) {
  return (
    <section className="mb-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
