import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    root: path.resolve(__dirname, '..'),
    include: ['qa/frontend/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['qa/frontend/setup.ts'],
    css: false,
    restoreMocks: true,
    testTimeout: 20_000,
    reporters: ['verbose'],
  },
})
