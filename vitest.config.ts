import { defineConfig } from 'vitest/config'

// Scoped to tests/ — the services/*/test suites use node:test and run via
// their own `npm --prefix services/... test` scripts.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
