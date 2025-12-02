import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./resources/**/*.blade.php",
    "./resources/js/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'], // ✅ Enable Dark Mode strategy
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // ✅ Semantic Colors (Mapped to CSS Variables in app.css)
        brand: {
          bg: 'var(--bg-main)',          // Main background
          surface: 'var(--bg-surface)',  // Cards / Sidebar / Header
          text: 'var(--text-main)',      // Main text color
          muted: 'var(--text-secondary)', // Secondary text
          border: 'var(--border-color)', // Borders
          primary: 'var(--primary)',     // Main Brand Color
          'primary-hover': 'var(--primary-hover)',
          'primary-text': 'var(--primary-text)',
        },
        // Keep alerts as static colors or map them if you want them to dim in dark mode
        alert: {
          critical: '#DE350B',
          high: '#FFAB00',
          medium: '#00B8D9',
        }
      },
    },
  },
  plugins: [],
}