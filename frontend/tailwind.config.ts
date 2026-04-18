import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0F0F0F",
          elevated: "#1A1A1A",
          high: "#262626",
          deepest: "#070707",
        },
        ink: {
          primary: "#FAFAF9",
          secondary: "#A8A29E",
          tertiary: "#57534E",
          veiled: "#404040",
        },
        accent: {
          gold: "#C8B273",
          goldDeep: "#9A864F",
          goldGlow: "#E8D49B",
        },
        zone: {
          safe: "#84A07C",
          warning: "#C9974A",
          danger: "#A6453B",
        },
        border: {
          DEFAULT: "#2A2A2A",
          subtle: "#1F1F1F",
          accent: "#C8B273",
        },
      },
      fontFamily: {
        serif: ["var(--font-garamond)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jbmono)", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.02em",
        tighter: "-0.015em",
        tight: "-0.01em",
        label: "0.18em",
        wordmark: "0.14em",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "0" },
          "50%": { opacity: "1" },
        },
        "hairline-fade-in": {
          "0%": { opacity: "0", transform: "scaleY(0)" },
          "100%": { opacity: "1", transform: "scaleY(1)" },
        },
        "underline-grow": {
          "0%": { width: "0%" },
          "100%": { width: "100%" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 1.5s ease-in-out 2",
        "hairline-fade-in": "hairline-fade-in 1.5s ease-out forwards",
      },
      transitionTimingFunction: {
        "counsel": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
