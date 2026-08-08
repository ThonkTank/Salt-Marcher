import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    // SQLite-heavy integration cases are several times slower on hosted Windows.
    // Assertions still fail immediately; this only prevents runner load from
    // turning successful synchronous scenarios into five-second timeouts.
    testTimeout: 30_000
  }
})
