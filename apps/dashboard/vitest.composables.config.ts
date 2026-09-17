import { defineVitestConfig } from '@nuxt/test-utils/config'
import { resolve } from 'node:path'

const root = import.meta.dirname

export default defineVitestConfig({
  test: {
    include: ['tests/composables/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '~~': resolve(root, '.'),
      '~': resolve(root, '.')
    }
  }
})
