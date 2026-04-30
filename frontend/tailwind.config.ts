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
        // Cypherpunk terminal palette (per spec)
        bg: {
          DEFAULT: "#080a0c",     // near-black with slight blue
          raised: "#0c0f12",      // cards / elevated
          hover: "#11151a",
          deepest: "#04060a",
        },
        phos: {
          DEFAULT: "#00ff9f",     // primary phosphor
          dim: "#00b370",
          faint: "#00663f",
          glow: "rgba(0, 255, 159, 0.08)",
        },
        amber: {
          DEFAULT: "#ffb000",
          dim: "#b37600",
        },
        crit: {
          DEFAULT: "#ff4444",
          dim: "#b32c2c",
        },
        ink: {
          primary: "#e8e8e8",
          secondary: "#888888",
          tertiary: "#444444",
          ghost: "#222222",
        },
      },
      fontFamily: {
        mono: ["var(--font-jbmono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        "blink-hard": {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        "crt-flicker": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.97" },
        },
        "glitch-x": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "20%": { transform: "translate(-1px, 0)" },
          "40%": { transform: "translate(1px, 0)" },
          "60%": { transform: "translate(-1px, 0)" },
          "80%": { transform: "translate(0, 1px)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 6px currentColor" },
          "50%": { opacity: "0.4", boxShadow: "0 0 2px currentColor" },
        },
      },
      animation: {
        "blink-hard": "blink-hard 1s steps(1) infinite",
        "crt-flicker": "crt-flicker 8s ease-in-out infinite",
        "glitch-x": "glitch-x 200ms linear",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
