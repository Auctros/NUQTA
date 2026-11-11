import { defineConfig } from 'vitest/config';
import path from 'path';

// Run every test in a UTC+ zone: this is where UTC-vs-local date bugs show up.
process.env.TZ = 'Africa/Cairo';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '.') } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    pool: 'forks'
  }
});
