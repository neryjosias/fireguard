// FIREGUARD - servidor
// - Consulta NASA FIRMS (MODIS y VIIRS) usando la clave guardada SOLO en el servidor.
// - Armoniza ambos sensores en un calendario de actividad.
// - Recibe reportes ciudadanos y ofrece un panel protegido para bomberos.

import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- Configuración (.env sencillo, sin dependencias) ----------
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* sin .env: se usan variables del entorno */ }

const MAP_KEY = process.env.FIRMS_MAP_KEY;
const ADMIN_TOKEN = process.env.FIREFIGHTER_TOKEN;
const PORT = Number(process.env.PORT) || 3000;
const FIRMS_BASE = process.env.FIRMS_BASE || 'https://firms.modaps.eosdis.nasa.gov';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

// Caja que rodea a Paraguay: oeste,sur,este,norte
const BBOX = { w: -62.7, s: -27.7, e: -54.2, n: -19.2 };
const AREA = `${BBOX.w},${BBOX.s},${BBOX.e},${BBOX.n}`;

if (!MAP_KEY) console.warn('[AVISO] Falta FIRMS_MAP_KEY: las rutas de datos de NASA devolverán error.');
if (!ADMIN_TOKEN) console.warn('[AVISO] Falta FIREFIGHTER_TOKEN: el panel de bomberos queda deshabilitado.');

// ---------- Utilidades de fecha ----------
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const utcDay = (d = new Date()) => new Date(iso(d) + 'T00:00:00Z');

// ---------- Caché en memoria ----------
const cache = new Map();
function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.p;
  const p = fn().catch((e) => { cache.delete(key); throw e; });
  cache.set(key, { exp: Date.now() + ttlMs, p });
  return p;
}

// ---------- NASA FIRMS ----------
function parseCsv(text, product) {
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(',');
  if (!head.includes('latitude')) throw new Error('Respuesta inesperada de FIRMS: ' + text.slice(0, 120));
  const ix = Object.fromEntries(head.map((h, i) => [h, i]));
  const isModis = product.startsWith('MODIS');
  const out = [];
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const c = line.split(',');
    let conf;
    if (isModis) {
      const v = Number(c[ix.confidence]);
      conf = v >= 80 ? 'high' : v >= 30 ? 'nominal' : 'low'; // MODIS: 0-100 -> categorías
    } else {
      conf = { l: 'low', n: 'nominal', h: 'high' }[c[ix.confidence]] || 'nominal'; // VIIRS ya es l/n/h
    }
    out.push({
      lat: Number(c[ix.latitude]),
      lon: Number(c[ix.longitude]),
      date: c[ix.acq_date],
      time: String(c[ix.acq_time]).padStart(4, '0'),
      sensor: isModis ? 'MODIS' : 'VIIRS',
      sat: c[ix.satellite],
      frp: Number(c[ix.frp]) || 0,
      conf,
      dn: c[ix.daynight],
      product,
    });
  }
  return out;
}

function fetchChunk(product, start, days) {
  const archive = product.endsWith('_SP');
  const ttl = archive ? 24 * 3600e3 : 10 * 60e3;
  return cached(`${product}|${start}|${days}`, ttl, async () => {
    if (!MAP_KEY) throw new Error('Falta FIRMS_MAP_KEY en el servidor');
    const url = `${FIRMS_BASE}/api/area/csv/${MAP_KEY}/${product}/${AREA}/${days}/${start}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const text = await r.text();
    if (!r.ok) throw new Error(`FIRMS ${product} respondió ${r.status}`);
    return parseCsv(text, product);
  });
}

// FIRMS limita cada consulta a 5 días: se parte el rango en trozos.
async function fetchProduct(product, startStr, days) {
  const chunks = [];
  let d = new Date(startStr + 'T00:00:00Z');
  for (let left = days; left > 0; ) {
    const n = Math.min(5, left);
    chunks.push([iso(d), n]);
    d = addDays(d, n);
    left -= n;
  }
  return (await Promise.all(chunks.map(([s, n]) => fetchChunk(product, s, n)))).flat();
}

async function fetchMany(products, startStr, days) {
  const res = await Promise.allSettled(products.map((p) => fetchProduct(p, startStr, days)));
  const points = [];
  const failed = [];
  res.forEach((r, i) => (r.status === 'fulfilled' ? points.push(...r.value) : failed.push(products[i])));
  if (failed.length === products.length) {
    throw new Error('No se pudo consultar NASA FIRMS. Revisá la clave y la conexión.');
  }
  return { points, failed, ok: products.filter((p) => !failed.includes(p)) };
}

const CURRENT_PRODUCTS = ['MODIS_NRT', 'VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT'];
// Para comparar con años anteriores solo existen archivos "SP" de estos dos:
const ARCHIVE_PRODUCTS = ['MODIS_SP', 'VIIRS_SNPP_SP'];

function getCurrent(days) {
  const today = utcDay();
  const start = iso(addDays(today, -(days - 1)));
  return fetchMany(CURRENT_PRODUCTS, start, days).then((r) => ({ ...r, start, end: iso(today) }));
}

// ---------- Armonización MODIS + VIIRS ----------
// MODIS ve píxeles de ~1 km y VIIRS de ~375 m. Para decir "es el mismo lugar" se agrupan
// las detecciones en una grilla de 0,02° (~2 km) por día.
const cellKey = (p) => `${Math.round(p.lat / 0.02)}_${Math.round(p.lon / 0.02)}`;

function buildCalendar(points, dates) {
  const byDate = new Map(dates.map((d) => [d, []]));
  for (const p of points) byDate.get(p.date)?.push(p);
  return dates.map((date) => {
    const cells = new Map();
    let modis = 0, viirs = 0;
    for (const p of byDate.get(date)) {
      p.sensor === 'MODIS' ? modis++ : viirs++;
      let c = cells.get(cellKey(p));
      if (!c) cells.set(cellKey(p), (c = { m: false, v: false, snppOrModis: false, frp: 0, high: false }));
      p.sensor === 'MODIS' ? (c.m = true) : (c.v = true);
      if (p.sensor === 'MODIS' || p.product.includes('SNPP')) c.snppOrModis = true;
      c.frp = Math.max(c.frp, p.frp);
      if (p.conf === 'high') c.high = true;
    }
    const arr = [...cells.values()];
    return {
      date,
      modis,
      viirs,
      unified: arr.length, // zonas distintas con actividad (ambos sensores, sin duplicar)
      both: arr.filter((c) => c.m && c.v).length, // zonas vistas por ambos sensores
      comparable: arr.filter((c) => c.snppOrModis).length, // MODIS + VIIRS-SNPP, comparable con archivo histórico
      high: arr.filter((c) => c.high).length,
      frp: Math.round(arr.reduce((s, c) => s + c.frp, 0)),
    };
  });
}

function datesBetween(startStr, days) {
  const s = new Date(startStr + 'T00:00:00Z');
  return Array.from({ length: days }, (_, i) => iso(addDays(s, i)));
}

async function baselineFor(startStr, days, years = 2) {
  const out = [];
  for (let y = 1; y <= years; y++) {
    const s = new Date(startStr + 'T00:00:00Z');
    s.setUTCFullYear(s.getUTCFullYear() - y);
    const sStr = iso(s);
    try {
      const r = await fetchMany(ARCHIVE_PRODUCTS, sStr, days);
      const cal = buildCalendar(r.points, datesBetween(sStr, days));
      out.push({ year: s.getUTCFullYear(), counts: cal.map((c) => c.comparable) });
    } catch { /* ese año no está disponible: se omite */ }
  }
  return out;
}

function topZones(points, n = 5) {
  const z = new Map();
  for (const p of points) {
    const k = `${Math.floor(p.lat / 0.5) * 0.5}_${Math.floor(p.lon / 0.5) * 0.5}`;
    const e = z.get(k) || { lat: Math.floor(p.lat / 0.5) * 0.5, lon: Math.floor(p.lon / 0.5) * 0.5, n: 0, frp: 0 };
    e.n++; e.frp += p.frp;
    z.set(k, e);
  }
  return [...z.values()].sort((a, b) => b.n - a.n).slice(0, n).map((e) => ({ ...e, frp: Math.round(e.frp) }));
}

// ---------- Reportes ciudadanos ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
let reports = [];
try { reports = JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8')); } catch { reports = []; }
function saveReports() {
  const tmp = REPORTS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(reports, null, 2));
  fs.renameSync(tmp, REPORTS_FILE);
}
const STATUSES = ['pendiente', 'verificado', 'atendido', 'descartado'];
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max);

const hits = new Map();
function rateLimited(ip, max = 5, windowMs = 3600e3) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr);
  return false;
}

function haversineKm(a, b, c, d) {
  const R = 6371, r = (x) => (x * Math.PI) / 180;
  const dLat = r(c - a), dLon = r(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------- App ----------
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '20kb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e.message);
  res.status(502).json({ error: e.message });
});

// Detecciones recientes (para el mapa)
app.get('/api/fires', wrap(async (req, res) => {
  const days = Math.min(5, Math.max(1, parseInt(req.query.days) || 2));
  const r = await getCurrent(days);
  res.json({
    source: 'NASA FIRMS (MODIS y VIIRS, tiempo casi real)',
    start: r.start, end: r.end, sourcesOk: r.ok, sourcesFailed: r.failed,
    // formato compacto: [lat, lon, fecha, hora UTC, sensor, satélite, confianza, FRP]
    points: r.points.map((p) => [p.lat, p.lon, p.date, p.time, p.sensor, p.sat, p.conf, p.frp]),
  });
}));

// Calendario armonizado + anomalías
app.get('/api/analysis', wrap(async (req, res) => {
  const days = Math.min(10, Math.max(3, parseInt(req.query.days) || 10));
  const r = await getCurrent(days);
  const dates = datesBetween(r.start, days);
  const calendar = buildCalendar(r.points, dates);
  const baseline = await cached(`base|${r.start}|${days}`, 24 * 3600e3, () => baselineFor(r.start, days));

  const vals = calendar.map((c) => c.comparable);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;

  calendar.forEach((c, i) => {
    const bl = baseline.map((b) => b.counts[i]).filter((x) => x != null);
    c.baseline = bl.length ? Math.round((bl.reduce((a, b) => a + b, 0) / bl.length) * 10) / 10 : null;
    c.ratio = c.baseline ? Math.round((c.comparable / c.baseline) * 100) / 100 : null;
    c.z = Math.round(((c.comparable - mean) / std) * 100) / 100;
    c.anomaly = (c.ratio != null && c.ratio >= 2 && c.comparable >= 10) || c.z >= 2;
  });

  res.json({
    start: r.start, end: r.end, sourcesOk: r.ok, sourcesFailed: r.failed,
    method: {
      grid: 'Detecciones agrupadas en celdas de 0,02° (~2 km) por día; una celda cuenta una vez aunque la vean ambos sensores.',
      confidence: 'MODIS (0-100) se convierte a bajo (<30), nominal (30-79) y alto (≥80); VIIRS ya usa l/n/h.',
      anomaly: 'Marcado si el día tiene ≥2x el promedio de los mismos días de años anteriores (con ≥10 zonas) o un puntaje z ≥ 2 dentro de la ventana.',
      baselineYears: baseline.map((b) => b.year),
      note: 'Los conteos "comparables" usan MODIS + VIIRS S-NPP, para poder compararlos con el archivo histórico.',
    },
    calendar,
    topZones: topZones(r.points),
  });
}));

// Reportes: lista pública (sin datos de contacto)
app.get('/api/reports', (req, res) => {
  res.json(reports.filter((r) => r.status !== 'descartado').map((r) => ({
    id: r.id, lat: r.lat, lon: r.lon, createdAt: r.createdAt, status: r.status, description: r.description,
  })));
});

app.post('/api/reports', (req, res) => {
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'Demasiados reportes desde tu conexión. Intentá más tarde.' });
  const lat = Number(req.body.lat), lon = Number(req.body.lon);
  if (!(lat >= BBOX.s && lat <= BBOX.n && lon >= BBOX.w && lon <= BBOX.e)) {
    return res.status(400).json({ error: 'La ubicación debe estar dentro de Paraguay.' });
  }
  const description = clean(req.body.description, 500);
  if (description.length < 10) return res.status(400).json({ error: 'Describí lo que viste (mínimo 10 caracteres).' });
  const report = {
    id: crypto.randomBytes(4).toString('hex'),
    lat: Math.round(lat * 1e5) / 1e5,
    lon: Math.round(lon * 1e5) / 1e5,
    description,
    name: clean(req.body.name, 80),
    contact: clean(req.body.contact, 80),
    status: 'pendiente',
    createdAt: new Date().toISOString(),
    history: [{ at: new Date().toISOString(), status: 'pendiente', note: 'Reporte recibido' }],
  };
  reports.push(report);
  saveReports();
  res.status(201).json({ id: report.id, status: report.status });
});

// Panel de bomberos (requiere token)
function admin(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(503).json({ error: 'Panel deshabilitado: falta FIREFIGHTER_TOKEN en el servidor.' });
  const a = Buffer.from(String(req.get('x-admin-token') || ''));
  const b = Buffer.from(ADMIN_TOKEN);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
  res.status(401).json({ error: 'Token incorrecto.' });
}

app.get('/api/admin/reports', admin, (req, res) => res.json([...reports].reverse()));

app.patch('/api/admin/reports/:id', admin, (req, res) => {
  const r = reports.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Reporte no encontrado.' });
  const status = String(req.body.status || '');
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Estado inválido.' });
  r.status = status;
  r.history.push({ at: new Date().toISOString(), status, note: clean(req.body.note, 300) });
  saveReports();
  res.json(r);
});

// Alertas: reportes abiertos con una detección satelital cerca (≤5 km, últimos 3 días).
// Es una pista para priorizar, NO una confirmación de incendio.
app.get('/api/admin/alerts', admin, wrap(async (req, res) => {
  const { points } = await getCurrent(3);
  const alerts = [];
  for (const r of reports.filter((x) => x.status === 'pendiente' || x.status === 'verificado')) {
    let best = null;
    for (const p of points) {
      if (Math.abs(p.lat - r.lat) > 0.06 || Math.abs(p.lon - r.lon) > 0.06) continue;
      const km = haversineKm(r.lat, r.lon, p.lat, p.lon);
      if (km <= 5 && (!best || km < best.km)) best = { km: Math.round(km * 10) / 10, date: p.date, time: p.time, sensor: p.sensor, conf: p.conf };
    }
    if (best) alerts.push({ reportId: r.id, lat: r.lat, lon: r.lon, description: r.description, createdAt: r.createdAt, nearest: best });
  }
  res.json(alerts);
}));

app.get('/api/health', (req, res) => res.json({ ok: true, firmsKeyConfigured: !!MAP_KEY, adminConfigured: !!ADMIN_TOKEN }));

app.listen(PORT, () => console.log(`FIREGUARD escuchando en http://localhost:${PORT}`));
