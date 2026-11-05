import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['packages/**/*.test.ts', 'apps/web/src/**/*.test.ts'], environment: 'node' },
  resolve: {
    alias: {
      '@mochi/shared': new URL('./packages/shared/src/index.ts', import.meta.url).pathname,
      '@mochi/game-data': new URL('./packages/game-data/src/index.ts', import.meta.url).pathname,
    },
  },
});
