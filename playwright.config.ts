import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  // Starting several copies of the installed Chrome at once sometimes hangs one of them
  // (seen as "browser.newContext: Test ended" after 30 s, in a different test each time).
  // Fewer at a time, and one retry: a test that needed it is reported as flaky, not hidden.
  workers: 4,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4321',
    // The installed Google Chrome, so there is no browser to download.
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'pnpm astro dev --port 4321',
    url: 'http://localhost:4321',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
