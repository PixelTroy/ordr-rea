import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1f2328',
        muted: '#6b7280',
        line: '#e6e8eb',
        canvas: '#f4f5f7',
        side: '#f7f8fa',
        accent: '#3e4db5',
      },
      boxShadow: {
        pop: '0 12px 40px rgba(16, 18, 23, 0.12)',
      },
    },
  },
  plugins: [],
}

export default config
