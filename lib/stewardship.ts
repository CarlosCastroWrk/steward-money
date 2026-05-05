export const STEWARDSHIP_PRINCIPLES = {
  giving_first:
    "Giving and tithe come before all other allocations. This is the first act of stewardship.",
  provision_awareness:
    "Did what came in cover what went out? Living within provision is the foundation.",
  intentional_saving:
    "Every saved dollar should have a name and a purpose. Saving without intention becomes spending.",
  debt_avoidance:
    "Avoid obligations that extend beyond current provision. Debt is a claim on future blessing.",
  full_accountability:
    "Every dollar should have a category and a purpose. What is not tracked cannot be stewarded.",
  forward_planning:
    "Account for what is coming before spending what is here. Wisdom sees around corners.",
};

export const STEWARDSHIP_SCORE_RUBRIC: Record<number, string> = {
  10: "Every principle honored. Faithful stewardship.",
  9: "Strong week. Nearly every principle honored.",
  8: "Strong week. Minor gaps worth watching.",
  7: "Good foundation. One or two areas need attention.",
  6: "Good foundation. Giving or savings may need focus.",
  5: "Mixed week. Giving and savings need priority.",
  4: "Mixed week. Several principles unmet.",
  3: "Challenging week. Time to realign with the plan.",
  2: "Difficult week. Review your allocation priorities.",
  1: "Very difficult week. Start fresh — every dollar needs a purpose.",
};

export function scoreStewardship({
  givingHonored,
  savingsHonored,
  livedWithinProvision,
  allCategorized,
  noNewDebt,
  upcomingCovered,
}: {
  givingHonored: boolean;
  savingsHonored: boolean;
  livedWithinProvision: boolean;
  allCategorized: boolean;
  noNewDebt: boolean;
  upcomingCovered: boolean;
}): number {
  let score = 0;
  if (givingHonored) score += 2;
  if (livedWithinProvision) score += 2;
  if (savingsHonored) score += 2;
  if (allCategorized) score += 1;
  if (noNewDebt) score += 1;
  if (upcomingCovered) score += 2;
  return Math.max(1, Math.min(10, score));
}

export function getStewardshipLabel(score: number): string {
  return STEWARDSHIP_SCORE_RUBRIC[score] ?? STEWARDSHIP_SCORE_RUBRIC[Math.round(score)] ?? "Keep stewarding.";
}
