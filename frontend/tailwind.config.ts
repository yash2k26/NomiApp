// mirrors NomiApp/tailwind.config.js color tokens so the marketing site
// feels visually continuous with the in-app aesthetic
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "pet-blue": {
          DEFAULT: "#4DA9D8",
          light: "#D8ECFA",
          dark: "#2F7CA7",
        },
        "pet-green": {
          DEFAULT: "#6DB9DF",
          light: "#D5E9F6",
          dark: "#3C84AE",
        },
        "pet-pink": {
          DEFAULT: "#8FBFDE",
          light: "#E4F1FA",
          dark: "#5B8EAF",
        },
        "pet-yellow": {
          DEFAULT: "#9EC7E3",
          light: "#E7F3FB",
          dark: "#6E9EBE",
        },
        "pet-purple": {
          DEFAULT: "#79B5DE",
          light: "#DDEFFD",
          dark: "#4A89B5",
        },
        "pet-orange": {
          DEFAULT: "#84BEE2",
          light: "#E4F2FB",
          dark: "#4E90B8",
        },
        "pet-gold": {
          DEFAULT: "#A2CDE8",
          light: "#EAF4FC",
          dark: "#6B9FBE",
        },
        "pet-bg": "#F1F8FF",
        "pet-ink": "#1A3D4A",
      },
      borderRadius: {
        "4xl": "32px",
        "5xl": "40px",
      },
      fontFamily: {
        sans: ["var(--font-fredoka)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 8px 24px rgba(45, 107, 144, 0.08)",
        lift: "0 18px 40px rgba(45, 107, 144, 0.14)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
