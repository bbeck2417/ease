/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "ease-muted": "#2D3436", // Dark background
        "ease-safety": "#D63031", // Muted terracotta for SOS
        "ease-breath": "#55E6C1", // Soft seafoam for breathing
      },
    },
  },
  plugins: [],
};
