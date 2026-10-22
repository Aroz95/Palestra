// Collaudo end-to-end (E2E-01..15 del piano di collaudo). Esecuzione: npm run test:e2e
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  testMatch: /.*\.e2e\.js$/,
  timeout: 90_000,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    // Viewport, touch e user agent di iPhone 13 (motore Chromium: Safari/WebKit va verificato a mano, vedi docs/COLLAUDO.md)
    ...devices['iPhone 13'],
    browserName: 'chromium',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
