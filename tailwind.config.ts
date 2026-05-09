import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          background: "#020B17",
          sidebar: "#020814",
          panel: "#071525",
          card: "#0B1B2E",
          border: "#1E334A",
          primary: "#2563EB",
          electric: "#0D6EFD",
          teal: "#14B8A6",
          success: "#22C55E",
          warning: "#F59E0B",
          danger: "#EF4444",
          text: "#F8FAFC",
          secondary: "#94A3B8",
          muted: "#64748B",
        },
      },
      boxShadow: {
        "blue-glow": "0 0 28px rgba(37, 99, 235, 0.28)",
        "panel-glow": "0 18px 60px rgba(0, 0, 0, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
