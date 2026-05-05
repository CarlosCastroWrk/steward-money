import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ["var(--font-geist-sans)", "system-ui", "-apple-system", "sans-serif"],
        mono:    ["var(--font-geist-mono)", "ui-monospace", "SF Mono", "monospace"],
        display: ["var(--font-display-serif)", "Georgia", "serif"],
      },
      colors: {
        steward: {
          purple: "#7857ff",
          deep:   "#5538e8",
          income: "#00d4aa",
          danger: "#ff4560",
          warn:   "#ffaa00",
          gold:   "#d4a857",
        },
      },
      boxShadow: {
        card:     "0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 24px rgba(0,0,0,0.4)",
        elevated: "0 1px 0 rgba(255,255,255,0.06) inset, 0 16px 48px rgba(0,0,0,0.6)",
      },
      animation: {
        "page-enter":   "pageEnter 0.2s cubic-bezier(0.22,1,0.36,1) both",
        "slide-in":     "slideIn 0.18s cubic-bezier(0.22,1,0.36,1) both",
        "modal-enter":  "modalEnter 0.18s cubic-bezier(0.22,1,0.36,1) both",
        "sheet-up":     "sheetUp 0.25s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
