/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        secondary: '#4F46E5',
        accent: '#9333EA',
        'light-bg': '#F8FAFC',
        'dark-bg': '#0F172A',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba( 31, 38, 135, 0.37 )',
        glow: '0 0 20px rgba(37, 99, 235, 0.5)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(37, 99, 235, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(37, 99, 235, 0.6)' },
        }
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}
