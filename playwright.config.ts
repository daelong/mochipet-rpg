import { defineConfig } from '@playwright/test';
const production = process.env.MOCHI_E2E_PRODUCTION === '1';
const url = `http://127.0.0.1:${production ? '4173' : '5173'}`;
export default defineConfig({
  testDir: './apps/web/tests',
  timeout: 60000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: url,
    headless: true,
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  webServer: {
    command: production ? 'pnpm --filter @mochi/web preview --port 4173 --strictPort' : 'pnpm dev',
    url,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1100 } } },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
});
