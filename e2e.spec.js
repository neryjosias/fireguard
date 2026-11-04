import { test, expect } from '@playwright/test';

const TOKEN = process.env.FIREFIGHTER_TOKEN;
const ADMIN = { 'x-admin-token': TOKEN || '' };

// Descarta un reporte de prueba para que no quede como pendiente en el panel real.
async function discard(request, id) {
  if (!TOKEN || !id) return;
  await request.patch(`/api/admin/reports/${id}`, { headers: ADMIN, data: { status: 'descartado', note: 'Prueba automática' } });
}

test.describe('Página y seguridad básica', () => {
  test('carga con el aviso de emergencia y las 5 secciones', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/FIREGUARD/);
    await expect(page.getByRole('note')).toContainText('no es un incendio confirmado');
    await expect(page.getByRole('note')).toContainText('911');
    for (const name of ['Mapa', 'Calendario', 'Reportar', 'Bomberos', 'Acerca de']) {
      await expect(page.getByRole('tab', { name })).toBeVisible();
    }
  });

  test('no hay scroll horizontal en la página @movil', async ({ page }) => {
    await page.goto('/');
    for (const tab of ['mapa', 'calendario', 'reportar', 'bomberos', 'acerca']) {
      await page.locator(`[data-tab=${tab}]`).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow, `scroll horizontal en ${tab}`).toBe(false);
    }
  });

  test('"Acerca de" declara el uso de IA y que NASA no lo respalda', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-tab=acerca]').click();
    await expect(page.locator('#acerca')).toContainText('asistencia de IA');
    await expect(page.locator('#acerca')).toContainText('NASA no lo creó ni lo respalda');
  });

  test('la clave de NASA no aparece en ningún archivo público', async ({ page, request }) => {
    const health = await (await request.get('/api/health')).json();
    expect(health.ok).toBe(true);
    for (const file of ['/', '/app.js', '/style.css']) {
      const body = await (await request.get(file)).text();
      expect(body).not.toMatch(/FIRMS_MAP_KEY\s*=/);
      expect(body).not.toMatch(/[0-9a-f]{32}/); // formato de la clave MAP_KEY
    }
  });

  test('el panel de Bomberos rechaza un token incorrecto', async ({ request }) => {
    const r = await request.get('/api/admin/reports', { headers: { 'x-admin-token': 'token-falso' } });
    expect(r.status()).toBe(401);
    const sin = await request.get('/api/admin/reports');
    expect(sin.status()).toBe(401);
  });
});

test.describe('Datos reales de NASA FIRMS', () => {
  let firms = false;
  test.beforeAll(async ({ request }) => { firms = (await (await request.get('/api/health')).json()).firmsKeyConfigured; });

  test('el mapa carga detecciones', async ({ page }) => {
    test.skip(!firms, 'El servidor no tiene FIRMS_MAP_KEY');
    await page.goto('/');
    await expect(page.locator('#mapStatus')).toContainText('detecciones visibles');
    await expect(page.locator('#mapStatus')).toContainText('NASA FIRMS');
  });

  test('el calendario muestra los 2 gráficos y 10 días', async ({ page }) => {
    test.skip(!firms, 'El servidor no tiene FIRMS_MAP_KEY');
    await page.goto('/');
    await page.locator('[data-tab=calendario]').click();
    await expect(page.locator('#chartMain svg')).toBeVisible();
    await expect(page.locator('#calTable tr')).toHaveCount(11); // encabezado + 10 días
    await expect(page.locator('#calStatus')).toContainText('Años de comparación');
  });
});

test.describe('Reportes ciudadanos y panel de Bomberos', () => {
  test('rechaza ubicaciones fuera de Paraguay y descripciones cortas', async ({ request }) => {
    const fuera = await request.post('/api/reports', { data: { lat: 10, lon: 10, description: 'Humo lejos de aquí' } });
    expect(fuera.status()).toBe(400);
    const corta = await request.post('/api/reports', { data: { lat: -23.4, lon: -58.4, description: 'humo' } });
    expect(corta.status()).toBe(400);
  });

  test('un texto con inyección SQL se guarda como texto y no rompe la base', async ({ request }) => {
    const evil = "x'); DROP TABLE reports; -- prueba";
    const r = await request.post('/api/reports', { data: { lat: -23.4, lon: -58.4, description: evil } });
    expect(r.status()).toBe(201);
    const { id } = await r.json();

    const lista = await request.get('/api/reports');
    expect(lista.ok()).toBe(true); // la tabla sigue existiendo
    expect(JSON.stringify(await lista.json())).toContain('DROP TABLE reports');

    if (TOKEN) {
      // Un id con SQL no coincide con nada y no actualiza otros reportes
      const bad = await request.patch(`/api/admin/reports/${encodeURIComponent("1' OR '1'='1")}`, { headers: ADMIN, data: { status: 'atendido' } });
      expect(bad.status()).toBe(404);
    }
    await discard(request, id);
  });

  test('enviar un reporte desde la web y verlo en el panel de Bomberos', async ({ page, request }) => {
    test.skip(!TOKEN, 'Falta FIREFIGHTER_TOKEN');
    const texto = `[PRUEBA] humo en la ruta ${Date.now()}`;

    await page.goto('/');
    await page.locator('[data-tab=reportar]').click();
    await page.locator('#pickmap').click({ position: { x: 200, y: 150 } });
    await expect(page.locator('#pickCoords')).toContainText('Ubicación marcada');
    await page.locator('#repDesc').fill(texto);
    await page.getByRole('button', { name: 'Enviar reporte' }).click();
    const msg = page.locator('#repMsg');
    await expect(msg).toContainText('Reporte enviado');
    const id = (await msg.textContent()).match(/código ([0-9a-f]{8})/)?.[1];
    expect(id).toBeTruthy();

    await page.locator('[data-tab=bomberos]').click();
    await page.locator('#tokenInput').fill(TOKEN);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('#adminReports')).toContainText(texto);

    await discard(request, id);
  });
});
