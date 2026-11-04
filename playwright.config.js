// Pruebas de extremo a extremo de FIREGUARD con Playwright.
//   Local:      npm run test:e2e        (arranca el servidor solo)
//   Publicado:  BASE_URL=https://tu-app.onrender.com npm run test:e2e
// El token de Bomberos se toma de FIREFIGHTER_TOKEN (variable de entorno o archivo .env).
import fs from 'fs';
import { defineConfig, devices } from '@playwright/test';

try {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* sin .env */ }

const remote = process.env.BASE_URL;

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 45_000 }, // la primera consulta a NASA FIRMS puede tardar
  workers: 1,                  // los reportes de prueba comparten límite de envíos por hora
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: remote || 'http://localhost:3000', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] }, grep: /@movil/ },
  ],
  webServer: remote ? undefined : {
    command: 'npm start',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
