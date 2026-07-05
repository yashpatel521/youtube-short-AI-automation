/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#0f0f1b",
        glassBorder: "rgba(255, 255, 255, 0.08)",
        glassFocus: "rgba(139, 92, 246, 0.2)"
      }
    },
  },
  plugins: [],
}
