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
  let name = s.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();

  // "ONLINE TRANSFER TO/FROM ..." → readable label
  if (/^ONLINE TRANSFER TO/i.test(name)) {
    const acct = name.match(/(?:SAVINGS|CHECKING|CREDIT CARD|LINE)/i);
    return acct ? `Transfer out (${acct[0].toLowerCase()})` : "Transfer out";
  }
  if (/^ONLINE TRANSFER FROM/i.test(name)) {
    const acct = name.match(/(?:SAVINGS|CHECKING|CREDIT CARD|LINE)/i);
    return acct ? `Transfer in (${acct[0].toLowerCase()})` : "Transfer in";
  }

  // "PURCHASE AUTHORIZED ON MM/DD ..." — extract merchant portion or label generically
  if (/^PURCHASE AUTHORIZED ON \d{2}\/\d{2}/i.test(name)) {
    const inner = name
      .replace(/^PURCHASE AUTHORIZED ON \d{2}\/\d{2}\s*/i, "")
      .replace(/\s+[A-Z]{2}\s+[A-Z0-9]{8,}.*$/i, "") // strip state + card ref
      .replace(/\s+CARD\s+\d+.*$/i, "")
      .trim();
    // If what's left looks like a real name (no digits), title-case it
    const looksLegit = inner.length > 2 && !/^\d/.test(inner) && !/[A-Z0-9]{8,}/.test(inner);
    name = looksLegit ? inner : "Debit purchase";
  }

  // Common bank internal descriptions
  if (/SAVE AS YOU GO/i.test(name)) return "Automatic savings transfer";
  if (/OVERDRAFT\s+XFER|OVERDRAFT TRANSFER/i.test(name)) return "Overdraft transfer";
  if (/^ZELLE\s+(PAYMENT|TRANSFER)/i.test(name)) return name.replace(/\s+\d+.*$/, "").trim();

  // Title-case fully-uppercase strings
  if (name === name.toUpperCase() && name.length > 3) {
    name = name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return name.trim();
}
