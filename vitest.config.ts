import { defineConfig } from 'vitest/config';

// Bewusst getrennt von vite.config.ts: Tests brauchen weder PWA-Plugin noch Browser.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
