import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['qa/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 60_000,
    hookTimeout: 120_000,
    reporters: ['default'],
  },
})
