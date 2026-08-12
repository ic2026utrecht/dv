import type { Config } from 'tailwindcss'
import PrimeUI from 'tailwindcss-primeui'

export default {
  content: [
    './app/assets/css/main.css',
    './app/components/**/*.{vue,js,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/plugins/**/*.{js,ts}',
    './app/composables/**/*.{js,ts}',
    './app/app.vue',
    './nuxt.config.{js,ts}',
  ],
  theme: {
    extend: {
      colors: {
        ic: {
          brand: 'var(--ic-brand)',
          orange: 'var(--ic-orange)',
        },
      },
    },
  },
  plugins: [PrimeUI],
} satisfies Config
