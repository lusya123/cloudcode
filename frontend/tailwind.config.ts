import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        surface: 'var(--surface)',
        line: 'var(--line)',
        accent: 'var(--accent)'
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular']
      },
      boxShadow: {
        soft: '0 10px 30px rgba(0, 0, 0, 0.08)',
        inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.5)'
      }
    }
  },
  plugins: []
};

export default config;
