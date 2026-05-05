const MAP: Record<string, string> = {
  FOOD_AND_DRINK: "Food & Drink",
  FOOD_AND_BEVERAGE: "Food & Drink",
  RESTAURANTS: "Restaurants",
  GROCERIES: "Groceries",
  GENERAL_MERCHANDISE: "Shopping",
  SHOPPING: "Shopping",
  CLOTHING_AND_ACCESSORIES: "Clothing",
  ELECTRONICS: "Electronics",
  TRANSPORTATION: "Transportation",
  GAS_STATIONS: "Gas",
  TAXI: "Rideshare",
  PUBLIC_TRANSPORTATION: "Transit",
  TRAVEL: "Travel",
  AIRLINES: "Flights",
  HOTELS: "Hotels",
  ENTERTAINMENT: "Entertainment",
  RECREATION: "Recreation",
  HEALTH_FITNESS: "Health & Fitness",
  MEDICAL: "Medical",
  HEALTHCARE: "Healthcare",
  PHARMACY: "Pharmacy",
  PERSONAL_CARE: "Personal Care",
  HOME_IMPROVEMENT: "Home",
  RENT_AND_UTILITIES: "Utilities",
  UTILITIES: "Utilities",
  PHONE: "Phone",
  INTERNET: "Internet",
  CABLE: "Cable",
  STREAMING: "Streaming",
  SUBSCRIPTION: "Subscriptions",
  EDUCATION: "Education",
  TRANSFER: "Transfer",
  INCOME: "Income",
  DEPOSIT: "Deposit",
  PAYROLL: "Payroll",
  LOAN_PAYMENTS: "Loan Payment",
  CREDIT_CARD_PAYMENT: "Credit Card Payment",
  INSURANCE: "Insurance",
  TAXES: "Taxes",
  GOVERNMENT: "Government",
  CHARITY: "Giving",
  GIVING: "Giving",
  TITHE: "Giving",
  DONATION: "Giving",
  SAVINGS: "Savings",
  INVESTMENT: "Investment",
  ATM: "ATM / Cash",
  GENERAL_SERVICES: "Services",
  BUSINESS_SERVICES: "Business",
  OTHER: "Other",
};

export function formatCategory(raw: string | null | undefined): string {
  if (!raw) return "Other";
  const upper = raw.toUpperCase().replace(/[\s-]/g, "_");
  if (MAP[upper]) return MAP[upper];
  // Title-case the raw string as fallback
  return raw
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
