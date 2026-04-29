const CATEGORY_MAP: Record<string, string> = {
  INCOME:                    "Income",
  TRANSFER_IN:               "Transfer",
  TRANSFER_OUT:              "Transfer",
  LOAN_PAYMENTS:             "Loan Payment",
  BANK_FEES:                 "Bank Fees",
  ENTERTAINMENT:             "Entertainment",
  FOOD_AND_DRINK:            "Food & Drink",
  GENERAL_MERCHANDISE:       "Shopping",
  HOME_IMPROVEMENT:          "Home",
  MEDICAL:                   "Medical",
  PERSONAL_CARE:             "Personal Care",
  GENERAL_SERVICES:          "Services",
  GOVERNMENT_AND_NON_PROFIT: "Government",
  TRANSPORTATION:            "Transportation",
  TRAVEL:                    "Travel",
  RENT_AND_UTILITIES:        "Bills & Utilities",
  OTHER:                     "Other",
};

const NEEDS = new Set([
  "FOOD_AND_DRINK",
  "TRANSPORTATION",
  "MEDICAL",
  "RENT_AND_UTILITIES",
  "LOAN_PAYMENTS",
  "PERSONAL_CARE",
  "HOME_IMPROVEMENT",
  "GENERAL_SERVICES",
  "BANK_FEES",
  "GOVERNMENT_AND_NON_PROFIT",
]);

const WANTS = new Set([
  "ENTERTAINMENT",
  "GENERAL_MERCHANDISE",
  "TRAVEL",
]);

export function mapCategory(primary: string | null | undefined): string | null {
  if (!primary) return null;
  return CATEGORY_MAP[primary] ?? primary.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function inferIsNeed(primary: string | null | undefined): boolean | null {
  if (!primary) return null;
  if (NEEDS.has(primary)) return true;
  if (WANTS.has(primary)) return false;
  return null;
}

export function cleanName(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
