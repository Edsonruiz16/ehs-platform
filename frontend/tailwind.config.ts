import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta corporativa / industrial
        brand: { DEFAULT: '#0f3d5e', dark: '#0a2a42', light: '#1d6fa5' },
        risk: { low: '#16a34a', medium: '#f59e0b', high: '#dc2626' },
        ink: '#0f172a',
        panel: '#ffffff',
        muted: '#64748b',
      },
      boxShadow: {
        card: '0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)',
      },
    },
  },
  plugins: [],
};

export default config;
