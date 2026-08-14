/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0F766E",
          dark: "#115E59",
          light: "#134E4A",
        },
        sidebar: {
          DEFAULT: "#162D47",
          active: "#134E4A",
          hover: "#143D52",
        },
        pipeline: {
          discovery: "#2563EB",
          design: "#0F766E",
          analysis: "#7C3AED",
          validation: "#22C55E",
          reports: "#475569",
        },
        accent: {
          biology: "#14B8A6",
          ai: "#2563EB",
          success: "#22C55E",
          warning: "#F59E0B",
          error: "#DC2626",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
