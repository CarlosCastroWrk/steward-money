"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  completeOnboarding,
  getOnboardingState,
  saveAccounts,
  saveIncomeSources,
  saveOnboardingStep,
  savePriorities,
  saveUserSettings
} from "@/lib/supabase/onboarding";
import { Step1Profile } from "@/components/onboarding/Step1Profile";
import { Step2Giving } from "@/components/onboarding/Step2Giving";
import { Step3Buffer } from "@/components/onboarding/Step3Buffer";
import { Step4Savings } from "@/components/onboarding/Step4Savings";
import { Step5Trading } from "@/components/onboarding/Step5Trading";
import { Step6Needs } from "@/components/onboarding/Step6Needs";
import { Step7Income } from "@/components/onboarding/Step7Income";
import { Step8Priority } from "@/components/onboarding/Step8Priority";
import { Step9Accounts } from "@/components/onboarding/Step9Accounts";
import { Step10Finish } from "@/components/onboarding/Step10Finish";
import { OnboardingFormData } from "@/components/onboarding/types";

const INITIAL_FORM_DATA: OnboardingFormData = {
  display_name: "",
  currency: "USD",
  life_stage: "student",
  main_goal: "",
  giving_enabled: false,
  giving_type: "percentage",
  giving_value: 10,
  giving_protected: false,
  emergency_buffer: 500,
  savings_rule: "percentage",
  savings_value: 10,
  trading_rule: "manual",
  trading_value: 0,
  weekly_groceries_min: 100,
  weekly_gas_min: 40,
  weekly_eating_out_cap: 60,
  weekly_misc_cap: 50,
  incomeSources: [],
  priorities: [
    "Giving",
    "Bills",
    "Groceries",
    "Gas",
    "Savings",
    "Debt / installments",
    "Trading account",
    "Flex spending"
  ],
  accounts: []
};

export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<OnboardingFormData>(INITIAL_FORM_DATA);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadState = async () => {
      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);
      const state = await getOnboardingState(supabase, user.id);
      setCurrentStep(Math.min(Math.max(state.currentStep ?? 1, 1), 10));
      if (state.settings) {
        setFormData((prev) => ({
          ...prev,
          ...state.settings,
          giving_type: state.settings.giving_type === "fixed" ? "fixed" : "percentage"
        }));
      }
      setIsBooting(false);
    };

    loadState().catch((loadError) => {
      setError(loadError.message ?? "Failed to load onboarding state.");
      setIsBooting(false);
    });
  }, [router]);

  const onChange = (patch: Partial<OnboardingFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  };

  const onBack = () => {
    setError("");
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const validateStep = () => {
    if (currentStep === 1 && (!formData.display_name.trim() || !formData.main_goal.trim())) {
      return "Please complete your name and main goal.";
    }
    if (currentStep === 7 && formData.incomeSources.length === 0) {
      return "Please add at least one income source.";
    }
    if (
      currentStep === 9 &&
      !formData.accounts.some((account) => account.type === "checking" || account.type === "savings")
    ) {
      return "Please add at least one checking or savings account.";
    }
    return "";
  };

  const onNext = async () => {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      const supabase = createClient();
      if (currentStep >= 1 && currentStep <= 6) {
        const settingsPayloadByStep: Record<number, Record<string, unknown>> = {
          1: {
            display_name: formData.display_name,
            currency: formData.currency,
            life_stage: formData.life_stage,
            main_goal: formData.main_goal
          },
          2: {
            giving_enabled: formData.giving_enabled,
            giving_type: formData.giving_type,
            giving_value: formData.giving_value,
            giving_protected: formData.giving_protected
          },
          3: { emergency_buffer: formData.emergency_buffer },
          4: { savings_rule: formData.savings_rule, savings_value: formData.savings_value },
          5: { trading_rule: formData.trading_rule, trading_value: formData.trading_value },
          6: {
            weekly_groceries_min: formData.weekly_groceries_min,
            weekly_gas_min: formData.weekly_gas_min,
            weekly_eating_out_cap: formData.weekly_eating_out_cap,
            weekly_misc_cap: formData.weekly_misc_cap
          }
        };

        await saveUserSettings(supabase, userId, settingsPayloadByStep[currentStep]);
      }

      if (currentStep === 7) {
        await saveIncomeSources(
          supabase,
          userId,
          formData.incomeSources.map((source) => ({
            name: source.name,
            amount: source.amount,
            frequency: source.frequency,
            next_expected_date: source.next_expected_date,
            is_recurring: source.is_recurring
          }))
        );
      }

      if (currentStep === 8) {
        await savePriorities(supabase, userId, formData.priorities);
      }

      if (currentStep === 9) {
        await saveAccounts(
          supabase,
          userId,
          formData.accounts.map((account) => ({
            name: account.name,
            institution: account.institution,
            type: account.type,
            current_balance: account.current_balance
          }))
        );
      }

      if (currentStep === 10) {
        await completeOnboarding(supabase, userId);
        await saveOnboardingStep(supabase, userId, 10);
        router.push("/");
        router.refresh();
        return;
      }

      const nextStep = currentStep + 1;
      await saveOnboardingStep(supabase, userId, nextStep);
      setCurrentStep(nextStep);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save step.");
    } finally {
      setIsSaving(false);
    }
  };

  const onSkip = () => {
    setError("");
    setCurrentStep((prev) => Math.min(10, prev + 1));
  };

  if (isBooting) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600">
            <span className="text-lg font-black text-white">S</span>
          </div>
          <p className="text-sm text-zinc-500">Loading…</p>
        </div>
      </section>
    );
  }

  const OPTIONAL_STEPS = new Set([2, 5, 6, 8]);
  const stepProps = { formData, onChange, onNext, onBack, onSkip: OPTIONAL_STEPS.has(currentStep) ? onSkip : undefined, isSaving, error };
  const progress = (currentStep / 10) * 100;

  const STEP_LABELS = ["Profile", "Giving", "Emergency", "Savings", "Trading", "Needs", "Income", "Priorities", "Accounts", "Done"];

  return (
    <section className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 md:py-12">
      {/* Logo */}
      <div className="mx-auto mb-8 flex w-full max-w-[520px] items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
          <span className="text-sm font-black text-white">S</span>
        </div>
        <span className="text-sm font-semibold text-zinc-300 tracking-tight">Steward Money</span>
        <span className="ml-auto text-xs text-zinc-600">{currentStep} of 10</span>
      </div>

      {/* Progress */}
      <div className="mx-auto mb-6 w-full max-w-[520px]">
        <div className="h-1.5 rounded-full bg-zinc-800">
          <div
            className="h-1.5 rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between">
          {STEP_LABELS.map((label, i) => (
            <span
              key={label}
              className={`text-[9px] uppercase tracking-wide transition-colors ${
                i + 1 === currentStep ? "text-emerald-400" : i + 1 < currentStep ? "text-zinc-600" : "text-transparent"
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {currentStep === 1 ? <Step1Profile {...stepProps} /> : null}
      {currentStep === 2 ? <Step2Giving {...stepProps} /> : null}
      {currentStep === 3 ? <Step3Buffer {...stepProps} /> : null}
      {currentStep === 4 ? <Step4Savings {...stepProps} /> : null}
      {currentStep === 5 ? <Step5Trading {...stepProps} /> : null}
      {currentStep === 6 ? <Step6Needs {...stepProps} /> : null}
      {currentStep === 7 ? <Step7Income {...stepProps} /> : null}
      {currentStep === 8 ? <Step8Priority {...stepProps} /> : null}
      {currentStep === 9 ? <Step9Accounts {...stepProps} /> : null}
      {currentStep === 10 ? <Step10Finish {...stepProps} /> : null}

      {OPTIONAL_STEPS.has(currentStep) && (
        <p className="mx-auto mt-4 w-full max-w-[520px] text-center text-xs text-zinc-600">
          This step is optional — you can update it later in Settings.
        </p>
      )}
    </section>
  );
}
