import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0f1117',
        surface: '#1a1d27',
        'surface-2': '#252836',
        border: '#2e3147',
        primary: {
          DEFAULT: '#6366f1',
          dark: '#4f46e5',
          glow: 'rgba(99,102,241,0.15)',
        },
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        'text-base': '#e2e8f0',
        muted: '#8892a4',
      },
      fontFamily: {
        sans: ['var(--font-rubik)', 'Rubik', 'sans-serif'],
      },
      width: { sidebar: '220px' },
    },
  },
  plugins: [],
}

export default config
