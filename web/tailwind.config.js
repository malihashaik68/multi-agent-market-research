/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        espresso: { DEFAULT: "#3B2A20", light: "#5A4335" },
        caramel: { DEFAULT: "#C68B59", light: "#E2B98F", dark: "#A86E3E" },
        cream: { DEFAULT: "#F7F0E6", dark: "#EFE3D2", paper: "#FBF7F1" },
        sage: { DEFAULT: "#8A9A7B", light: "#C9D3BE", dark: "#5F6F52" },
        terracotta: { DEFAULT: "#B5654A", light: "#E7B7A6" },
        forest: "#2F4A3A",
        brass: "#B08D57",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(59,42,32,.06), 0 8px 24px -12px rgba(59,42,32,.18)",
        lift: "0 2px 4px rgba(59,42,32,.08), 0 18px 40px -16px rgba(59,42,32,.30)",
      },
    },
  },
  plugins: [],
};
