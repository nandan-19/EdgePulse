/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#00d4ff', dark: '#0099bb' },
        surface: { DEFAULT: '#0f172a', card: '#1e293b', border: '#334155' },
      },
      animation: {
        pulse2: 'pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite',
        flow: 'flow 2s linear infinite',
      },
      keyframes: {
        flow: { '0%': { strokeDashoffset: '100' }, '100%': { strokeDashoffset: '0' } },
      },
    },
  },
  plugins: [],
};
