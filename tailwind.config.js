/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        ink: "#10131a",
        "ink-soft": "#171b24",
        ivory: "#f7f0e6",
        "ivory-muted": "#b3a998",
        copper: "#d5955c",
        "copper-soft": "#efc498",
        moss: "#8db28c",
      },
      fontFamily: {
        display: ['"Fraunces"', '"Times New Roman"', "serif"],
        sans: ['"IBM Plex Sans"', '"Segoe UI"', "sans-serif"],
      },
      boxShadow: {
        panel: "0 24px 80px rgba(0, 0, 0, 0.32)",
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at top left, rgba(213,149,92,0.18), transparent 40%), radial-gradient(circle at top right, rgba(141,178,140,0.12), transparent 36%)",
      },
    },
  },
  plugins: [],
};
