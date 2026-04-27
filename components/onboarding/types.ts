"use client";

export interface IncomeSourceInput {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  next_expected_date: string;
  is_recurring: boolean;
  is_variable: boolean;
  hourly_rate: number | null;
  weekly_hours: number | null;
}

export interface AccountInput {
  id: string;
  name: string;
  institution: string;
  type: string;
  current_balance: number;
}

export interface OnboardingFormData {
  display_name: string;
  currency: string;
  life_stage: string;
  main_goal: string;
  giving_enabled: boolean;
  giving_type: "percentage" | "fixed";
  giving_value: number;
  giving_protected: boolean;
  emergency_buffer: number;
  savings_rule: string;
  savings_value: number;
  trading_rule: string;
  trading_value: number;
  weekly_groceries_min: number;
  weekly_gas_min: number;
  weekly_eating_out_cap: number;
  weekly_misc_cap: number;
  incomeSources: IncomeSourceInput[];
  priorities: string[];
  accounts: AccountInput[];
}

export interface StepProps {
  formData: OnboardingFormData;
  onChange: (patch: Partial<OnboardingFormData>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
  isSaving: boolean;
  error?: string;
}
