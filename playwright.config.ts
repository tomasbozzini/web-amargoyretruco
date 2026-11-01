import { defineConfig, devices } from '@playwright/test';

/**
 * Tests end-to-end contra el build de PRODUCCIÓN (adaptador Node, mismos headers
 * de seguridad que en Vercel). `npm run test:e2e` primero hace el build y después:
 *   - :4321 lee el "Sheets" simulado (tests/e2e/mock-sheet-server.mjs)
 *   - :4322 apunta a un Sheets caído y sin copia en memoria -> usa el respaldo
 */
const MOCK = 'http://127.0.0.1:4400';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /desktop\.spec\.ts/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testMatch: /desktop\.spec\.ts/ },
  ],
  webServer: [
    {
      command: 'node tests/e2e/mock-sheet-server.mjs',
      url: `${MOCK}/health`,
      reuseExistingServer: false,
    },
    {
      command: 'node dist/server/entry.mjs',
      url: 'http://127.0.0.1:4321/robots.txt',
      env: { HOST: '127.0.0.1', PORT: '4321', CATALOG_CSV_URL: `${MOCK}/catalogo.csv` },
      reuseExistingServer: false,
    },
    {
      // Mismo build; la URL del Sheets apunta a un puerto donde no hay nada.
      command: 'node dist/server/entry.mjs',
      url: 'http://127.0.0.1:4322/robots.txt',
      env: { HOST: '127.0.0.1', PORT: '4322', CATALOG_CSV_URL: 'http://127.0.0.1:4499/no-existe.csv' },
      reuseExistingServer: false,
    },
  ],
});
