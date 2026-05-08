"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackButton({ href = "/more", label = "More" }: { href?: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors"
    >
      <ChevronLeft size={16} strokeWidth={2} />
      {label}
    </Link>
  );
}
