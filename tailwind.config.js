// tailwind.config.js
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./pages/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paineiras: {
          magenta: "#EC008B",   // PANTONE Process Magenta C (RGB 236,0,139)
          magentaDark: "#C20073",
          magentaLight: "#F36CB8",
          // neutros sugeridos
          ink: "#1F2937",       // cinza-900 p/ textos
          ash: "#6B7280",       // cinza-500 p/ textos secundários
          mist: "#F9FAFB",      // cinza-50 p/ fundos
          line: "#E5E7EB",      // cinza-200 p/ bordas
        },
      },
      boxShadow: {
        soft: "0 10px 30px -12px rgba(236,0,139,0.25)",
      },
      borderRadius: {
        brand: "1rem",
      },
    },
  },
  plugins: [],
}
