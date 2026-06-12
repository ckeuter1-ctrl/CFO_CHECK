import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17201d",
        forest: "#143b31",
        sage: "#dce8df",
        cream: "#f5f2e9",
        copper: "#b9653b",
      },
      boxShadow: {
        soft: "0 20px 60px rgba(20, 59, 49, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
