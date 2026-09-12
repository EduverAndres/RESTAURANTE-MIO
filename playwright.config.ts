import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against the dev server and the seeded Supabase
// project. Set PLAYWRIGHT_BASE_URL to target another environment.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // One shared dev server and one shared remote Supabase project back every
  // spec; running workers in parallel doubles up on Turbopack route
  // compilation and real network calls and was observed to cause spurious
  // timeouts. Keep it serial for determinism.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    locale: 'es-CO',
    viewport: { width: 1280, height: 900 },
    // Framer Motion's spring animations (e.g. the cart FAB's enter transition)
    // do not settle reliably under headless Chromium's rendering pipeline,
    // leaving elements transformed off-screen. Reduced motion makes the app's
    // `useReducedMotion()` checks skip those animations, which is also what a
    // real prefers-reduced-motion visitor gets, without touching any test's
    // assertions.
    reducedMotion: 'reduce',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
