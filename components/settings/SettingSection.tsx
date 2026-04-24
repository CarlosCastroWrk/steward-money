"use client";

import { ReactNode } from "react";

interface SettingSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SettingSection({ title, description, children }: SettingSectionProps) {
  return (
    <section className="mb-8 border-b border-[var(--color-border)] pb-8">
      <h2 className="text-[14px] font-medium text-[var(--color-text-primary)] [font-family:var(--font-body)]">
        {title}
      </h2>
      {description ? (
        <p className="mb-4 mt-1 text-[11px] text-[var(--color-text-secondary)] [font-family:var(--font-body)]">
          {description}
        </p>
      ) : null}
      {children}
    </section>
  );
}
