const BANK_COLORS: Record<string, string> = {
  "chase": "#117ACA",
  "wells fargo": "#D71E2B",
  "bank of america": "#E61E2B",
  "capital one": "#004977",
  "citi": "#003B70",
  "citibank": "#003B70",
  "us bank": "#0C2074",
  "pnc": "#F58025",
  "truist": "#5C2D91",
  "usaa": "#143E6D",
  "navy federal": "#003F7F",
  "discover": "#FF6000",
  "amex": "#006FCF",
  "american express": "#006FCF",
  "apple": "#1C1C1E",
  "goldman sachs": "#7B7E80",
  "ally": "#582C83",
  "sofi": "#00A6FB",
  "chime": "#1EC677",
  "venmo": "#3D95CE",
  "cash app": "#00D54B",
  "td bank": "#2C8C2C",
  "td": "#2C8C2C",
  "regions": "#005E40",
  "fifth third": "#1B4D8E",
  "keybank": "#CC0000",
  "citizens": "#264F9D",
  "m&t": "#0056A2",
  "huntington": "#00A651",
  "santander": "#EC0000",
  "first republic": "#003DA5",
  "silicon valley": "#B30000",
  "charles schwab": "#006EC7",
  "fidelity": "#007A3D",
  "vanguard": "#7B0D1E",
  "robinhood": "#00C805",
  "webull": "#4A90D9",
};

export function getBankColor(institution: string | null | undefined): string {
  if (!institution) return "var(--accent)";
  const key = institution.toLowerCase();
  for (const [name, color] of Object.entries(BANK_COLORS)) {
    if (key.includes(name)) return color;
  }
  // Hash the institution name to a stable color from a small palette
  const palette = ["#7857ff", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  const hash = key.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return palette[hash % palette.length];
}
