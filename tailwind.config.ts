import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mews: {
          50: "#fff0fc",
          100: "#ffd6f5",
          500: "#ff9ee3",
          600: "#ff83da",
          700: "#e85ec1",
          900: "#6b1045",
        },
      },
    },
  },
  plugins: [],
};

export default config;
