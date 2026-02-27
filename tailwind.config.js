/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:     '#0a0a0f',
        bg2:    '#0f0f1a',
        bg3:    '#141420',
        card:   '#12121e',
        border: '#1e1e35',
        accent: '#ff4500',
        neon:   '#00ff88',
        gold:   '#ffd700',
        info:   '#00aaff',
        muted:  '#c8c8d8',
      },
      fontFamily: {
        bebas:  ['Bebas Neue', 'cursive'],
        mono:   ['Share Tech Mono', 'monospace'],
        raj:    ['Rajdhani', 'sans-serif'],
      },
      keyframes: {
        'slide-up': {
          '0%':   { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
