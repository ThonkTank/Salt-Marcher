import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/Alpha1/**',
      '**/Alpha2/**',
    ],
    reporters: [
      'default',
      './scripts/test-reporter.mjs',
    ],
  },
});
