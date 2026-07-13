import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'https://mixpla.io',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...require('@playwright/test').devices['Desktop Chrome'],
        headless: true,
      },
    },
    {
      name: 'chromium-debug',
      use: {
        ...require('@playwright/test').devices['Desktop Chrome'],
        headless: false,
        launchOptions: { slowMo: 500 },
      },
    },
  ],
});
