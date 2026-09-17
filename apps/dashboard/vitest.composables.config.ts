import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    include: ['tests/composables/**/*.test.ts'],
  },
})
