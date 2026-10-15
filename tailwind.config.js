/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Ant Design ya aplica su propio reset; deshabilitamos preflight para evitar conflictos.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        // Paleta de marca del conjunto activo: la publica BrandThemeProvider como
        // variables CSS (valores por defecto de EdiFeasy en src/styles/index.css).
        brand: {
          50: 'rgb(var(--brand-50-rgb) / <alpha-value>)',
          100: 'rgb(var(--brand-100-rgb) / <alpha-value>)',
          200: 'rgb(var(--brand-200-rgb) / <alpha-value>)',
          300: 'rgb(var(--brand-300-rgb) / <alpha-value>)',
          400: 'rgb(var(--brand-400-rgb) / <alpha-value>)',
          500: 'rgb(var(--brand-500-rgb) / <alpha-value>)',
          600: 'rgb(var(--brand-600-rgb) / <alpha-value>)',
          700: 'rgb(var(--brand-700-rgb) / <alpha-value>)',
          800: 'rgb(var(--brand-800-rgb) / <alpha-value>)',
          900: 'rgb(var(--brand-900-rgb) / <alpha-value>)',
          DEFAULT: 'rgb(var(--brand-rgb) / <alpha-value>)',
          // Texto legible sobre el color de marca y version de la marca apta para texto.
          on: 'rgb(var(--brand-on-rgb) / <alpha-value>)',
          text: 'var(--brand-text)',
        },
        surface: '#f5f7fb',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(16 24 40 / 0.05), 0 1px 3px 0 rgb(16 24 40 / 0.06)',
        elevated: '0 4px 16px -2px rgb(16 24 40 / 0.10)',
      },
      screens: {
        xs: '390px',
      },
    },
  },
  plugins: [],
}
