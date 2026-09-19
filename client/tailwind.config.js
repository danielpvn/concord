/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        xs: '400px'
      },
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
        'fade-in': 'fade-in 150ms ease-out',
        'slide-in': 'slide-in 200ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'speaking': 'speaking-border 1.5s ease-in-out infinite',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'slide-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' }
        },
        'slide-up': {
          from: { transform: 'translateY(16px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' }
        },
        'speaking-border': {
          '0%, 100%': { borderColor: '#10b981', boxShadow: '0 0 15px rgba(16, 185, 129, 0.5)' },
          '50%': { borderColor: '#34d399', boxShadow: '0 0 25px rgba(52, 211, 153, 0.8)' },
        }
      }
    },
  },
  plugins: [],
}
