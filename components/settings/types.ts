"use client";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface UserSettingsData {
  display_name?: string | null;
  currency?: string | null;
  life_stage?: string | null;
  main_goal?: string | null;
  giving_enabled?: boolean | null;
  giving_type?: string | null;
  giving_value?: number | null;
  giving_protected?: boolean | null;
  emergency_buffer?: number | null;
  savings_rule?: string | null;
  savings_value?: number | null;
  trading_rule?: string | null;
  trading_value?: number | null;
  weekly_groceries_min?: number | null;
  weekly_gas_min?: number | null;
  weekly_eating_out_cap?: number | null;
  weekly_misc_cap?: number | null;
}

export interface IncomeSourceRow {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  next_expected_date: string;
  is_recurring: boolean;
  is_active?: boolean;
  is_variable?: boolean;
  hourly_rate?: number | null;
  weekly_hours?: number | null;
}

export interface AccountRow {
  id: string;
  name: string;
  institution: string | null;
  type: string;
  current_balance: number;
  is_manual?: boolean;
  is_active?: boolean;
}

export interface PriorityRow {
  id: string;
  category: string;
  rank: number;
}

export const INPUT_CLASS =
  "w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-emerald-500/50 focus:bg-white/[0.06] focus:outline-none";
export const LABEL_CLASS =
  "mb-1.5 block text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500";
