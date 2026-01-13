import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                glass: {
                    light: 'rgba(255, 255, 255, 0.7)',
                    dark: 'rgba(247, 247, 247, 0.8)',
                }
            },
            backdropBlur: {
                glass: '20px',
            },
            boxShadow: {
                glass: '0 8px 32px rgba(0, 0, 0, 0.08)',
                'glass-hover': '0 12px 40px rgba(0, 0, 0, 0.12)',
            }
        },
    },
    plugins: [],
}
export default config
