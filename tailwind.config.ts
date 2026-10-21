import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: "#173F35", ink: "#172522", lime: "#D6F58B", mint: "#EAF5E9",
        canvas: "#F8FAF7", muted: "#718078", coral: "#F08A77",
      },
      borderRadius: { xl2: "1.25rem" },
    },
  },
  plugins: [],
} satisfies Config;
