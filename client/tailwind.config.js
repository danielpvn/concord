/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gaming: {
          950: '#0b0e14',
          900: '#11151c',
          850: '#161b24',
          800: '#1d2330',
          700: '#283142',
          600: '#3a475d',
          accent: '#6366f1',
          success: '#10b981',
          danger: '#ef4444',
          warning: '#f59e0b'
        }
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'speaking': 'speaking-border 1.5s ease-in-out infinite',
      },
      keyframes: {
        'speaking-border': {
          '0%, 100%': { borderColor: '#10b981', boxShadow: '0 0 15px rgba(16, 185, 129, 0.5)' },
          '50%': { borderColor: '#34d399', boxShadow: '0 0 25px rgba(52, 211, 153, 0.8)' },
        }
      }
    },
  },
  plugins: [],
}
