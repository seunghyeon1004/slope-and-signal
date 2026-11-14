// Slope and Signal - Playwright config (bundled headless Chromium). Written with Claude (Anthropic).
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  retries: 0,
  use: { baseURL: 'http://localhost:4173/slope-and-signal/', headless: true },
  webServer: { command: 'npx vite build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173/slope-and-signal/', reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
});
