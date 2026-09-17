import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const root = import.meta.dirname

export default defineConfig({
  resolve: {
    alias: {
      '~~': resolve(root, '.'),
      '~': resolve(root, '.')
    }
  },
  test: {
    environment: 'node'
  }
})
