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
        'slide-down': {
          '0%':   { transform: 'translateY(-16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        'ruin-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,69,0,0)' },
          '50%':      { boxShadow: '0 0 8px 2px rgba(255,69,0,0.35)' },
        },
        'neon-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0,255,136,0)' },
          '50%':      { boxShadow: '0 0 10px 3px rgba(0,255,136,0.3)' },
        },
        'float-up': {
          '0%':   { transform: 'translateY(0)',   opacity: '1' },
          '100%': { transform: 'translateY(-32px)', opacity: '0' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0'  },
        },
      },
      animation: {
        'slide-up':    'slide-up 0.22s ease-out',
        'slide-down':  'slide-down 0.18s ease-out',
        'ruin-pulse':  'ruin-pulse 2.2s ease-in-out infinite',
        'neon-pulse':  'neon-pulse 2s ease-in-out infinite',
        'float-up':    'float-up 0.9s ease-out forwards',
        'fade-in':     'fade-in 0.25s ease-out',
        'shimmer':     'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
}
