// FIREGUARD - interfaz. Todo el texto de datos se inserta con textContent (sin innerHTML) para evitar XSS.
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
};
const svg = (tag, props = {}, ...kids) => {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(props)) if (v != null) e.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
};
const api = async (url, opts = {}) => {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
};
const setStatus = (node, text, kind = '') => { node.textContent = text; node.className = 'status ' + kind; };
const radio = (name) => document.querySelector(`input[name="${name}"]:checked`).value;
const PY_BOUNDS = [[-27.7, -62.7], [-19.2, -54.2]];
const CONF = { high: 'alta', nominal: 'nominal', low: 'baja' };
const COLOR = { modis: '#f5a524', viirs: '#ff4d3a', uni: '#22d3ee', hist: '#4f6b79', rep: '#a78bfa' };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const STATION_ICON = 'img/cuartel.png';
const shortDate = (s) => { const [, m, d] = s.split('-'); return `${Number(d)} ${MESES[Number(m) - 1]}`; };
const ddmm = (s) => { if (!s) return ''; const [y, m, d] = s.slice(0, 10).split('-'); return d ? `${d}/${m}/${y}` : s; };
const fmtDateTime = (iso) => new Date(iso).toLocaleString('es-PY');
const fmtN = (n, d = 0) => (n == null || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('es-PY', { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtKm = (km) => (km < 10 ? km.toFixed(1).replace('.', ',') : String(Math.round(km)));
const daysAgo = (s) => (s ? (Date.now() - new Date(s.slice(0, 10) + 'T12:00:00Z').getTime()) / 86400000 : Infinity);
const isMobile = () => window.matchMedia('(max-width: 1000px)').matches;

// ---------- Pestañas ----------
let calLoaded = false;
const tabButtons = [...document.querySelectorAll('#tabs button')];
tabButtons.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
function showTab(name) {
  tabButtons.forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === name));
  if (name === 'mapa') setTimeout(() => map.invalidateSize(), 50);
  if (name === 'reportar') setTimeout(() => pickMap.invalidateSize(), 50);
  if (name === 'calendario' && !calLoaded) loadCalendar();
  if (name === 'bomberos' && token) loadAdmin();
}

// ---------- Mapa principal ----------
// Mapa oscuro: OpenStreetMap con un filtro CSS (no necesita clave de API)
const dark = () => L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors', className: 'tiles-dark' });
const osm = () => L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' });
const esri = () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Imágenes © Esri' });
const map = L.map('map', { preferCanvas: true, zoomSnap: 0.25 }).fitBounds(PY_BOUNDS);
const baseDark = dark().addTo(map);
L.control.layers({ Oscuro: baseDark, Calles: osm(), Satélite: esri() }).addTo(map);
const fireRenderer = L.canvas({ padding: 0.5 });
const fireLayer = L.layerGroup().addTo(map);
const reportLayer = L.layerGroup().addTo(map);
const stationLayer = L.layerGroup().addTo(map);
let stations = [];
let fires = [];
let reportsCount = null;
let visible = [];
let selected = null;
let selMarker = null;

const legend = L.control({ position: 'bottomleft' });
legend.onAdd = () => el('div', { class: 'map-legend' },
  el('div', {}, el('i', { class: 'g ring' }), 'MODIS'),
  el('div', {}, el('i', { class: 'g dot' }), 'VIIRS'),
  el('div', {}, el('i', { class: 'g rep' }), 'Reporte ciudadano'),
  el('div', {}, el('img', { class: 'g stn', src: STATION_ICON, alt: '' }), 'Cuartel de bomberos'),
  el('div', {}, 'Más grande = más potencia'));
legend.addTo(map);

// ---------- Cuarteles de bomberos (archivo estático public/bomberos.json) ----------
const rad = (x) => (x * Math.PI) / 180;
function kmBetween(a, b, c, d) {
  const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
function nearestStations(lat, lon, n = 3) {
  return stations.map((s) => ({ s, km: kmBetween(lat, lon, s.lat, s.lon) })).sort((a, b) => a.km - b.km).slice(0, n);
}
const stationName = (s) => `${s.t} de ${s.d}`;
async function loadStations() {
  try {
    stations = await api('/bomberos.json');
    for (const s of stations) {
      s.marker = L.marker([s.lat, s.lon], {
        icon: L.icon({ iconUrl: STATION_ICON, className: 'stn-pin', iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] }),
        zIndexOffset: -500, title: stationName(s),
      }).bindPopup(el('div', {}, el('b', {}, 'Cuartel de bomberos'), el('br'), stationName(s), el('br'),
        el('small', {}, `${s.b ? s.b + ', ' : ''}${s.d} (${s.p}). Emergencias: 911 / Bomberos 132.`))).addTo(stationLayer);
    }
    if (!selected) renderOverview();
  } catch { /* sin cuarteles */ }
}
$('#fStations').addEventListener('change', (e) => { e.target.checked ? map.addLayer(stationLayer) : map.removeLayer(stationLayer); });
let nearMarked = [];
function markNearStations(list) {
  nearMarked.forEach((s) => s.marker?.getElement()?.classList.remove('near-pin'));
  nearMarked = list.map((n) => n.s);
  nearMarked.forEach((s) => s.marker?.getElement()?.classList.add('near-pin'));
}

// ---------- Focos ----------
async function loadFires() {
  setStatus($('#mapStatus'), 'Consultando NASA FIRMS…', 'loading');
  try {
    const d = await api('/api/fires?days=' + radio('days'));
    fires = d.points.map(([lat, lon, date, time, sensor, sat, conf, frp]) => ({ lat, lon, date, time, sensor, sat, conf, frp }));
    const failed = d.sourcesFailed.length ? ` Sin respuesta de: ${d.sourcesFailed.join(', ')}.` : '';
    $('#mapStatus').dataset.base = `Datos de NASA FIRMS del ${d.start} al ${d.end} (UTC).${failed}`;
    drawFires();
  } catch (e) {
    setStatus($('#mapStatus'), 'No se pudieron cargar los datos: ' + e.message + ' Probá de nuevo con Actualizar.', 'err');
  }
}
function drawFires() {
  fireLayer.clearLayers();
  const m = $('#fMODIS').checked, v = $('#fVIIRS').checked, hi = $('#fHigh').checked;
  visible = fires.filter((p) => !((p.sensor === 'MODIS' && !m) || (p.sensor === 'VIIRS' && !v) || (hi && p.conf !== 'high')));
  for (const p of visible) {
    const r = Math.min(9, 3 + Math.sqrt(p.frp) / 2);
    const col = p.sensor === 'MODIS' ? COLOR.modis : COLOR.viirs;
    // Halo suave (no recibe clics) + núcleo
    L.circleMarker([p.lat, p.lon], { renderer: fireRenderer, radius: r * 2.4, stroke: false, fillColor: col, fillOpacity: 0.16, interactive: false }).addTo(fireLayer);
    const core = p.sensor === 'MODIS'
      ? L.circleMarker([p.lat, p.lon], { renderer: fireRenderer, radius: r + 1.5, color: COLOR.modis, weight: 2, fillColor: COLOR.modis, fillOpacity: 0.15 })
      : L.circleMarker([p.lat, p.lon], { renderer: fireRenderer, radius: r, color: '#ffb199', weight: 1, fillColor: COLOR.viirs, fillOpacity: 0.85 });
    core.on('click', (ev) => { L.DomEvent.stopPropagation(ev); openFocus(p); });
    core.addTo(fireLayer);
  }
  setStatus($('#mapStatus'), `${$('#mapStatus').dataset.base || ''} ${visible.length} de ${fires.length} detecciones visibles.`);
  if (!selected) renderOverview();
}
['fMODIS', 'fVIIRS', 'fHigh'].forEach((id) => $('#' + id).addEventListener('change', drawFires));
document.querySelectorAll('input[name="days"]').forEach((i) => i.addEventListener('change', loadFires));
$('#btnReload').addEventListener('click', () => { loadFires(); loadPublicReports(); });
$('#btnPY').addEventListener('click', () => map.fitBounds(PY_BOUNDS));
$('#btnReportar').addEventListener('click', () => { showTab('reportar'); window.scrollTo({ top: 0 }); });
$('#btnLoc').addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Tu navegador no permite usar la ubicación.');
  navigator.geolocation.getCurrentPosition((p) => map.setView([p.coords.latitude, p.coords.longitude], 11), () => alert('No se pudo obtener tu ubicación. Revisá el permiso del navegador.'));
});

async function loadPublicReports() {
  try {
    const list = await api('/api/reports');
    reportsCount = list.length;
    reportLayer.clearLayers();
    for (const r of list) {
      L.circleMarker([r.lat, r.lon], { radius: 7, color: '#ddd6fe', fillColor: COLOR.rep, fillOpacity: 0.9, weight: 2 })
        .bindPopup(el('div', {}, el('b', {}, 'Reporte ciudadano'), ` (${r.status})`, el('br'), r.description, el('br'),
          el('small', {}, fmtDateTime(r.createdAt) + '. Sin verificar, salvo que figure como verificado.')))
        .addTo(reportLayer);
    }
    if (!selected) renderOverview();
  } catch { /* sin reportes */ }
}
$('#fReports').addEventListener('change', (e) => { e.target.checked ? map.addLayer(reportLayer) : map.removeLayer(reportLayer); });

// ---------- Íconos (trazos SVG simples) ----------
const ICONS = {
  viento: ['M3 8h11a3 3 0 1 0-3-3', 'M3 12h15a3 3 0 1 1-3 3', 'M3 16h8'],
  aire: ['M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z', 'M9.5 15.5l5-5', 'M10 11h.01', 'M14 15h.01'],
  temp: ['M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z', 'M12 9v7'],
  suelo: ['M3 14h18', 'M3 18h18', 'M5 10l3-3 3 3 3-3 3 3 2-2'],
  lluvia: ['M7 15a4 4 0 1 1 .6-8A5 5 0 0 1 17 8a3.5 3.5 0 0 1 0 7z', 'M8 18l-1 3', 'M12 18l-1 3', 'M16 18l-1 3'],
  veg: ['M5 19c0-8 6-14 14-14 0 8-6 14-14 14z', 'M5 19l7-7'],
  pendiente: ['M3 19h18V7z', 'M9 15l4-3'],
  combustible: ['M12 3l5 7h-3l4 6H6l4-6H7z', 'M12 16v5'],
  pin: ['M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z', 'M12 10h.01'],
};
const icon = (name) => svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, (ICONS[name] || ICONS.pin).map((d) => svg('path', { d })));
const FACTOR_TEXT = {
  viento: ['Viento fuerte', 'Poco viento'], aire: ['Aire seco', 'Aire húmedo'], temp: ['Temperatura alta', 'Temperatura baja'],
  suelo: ['Suelo seco', 'Suelo húmedo'], lluvia: ['Falta de lluvia', 'Lluvia reciente'], veg: ['Vegetación seca', 'Vegetación húmeda'],
  pendiente: ['Pendiente', 'Terreno plano'], combustible: ['Vegetación para quemar', 'Poca vegetación'],
};

// ---------- Datos del resumen: se leen de las filas por fuente que arma el servidor ----------
const num = (s) => { const m = s == null ? null : String(s).match(/-?\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',', '.')) : null; };
function metricsOf(s) {
  const rows = s.rows || [];
  const row = (prefix) => { const r = rows.find((x) => x.label.startsWith(prefix)); return r && r.value && r.value !== 'sin dato' ? r : null; };
  const item = (label) => (s.items || []).find((i) => i.label === label);
  const m = {};
  const w = row('Viento (');
  const wm = w && w.value.match(/([\d.,]+) km\/h desde el (\S+) \(([\d.,]+)°\)/);
  if (wm) m.wind = { kmh: num(wm[1]), from: wm[2], fromDeg: num(wm[3]), toward: s.windToward, date: w.date };
  const t = row('Temperatura del aire');
  if (t) m.air = { tC: num(t.value), rh: num((t.value.match(/humedad relativa ([\d.,]+)/) || [])[1]), date: t.date };
  const ss = row('Humedad superficial'), sr = row('Humedad de raíces');
  if (ss || sr) {
    const it = item('Suelo (humedad)');
    m.soil = {
      surface: ss ? num(ss.value) : null, root: sr ? num(sr.value) : null,
      pctl: sr ? num((sr.value.match(/percentil ([\d.,]+)/) || [])[1]) : null,
      rel: it ? (it.text.match(/(más seca de lo habitual|más húmeda de lo habitual|dentro de lo habitual)/) || [])[1] : null,
      date: (ss || sr).date,
    };
  }
  const ch = row('Lluvia diaria'), im = row('Precipitación de 7 días');
  if (ch || im) m.rain = {
    mm30: ch ? num(ch.value) : null, dryDays: ch ? num((ch.value.match(/, (\d+) días? secos/) || [])[1]) : null, date30: ch && ch.date,
    mm7: im ? num(im.value) : null, date7: im && im.date,
  };
  const cov = row('Cobertura del terreno'), veg = row('Vegetación (');
  if (cov || veg) {
    const nd = veg && veg.value.match(/NDVI (-?[\d.,]+) \(([^)]+)\)/), nm = veg && veg.value.match(/NDMI (-?[\d.,]+) \(([^)]+)\)/);
    m.veg = { cover: cov && cov.value, ndvi: nd && nd[1], ndviTxt: nd && nd[2], ndmi: nm && nm[1], ndmiTxt: nm && nm[2], date: veg && veg.date };
  }
  const sl = row('Pendiente'), ele = row('Elevación'), tx = item('Suelo (tipo)'), deg = item('Suelo (estado)'), radar = row('Cambio en la superficie');
  m.terrain = {
    slope: sl && num(sl.value), elev: ele && num(ele.value),
    texture: tx && (tx.text.match(/Textura ([^(]+?) \(/) || [])[1], textureNote: tx && (tx.text.split(': ')[1] || '').replace(/\.$/, ''),
    degraded: deg && deg.text, radar: radar && radar.value,
  };
  return m;
}

// ---------- Panel de análisis del foco ----------
const panel = $('#focusPanel');
const card = (cls, ...kids) => el('div', { class: 'card fp-card ' + cls }, ...kids);
const title = (text, small) => el('h3', { class: 'fp-title' }, text, small ? el('small', {}, small) : null);

function renderOverview() {
  if (selected) return;
  const modis = visible.filter((p) => p.sensor === 'MODIS').length;
  const high = visible.filter((p) => p.conf === 'high').length;
  const maxFrp = visible.reduce((a, p) => Math.max(a, p.frp), 0);
  const kpi = (label, value, cls = '', glyph = null) => el('div', { class: 'card kpi ' + cls }, el('span', {}, glyph, label), el('b', {}, value));
  const top = [...visible].sort((a, b) => b.frp - a.frp).slice(0, 6);
  panel.replaceChildren(
    el('div', { class: 'fp-full kpis' },
      kpi('Detecciones', fmtN(visible.length), 'hot'),
      kpi('MODIS', fmtN(modis), '', el('i', { class: 'g ring' })),
      kpi('VIIRS', fmtN(visible.length - modis), '', el('i', { class: 'g dot' })),
      kpi('Confianza alta', fmtN(high)),
      kpi('Potencia máx.', `${fmtN(maxFrp)} MW`, 'hot'),
      kpi('Reportes', reportsCount == null ? '—' : fmtN(reportsCount), 'cy', el('i', { class: 'g rep' }))),
    card('fp-full hint', icon('pin'), el('p', {}, el('b', {}, 'Tocá un foco en el mapa '), 'para ver su análisis: puntaje de propagación, viento, aire, suelo, lluvia, vegetación y los cuarteles de bomberos más cercanos.')),
    card('fp-full', title('Focos más intensos', 'por potencia radiativa (FRP)'),
      top.length ? el('ul', { class: 'toplist' }, top.map((p) => {
        const n = nearestStations(p.lat, p.lon, 1)[0];
        return el('li', {}, el('button', { type: 'button', onclick: () => openFocus(p, true) },
          el('i', { class: 'g ' + (p.sensor === 'MODIS' ? 'ring' : 'dot') }),
          el('span', { class: 'where' }, `${p.sensor} · ${ddmm(p.date)} ${p.time.slice(0, 2)}:${p.time.slice(2)} UTC`,
            el('small', {}, n ? `Cuartel más cercano: ${n.s.d} (${n.s.p}), a ${fmtKm(n.km)} km` : `${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}`)),
          el('span', { class: 'frp' }, `${fmtN(p.frp)} MW`)));
      })) : el('p', { class: 'fp-empty' }, fires.length ? 'Ningún foco coincide con los filtros.' : 'Cargando detecciones…')));
}

function closeFocus() {
  selected = null;
  if (selMarker) { map.removeLayer(selMarker); selMarker = null; }
  markNearStations([]);
  renderOverview();
}

const focusCache = new Map();
let focusSeq = 0;
function openFocus(p, pan = false) {
  selected = p;
  const seq = ++focusSeq;
  if (selMarker) map.removeLayer(selMarker);
  selMarker = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: 'sel-ring', iconSize: [34, 34] }), interactive: false, zIndexOffset: 1000 }).addTo(map);
  if (pan) map.setView([p.lat, p.lon], Math.max(map.getZoom(), 9));
  const near = nearestStations(p.lat, p.lon, 3);
  markNearStations(near);

  const head = focusHeader(p);
  const stationsCard = nearCard(near);
  const skel = (cls, t) => card(cls + ' skel', title(t), el('div', { class: 'bone big' }), el('div', { class: 'bone w60' }), el('div', { class: 'bone w40' }));
  panel.replaceChildren(head,
    el('div', { class: 'card fp-card fp-tall skel' }, el('p', { class: 'status loading' }, 'Analizando el área con datos de NASA, Copernicus y ECMWF. Puede tardar hasta un minuto.'), el('div', { class: 'bone big' })),
    skel('', '1. Viento'), skel('', '2. Aire'), skel('', '3. Suelo'), skel('', '4. Lluvia'), stationsCard);
  if (isMobile()) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const key = `${p.lat},${p.lon}`;
  if (!focusCache.has(key)) focusCache.set(key, api(`/api/focus?lat=${p.lat}&lon=${p.lon}`).catch((e) => { focusCache.delete(key); throw e; }));
  focusCache.get(key).then((d) => {
    if (seq !== focusSeq) return;
    renderFocus(p, d.summary, head, stationsCard);
  }).catch((e) => {
    if (seq !== focusSeq) return;
    panel.replaceChildren(head,
      card('fp-full', title('Resumen del área no disponible'), el('p', { class: 'status err' }, e.message),
        el('button', { class: 'btn primary', type: 'button', onclick: () => openFocus(p) }, 'Reintentar')),
      stationsCard);
  });
}

function focusHeader(p) {
  const hh = `${p.time.slice(0, 2)}:${p.time.slice(2)}`;
  return card('fp-full', el('div', { class: 'fhead' },
    el('h3', {}, el('i', { class: 'g ' + (p.sensor === 'MODIS' ? 'ring' : 'dot') }), `Detección ${p.sensor}`),
    el('p', { class: 'facts' },
      el('span', {}, `${ddmm(p.date)} ${hh} UTC`), el('span', {}, `Confianza ${CONF[p.conf]}`),
      el('span', {}, `${fmtN(p.frp, p.frp < 10 ? 1 : 0)} MW`), el('span', {}, p.sat), el('span', {}, `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`)),
    el('button', { class: 'x', type: 'button', 'aria-label': 'Cerrar el análisis del foco', onclick: closeFocus }, '×'),
    el('p', { class: 'fhead-note' }, 'Un foco satelital no confirma un incendio.')));
}

function nearCard(near) {
  return card('', title('Cuarteles cercanos', 'en línea recta'),
    near.length ? el('ul', { class: 'stations' }, near.map((n) => el('li', {}, el('button', {
      type: 'button', onclick: () => { map.setView([n.s.lat, n.s.lon], Math.max(map.getZoom(), 12)); n.s.marker?.openPopup(); if (isMobile()) $('#map').scrollIntoView({ behavior: 'smooth', block: 'center' }); },
    }, el('img', { src: STATION_ICON, alt: '' }), el('span', {}, el('span', { class: 'name' }, stationName(n.s)), el('small', {}, `${n.s.d}, ${n.s.p}`)),
      el('span', { class: 'km' }, `${fmtKm(n.km)} km`)))))
      : el('p', { class: 'fp-empty' }, 'No se pudo cargar la lista de cuarteles.'),
    el('p', { class: 'fp-sub' }, 'Emergencias: 911 / Bomberos 132.'));
}

const LEVEL_COLOR = { bajo: '#34d399', moderado: '#f5a524', alto: '#ff6b2c', 'muy alto': '#ff3b2f' };
function gaugeCard(s) {
  const R = 80, C = 2 * Math.PI * R, score = s.score ?? 0;
  const arc = svg('circle', { class: 'arc', cx: 100, cy: 100, r: R, fill: 'none', stroke: 'url(#gGrad)', 'stroke-width': 22, 'stroke-linecap': 'round', 'stroke-dasharray': C, 'stroke-dashoffset': C * (1 - score / 100), transform: 'rotate(-90 100 100)', filter: 'url(#gGlow)', style: `--from:${C}` });
  const g = svg('svg', { viewBox: '0 0 200 200', role: 'img', 'aria-label': s.score == null ? 'Sin datos suficientes' : `Puntaje de propagación ${s.score} de 100, ${s.level}` },
    svg('defs', {},
      svg('linearGradient', { id: 'gGrad', x1: 0, y1: 0, x2: 0, y2: 1 }, svg('stop', { offset: 0, 'stop-color': '#ff9a2e' }), svg('stop', { offset: 1, 'stop-color': '#ff3b2f' })),
      svg('filter', { id: 'gGlow', x: '-30%', y: '-30%', width: '160%', height: '160%' }, svg('feGaussianBlur', { stdDeviation: 4, result: 'b' }), svg('feMerge', {}, svg('feMergeNode', { in: 'b' }), svg('feMergeNode', { in: 'SourceGraphic' })))),
    svg('circle', { cx: 100, cy: 100, r: R, fill: 'none', stroke: '#4a0f17', 'stroke-width': 22 }),
    s.score != null ? arc : null,
    svg('text', { class: 'num', x: 100, y: 112, 'text-anchor': 'middle' }, s.score == null ? '—' : String(s.score)),
    svg('text', { class: 'lvl', x: 100, y: 142, 'text-anchor': 'middle', fill: LEVEL_COLOR[s.level] || '#9cb3bf' }, s.level ? s.level.toUpperCase() : 'SIN DATOS'));
  return el('div', { class: 'card fp-card fp-tall gauge' },
    el('div', {}, el('h4', {}, 'Puntaje de Propagación'), g,
      el('p', { class: 'meta' }, s.score == null ? 'No hay datos suficientes.' : `${s.factorsUsed} de 8 factores · estimación orientativa`)));
}

function windCard(w) {
  if (!w) return card('', title('1. Viento'), el('p', { class: 'fp-empty' }, 'Sin dato de viento para este punto.'));
  const toward = (w.fromDeg + 180) % 360;
  const ticks = [];
  for (let a = 0; a < 360; a += 30) {
    const r1 = a % 90 ? 58 : 54, x1 = 80 + r1 * Math.sin(rad(a)), y1 = 80 - r1 * Math.cos(rad(a)), x2 = 80 + 62 * Math.sin(rad(a)), y2 = 80 - 62 * Math.cos(rad(a));
    ticks.push(svg('line', { x1, y1, x2, y2, stroke: '#2a5a70', 'stroke-width': 1.5 }));
  }
  const needle = svg('g', { class: 'needle', style: `--rot:${toward}deg; transform: rotate(${toward}deg)` },
    svg('path', { d: 'M80 30 L99 100 L80 86 L61 100 Z', fill: 'rgba(34,211,238,0.12)', stroke: '#22d3ee', 'stroke-width': 3, 'stroke-linejoin': 'round', filter: 'url(#cGlow)' }));
  const old = daysAgo(w.date) > 7;
  return card('', title('1. Viento', w.date ? `dato del ${ddmm(w.date)}` : null),
    el('div', { class: 'compass' }, svg('svg', { viewBox: '0 0 160 160', role: 'img', 'aria-label': `Viento de ${w.kmh} km/h, sopla del ${w.from} hacia el ${w.toward || ''}` },
      svg('defs', {}, svg('filter', { id: 'cGlow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, svg('feGaussianBlur', { stdDeviation: 2.5, result: 'b' }), svg('feMerge', {}, svg('feMergeNode', { in: 'b' }), svg('feMergeNode', { in: 'SourceGraphic' })))),
      svg('circle', { cx: 80, cy: 80, r: 70, fill: 'none', stroke: '#22d3ee', 'stroke-width': 4, 'stroke-dasharray': '300 140', transform: 'rotate(-60 80 80)', filter: 'url(#cGlow)' }),
      svg('circle', { cx: 80, cy: 80, r: 62, fill: 'rgba(6,16,25,0.6)', stroke: '#1b3546', 'stroke-width': 1 }),
      ticks,
      svg('path', { d: 'M80 4 L86 14 L74 14 Z', fill: '#22d3ee' }),
      svg('text', { x: 80, y: 32, 'text-anchor': 'middle' }, 'N'), svg('text', { x: 130, y: 84, 'text-anchor': 'middle' }, 'E'),
      svg('text', { x: 80, y: 136, 'text-anchor': 'middle' }, 'S'), svg('text', { x: 30, y: 84, 'text-anchor': 'middle' }, 'O'),
      needle)),
    el('p', { class: 'big-line' }, `${fmtN(w.kmh)} km/h${w.toward ? ', hacia el ' + w.toward : ''}`),
    el('p', { class: 'fp-sub' }, `Sopla del ${w.from} (${fmtN(w.fromDeg)}°).` + (old ? ' Es el último dato disponible; no se usa en el puntaje.' : '')));
}

function airCard(a) {
  if (!a || a.tC == null) return card('', title('2. Aire'), el('p', { class: 'fp-empty' }, 'Sin dato de temperatura del aire.'));
  const f = Math.max(0, Math.min(1, (a.tC + 5) / 50)), tubeTop = 8, tubeH = 84, h = tubeH * f;
  const thermo = svg('svg', { class: 'thermo', viewBox: '0 0 40 124', 'aria-hidden': 'true' },
    svg('defs', {}, svg('linearGradient', { id: 'tGrad', x1: 0, y1: 1, x2: 0, y2: 0 }, svg('stop', { offset: 0, 'stop-color': '#ff3b2f' }), svg('stop', { offset: 1, 'stop-color': '#ff9a2e' }))),
    svg('rect', { x: 13, y: tubeTop - 2, width: 14, height: tubeH + 12, rx: 7, fill: 'rgba(6,16,25,0.6)', stroke: '#9cb3bf', 'stroke-width': 1.5 }),
    svg('rect', { x: 17, y: tubeTop + tubeH - h, width: 6, height: h + 8, rx: 3, fill: 'url(#tGrad)' }),
    svg('circle', { cx: 20, cy: 106, r: 13, fill: 'rgba(6,16,25,0.6)', stroke: '#9cb3bf', 'stroke-width': 1.5 }),
    svg('circle', { cx: 20, cy: 106, r: 9, fill: '#ff3b2f', style: 'filter: drop-shadow(0 0 6px #ff3b2f)' }));
  let rhSvg = null;
  if (a.rh != null) {
    const R = 46, C = 2 * Math.PI * R, span = 0.75 * C, dry = a.rh < 30;
    const arc = svg('circle', { class: 'rh-arc', cx: 60, cy: 60, r: R, fill: 'none', stroke: dry ? '#ff6b2c' : '#22d3ee', 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-dasharray': `${span * (a.rh / 100)} ${C}`, transform: 'rotate(135 60 60)', style: `--c:${C}px; filter: drop-shadow(0 0 6px ${dry ? '#ff6b2c' : '#22d3ee'})` });
    rhSvg = svg('svg', { class: 'rh', viewBox: '0 0 120 120', role: 'img', 'aria-label': `Humedad relativa ${Math.round(a.rh)} %` },
      svg('circle', { cx: 60, cy: 60, r: R, fill: 'none', stroke: '#1b3546', 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-dasharray': `${span} ${C}`, transform: 'rotate(135 60 60)' }),
      arc,
      svg('text', { class: 'rh-num', x: 60, y: 64, 'text-anchor': 'middle' }, `${Math.round(a.rh)}%`),
      svg('text', { class: 'rh-lbl', x: 60, y: 84, 'text-anchor': 'middle' }, 'HR'));
  }
  const msg = a.rh == null ? '' : a.rh < 30 ? 'Aire muy seco: favorece el fuego.' : a.rh >= 60 ? 'Aire húmedo: frena el fuego.' : 'Humedad intermedia.';
  return card('', title('2. Aire', a.date ? `dato del ${ddmm(a.date)}` : null),
    el('div', { class: 'air' }, el('div', { style: 'display:flex;align-items:center;gap:8px' }, thermo, el('span', { class: 'temp-val' }, `${fmtN(a.tC, 1)}°C`)), rhSvg),
    msg ? el('p', { class: 'fp-sub' }, msg) : null);
}

function soilCard(so, terrain) {
  if (!so) return card('', title('3. Suelo'), el('p', { class: 'fp-empty' }, 'Sin dato de humedad del suelo.'));
  const bar = (label, v) => {
    const i = el('i', { class: v != null && v < 15 ? 'dry' : 'wet', style: v != null ? `width:${Math.min(100, (v / 50) * 100)}%` : null });
    return el('div', { class: 'bar-row' }, el('div', { class: 'lbl' }, el('span', {}, label), el('b', {}, v == null ? 'sin dato' : `${fmtN(v)} %`)), el('div', { class: 'track' }, i));
  };
  const rel = so.rel ? so.rel[0].toUpperCase() + so.rel.slice(1) : null;
  return card('', title('3. Suelo', so.date ? `dato del ${ddmm(so.date)}` : null),
    bar('Superficial (0-5 cm)', so.surface), bar('Raíces (0-100 cm)', so.root), el('div', { class: 'soil-strata', 'aria-hidden': 'true' }),
    el('p', { class: 'fp-sub' }, [rel ? `${rel}${so.pctl != null ? ` (percentil ${fmtN(so.pctl)})` : ''}.` : null, terrain && terrain.texture ? ` Suelo ${terrain.texture}.` : null].filter(Boolean).join('') || 'Humedad en % del volumen del suelo.'));
}

function rainCard(r) {
  if (!r || (r.mm7 == null && r.mm30 == null)) return card('', title('4. Lluvia'), el('p', { class: 'fp-empty' }, 'Sin datos de lluvia.'));
  const bars = [
    { label: '7 días', v: r.mm7, color: '#22d3ee', date: r.date7 },
    { label: '30 días', v: r.mm30, color: '#14b8a6', date: r.date30 },
  ];
  const W = 240, H = 140, base = 112, top = 16;
  const max = Math.max(10, ...bars.map((b) => b.v || 0)) * 1.15;
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Lluvia: ${fmtN(r.mm7, 1)} mm en 7 días y ${fmtN(r.mm30)} mm en 30 días` });
  for (let i = 0; i <= 3; i++) { const y = base - ((base - top) * i) / 3; g.append(svg('line', { class: 'gridl', x1: 28, x2: W - 4, y1: y, y2: y }), svg('text', { x: 22, y: y + 4, 'text-anchor': 'end' }, String(Math.round((max * i) / 3)))); }
  bars.forEach((b, i) => {
    const x = 58 + i * 100, bw = 54;
    if (b.v == null) { g.append(svg('text', { x: x + bw / 2, y: base - 8, 'text-anchor': 'middle' }, 'sin dato')); }
    else {
      const h = Math.max(2, ((base - top) * b.v) / max);
      const rect = svg('rect', { class: 'bar', x, y: base - h, width: bw, height: h, rx: 4, fill: b.color, style: `filter: drop-shadow(0 0 6px ${b.color}88)` });
      g.append(rect, svg('text', { class: 'val', x: x + bw / 2, y: base - h - 6, 'text-anchor': 'middle' }, `${fmtN(b.v, b.v < 10 ? 1 : 0)} mm`));
    }
    g.append(svg('text', { x: x + bw / 2, y: base + 16, 'text-anchor': 'middle' }, b.label + (b.date ? ` · ${ddmm(b.date).slice(0, 5)}` : '')));
  });
  const lag = r.date30 && daysAgo(r.date30) > 12;
  return card('rain', title('4. Lluvia', 'mm acumulados'), g,
    el('p', { class: 'fp-sub' }, (r.dryDays != null ? `${r.dryDays === 0 ? 'Llovió en el último día con datos' : `${r.dryDays} ${r.dryDays === 1 ? 'día seco' : 'días secos'} seguidos`}. ` : '') +
      '7 días: NASA GPM IMERG. 30 días: CHIRPS' + (lag ? ` (último dato del ${ddmm(r.date30)}).` : '.')));
}

function factorsCard(s) {
  const fs = s.factors || [];
  const li = (f, kind) => el('li', { class: kind }, el('span', { class: 'ico' }, icon(f.key)), FACTOR_TEXT[f.key] ? FACTOR_TEXT[f.key][kind === 'risk' ? 0 : 1] : f.label);
  const risks = fs.filter((f) => f.up).sort((a, b) => b.points / b.max - a.points / a.max);
  const calms = fs.filter((f) => f.down);
  return card('fp-full', el('div', { class: 'factors' },
    el('div', { class: 'fgroup' }, el('h5', {}, 'Factores de riesgo'),
      risks.length ? el('ul', { class: 'ficons' }, risks.map((f) => li(f, 'risk'))) : el('p', { class: 'fp-empty', style: 'text-align:center' }, 'Ningún factor favorece mucho el fuego.')),
    el('div', { class: 'fgroup' }, el('h5', {}, 'Contención'),
      calms.length ? el('ul', { class: 'ficons' }, calms.map((f) => li(f, 'calm'))) : el('p', { class: 'fp-empty', style: 'text-align:center' }, 'Nada lo frena de forma marcada.'))),
    s.windToward ? el('p', { class: 'windline' }, `➜ Si hubiera fuego, el viento lo llevaría hacia el ${s.windToward}.`) : null);
}

function vegCard(v) {
  if (!v) return card('', title('Vegetación'), el('p', { class: 'fp-empty' }, 'Sin imágenes útiles de vegetación.'));
  const kv = (k, val) => (val ? el('div', {}, el('span', {}, k), el('b', {}, val)) : null);
  return card('', title('Vegetación', v.date ? 'Sentinel-2' : null),
    el('div', { class: 'kv' },
      kv('Cobertura', v.cover),
      kv('Verdor (NDVI)', v.ndvi ? `${v.ndvi} · ${v.ndviTxt}` : null),
      kv('Humedad (NDMI)', v.ndmi ? `${v.ndmi} · ${v.ndmiTxt}` : null)));
}

function terrainCard(t) {
  const kv = (k, val) => (val ? el('div', {}, el('span', {}, k), el('b', {}, val)) : null);
  const cls = t.slope == null ? null : t.slope < 5 ? 'plano' : t.slope < 10 ? 'suave' : t.slope < 20 ? 'inclinado' : 'empinado';
  const any = t.slope != null || t.elev != null || t.texture;
  return card('', title('Relieve y suelo'),
    any ? el('div', { class: 'kv' },
      kv('Pendiente', t.slope != null ? `${fmtN(t.slope)}° · ${cls}` : null),
      kv('Altitud', t.elev != null ? `${fmtN(t.elev)} m` : null),
      kv('Textura', t.texture || null)) : el('p', { class: 'fp-empty' }, 'Sin datos de relieve.'),
    t.textureNote ? el('p', { class: 'fp-sub' }, t.textureNote[0].toUpperCase() + t.textureNote.slice(1) + '.') : null,
    t.degraded ? el('p', { class: 'fp-sub' }, t.degraded) : null);
}

function advancedCard(s) {
  return el('details', { class: 'card fp-full advbar' },
    el('summary', {}, el('span', {}, 'Datos avanzados y fuentes (suelo, vegetación, radar)'), el('b', {}, 'Ver más')),
    el('div', { class: 'adv-body' },
      el('h5', {}, 'Conclusión'), el('p', {}, s.conclusion),
      el('h5', {}, 'Resumen en palabras'),
      ...s.items.map((i) => el('div', { class: 'dato' }, el('b', {}, i.label), el('span', {}, i.text))),
      el('h5', {}, 'Datos por fuente'),
      ...s.rows.map((r) => el('div', { class: 'src-row' }, el('b', {}, r.label), el('span', {}, r.value), el('small', {}, [r.date ? 'Fecha: ' + r.date : null, r.source].filter(Boolean).join(' · ')))),
      el('p', { class: 'fine' }, s.notes.join(' '))));
}

function renderFocus(p, s, head, stationsCard) {
  const m = metricsOf(s);
  panel.replaceChildren(
    head,
    gaugeCard(s),
    windCard(m.wind),
    airCard(m.air),
    soilCard(m.soil, m.terrain),
    rainCard(m.rain),
    factorsCard(s),
    vegCard(m.veg),
    terrainCard(m.terrain),
    stationsCard,
    advancedCard(s));
}

// ---------- Gráfico de comparación (SVG propio, sin librerías) ----------
function niceMax(m) {
  const p = 10 ** Math.floor(Math.log10(m));
  for (const k of [1, 2, 4, 5, 8, 10]) if (k * p >= m) return k * p;
  return 10 * p;
}
function groupedBars(rows, series, label) {
  const W = 760, H = 264, M = { l: 44, r: 8, t: 12, b: 30 };
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const max = niceMax(Math.max(1, ...rows.flatMap((r) => series.map((s) => r[s.key] ?? 0))));
  const band = iw / rows.length, pad = band * 0.18, bw = (band - pad * 2) / series.length;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label, class: 'chart' });
  for (let i = 0; i <= 4; i++) {
    const y = M.t + ih - (ih * i) / 4;
    root.append(svg('line', { class: 'grid', x1: M.l, x2: W - M.r, y1: y, y2: y }),
      svg('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end' }, String(Math.round((max * i) / 4))));
  }
  rows.forEach((r, i) => {
    const x0 = M.l + i * band;
    series.forEach((s, j) => {
      const v = r[s.key];
      if (v == null) return;
      const h = (ih * v) / max;
      root.append(svg('rect', { class: 'bar', x: x0 + pad + j * bw, y: M.t + ih - h, width: Math.max(1, bw - 3), height: h, rx: 3, style: `fill:${s.color}` },
        svg('title', {}, `${shortDate(r.date)}: ${s.label} ${v}`)));
    });
    root.append(svg('text', { x: x0 + band / 2, y: H - 10, 'text-anchor': 'middle' }, shortDate(r.date)));
  });
  return root;
}

// ---------- Calendario mensual (casillas por día, semanas de lunes a domingo) ----------
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const toUTC = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const isoDay = (dt) => dt.toISOString().slice(0, 10);
const mondayIndex = (dt) => (dt.getUTCDay() + 6) % 7;
let calDays = [], calSelected = null;

function heatLevel(v, max) {
  if (!v) return 0;
  const f = v / max;
  return f > 0.75 ? 4 : f > 0.5 ? 3 : f > 0.25 ? 2 : 1;
}
function monthTitle(first, last) {
  const m1 = first.getUTCMonth(), m2 = last.getUTCMonth(), y1 = first.getUTCFullYear(), y2 = last.getUTCFullYear();
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  if (m1 === m2 && y1 === y2) return `${cap(MESES_LARGOS[m1])} ${y1}`;
  if (y1 === y2) return `${cap(MESES_LARGOS[m1])} – ${MESES_LARGOS[m2]} ${y2}`;
  return `${cap(MESES_LARGOS[m1])} ${y1} – ${MESES_LARGOS[m2]} ${y2}`;
}

function renderMonthGrid(cal) {
  calDays = cal;
  const byDate = new Map(cal.map((c) => [c.date, c]));
  if (!calSelected || !byDate.has(calSelected)) calSelected = cal[cal.length - 1].date;
  const max = Math.max(1, ...cal.map((c) => c.unified));
  const first = toUTC(cal[0].date), last = toUTC(cal[cal.length - 1].date);
  const todayUTC = isoDay(new Date());
  $('#calMonth').textContent = monthTitle(first, last);

  const start = new Date(first); start.setUTCDate(start.getUTCDate() - mondayIndex(first));
  const end = new Date(last); end.setUTCDate(end.getUTCDate() + 6 - mondayIndex(last));
  const cells = DIAS_CORTOS.map((d) => el('div', { class: 'cal-wd', 'aria-hidden': 'true' }, d));
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = isoDay(d), c = byDate.get(key), n = d.getUTCDate();
    const label = (n === 1 || key === cal[0].date) ? `${n} ${MESES[d.getUTCMonth()]}` : String(n);
    if (!c) { cells.push(el('div', { class: 'cal-day out', 'aria-hidden': 'true' }, el('span', { class: 'dnum' }, label))); continue; }
    const lvl = heatLevel(c.unified, max);
    const isToday = key === todayUTC;
    cells.push(el('button', {
      type: 'button', class: `cal-day lv${lvl}${key === calSelected ? ' sel' : ''}`, 'data-date': key,
      'aria-pressed': String(key === calSelected),
      'aria-label': `${DIAS_LARGOS[d.getUTCDay()]} ${n} de ${MESES_LARGOS[d.getUTCMonth()]}: ${c.unified} zonas con fuego. MODIS ${c.modis}, VIIRS ${c.viirs}.${isToday ? ' Hoy, datos parciales.' : ''}`,
      onclick: () => selectCalDay(key),
    },
      el('span', { class: 'dnum' }, label, isToday ? el('em', { class: 'today' }, 'hoy') : null),
      el('b', { class: 'count' }, fmtN(c.unified)),
      el('span', { class: 'unit' }, c.unified === 1 ? 'zona' : 'zonas'),
      el('span', { class: 'sens' },
        el('span', {}, el('i', { class: 'g ring' }), fmtN(c.modis)),
        el('span', {}, el('i', { class: 'g dot' }), fmtN(c.viirs)))));
  }
  $('#calGrid').replaceChildren(...cells);
  renderCalDetail();
}

function selectCalDay(key) {
  calSelected = key;
  document.querySelectorAll('#calGrid .cal-day[data-date]').forEach((b) => {
    const on = b.dataset.date === key;
    b.classList.toggle('sel', on);
    b.setAttribute('aria-pressed', String(on));
  });
  renderCalDetail();
}

function renderCalDetail() {
  const c = calDays.find((x) => x.date === calSelected);
  if (!c) return $('#calDetail').replaceChildren();
  const d = toUTC(c.date);
  const isToday = c.date === isoDay(new Date());
  let compare;
  if (c.baseline == null) compare = 'No hay datos de años anteriores para comparar este día.';
  else if (c.baseline === 0) compare = c.comparable > 0 ? 'En esta fecha de años anteriores casi no hubo actividad.' : 'Igual que en años anteriores: sin actividad en esta fecha.';
  else if (c.ratio >= 1.5) compare = `Más que lo habitual: unas ${(Math.round(c.ratio * 10) / 10).toLocaleString('es-PY')} veces lo que se vio en esta fecha en años anteriores.`;
  else if (c.ratio <= 0.67) compare = 'Menos que lo habitual para esta fecha en años anteriores.';
  else compare = 'Parecido a lo habitual para esta fecha en años anteriores.';
  const stat = (label, value, glyph) => el('div', { class: 'stat' }, el('span', {}, glyph, label), el('b', {}, value));
  $('#calDetail').replaceChildren(
    el('div', { class: 'cd-head' },
      el('h4', {}, `${DIAS_LARGOS[d.getUTCDay()][0].toUpperCase()}${DIAS_LARGOS[d.getUTCDay()].slice(1)} ${d.getUTCDate()} de ${MESES_LARGOS[d.getUTCMonth()]}`),
      el('p', { class: 'cd-big' }, el('b', {}, fmtN(c.unified)), c.unified === 1 ? ' zona con fuego detectado' : ' zonas con fuego detectado'),
      isToday ? el('p', { class: 'cd-note' }, 'Hoy: el día todavía no terminó y faltan pasadas de satélite.') : null),
    el('div', { class: 'cd-stats' },
      stat('MODIS', fmtN(c.modis), el('i', { class: 'g ring' })),
      stat('VIIRS', fmtN(c.viirs), el('i', { class: 'g dot' })),
      stat('Vistas por ambos', fmtN(c.both)),
      stat('Confianza alta', fmtN(c.high)),
      stat('Potencia', `${fmtN(Math.round(c.frp))} MW`)),
    el('p', { class: 'cd-compare' }, compare));
}

// ---------- Calendario: carga ----------
async function loadCalendar() {
  setStatus($('#calStatus'), 'Uniendo MODIS y VIIRS y comparando con años anteriores. Puede tardar unos segundos.', 'loading');
  try {
    const d = await api('/api/analysis?days=' + radio('calDays'));
    calLoaded = true;
    const failed = d.sourcesFailed.length ? ` Sin respuesta de: ${d.sourcesFailed.join(', ')}.` : '';
    const years = d.method.baselineYears.length ? d.method.baselineYears.join(' y ') : 'sin datos disponibles';
    setStatus($('#calStatus'), `Del ${d.start} al ${d.end} (UTC). Años de comparación: ${years}.${failed}`);
    renderCalendar(d);
  } catch (e) {
    setStatus($('#calStatus'), 'No se pudo cargar el análisis: ' + e.message + ' Probá de nuevo con Actualizar.', 'err');
  }
}
function renderCalendar(d) {
  renderMonthGrid(d.calendar);

  const hasBase = d.calendar.some((c) => c.baseline != null);
  $('#chartBase').replaceChildren(hasBase
    ? groupedBars(d.calendar, [
        { key: 'comparable', label: 'Este año', color: COLOR.uni },
        { key: 'baseline', label: 'Promedio histórico', color: COLOR.hist },
      ], 'Zonas con actividad este año frente al promedio histórico')
    : el('p', { class: 'empty' }, 'No hay archivo histórico disponible para estas fechas, así que no se puede comparar con años anteriores.'));

  $('#zones').replaceChildren(...(d.topZones.length ? d.topZones.map((z) =>
    el('li', {},
      el('div', {}, el('b', {}, `${z.n} detecciones`), el('div', { class: 'meta' }, `Cuadrante ${z.lat.toFixed(1)}°, ${z.lon.toFixed(1)}° (0,5° de lado), potencia total ${z.frp} MW`)),
      el('button', { class: 'btn', onclick: () => { showTab('mapa'); map.setView([z.lat + 0.25, z.lon + 0.25], 9); } }, 'Ver en el mapa')))
    : [el('li', {}, el('span', { class: 'meta' }, 'No hubo detecciones en esta ventana.'))]));

  $('#method').replaceChildren(...Object.values(d.method).filter((v) => typeof v === 'string').map((t) => el('p', {}, t)));

  const head = ['Fecha', 'MODIS', 'VIIRS', 'Zonas únicas', 'En ambos', 'Confianza alta', 'Potencia (MW)', 'Histórico', 'Razón', 'Puntaje z'];
  $('#calTable').replaceChildren(
    el('tr', {}, head.map((h) => el('th', {}, h))),
    ...d.calendar.map((c) => el('tr', {}, [c.date, c.modis, c.viirs, c.unified, c.both, c.high, c.frp,
      c.baseline ?? '—', c.ratio ?? '—', c.z].map((v) => el('td', {}, v)))));
}
$('#btnCal').addEventListener('click', loadCalendar);
document.querySelectorAll('input[name="calDays"]').forEach((i) => i.addEventListener('change', loadCalendar));

// ---------- Reportar ----------
const pickMap = L.map('pickmap').fitBounds(PY_BOUNDS);
dark().addTo(pickMap);
let pickMarker = null, picked = null;
function setPick(lat, lon) {
  picked = { lat, lon };
  if (pickMarker) pickMarker.setLatLng([lat, lon]); else pickMarker = L.marker([lat, lon]).addTo(pickMap);
  setStatus($('#pickCoords'), `Ubicación marcada: ${lat.toFixed(5)}, ${lon.toFixed(5)}`, 'ok');
}
pickMap.on('click', (e) => setPick(e.latlng.lat, e.latlng.lng));
$('#btnPickLoc').addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Tu navegador no permite usar la ubicación.');
  navigator.geolocation.getCurrentPosition((p) => { setPick(p.coords.latitude, p.coords.longitude); pickMap.setView([p.coords.latitude, p.coords.longitude], 13); }, () => alert('No se pudo obtener tu ubicación. Revisá el permiso del navegador.'));
});
$('#repForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!picked) return setStatus($('#repMsg'), 'Marcá primero el lugar en el mapa.', 'err');
  if ($('#repDesc').value.trim().length < 10) return setStatus($('#repMsg'), 'Contá qué viste, con al menos 10 caracteres.', 'err');
  const btn = e.submitter || $('#repForm button[type=submit]');
  btn.disabled = true;
  try {
    const r = await api('/api/reports', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...picked, description: $('#repDesc').value, name: $('#repName').value, contact: $('#repContact').value }),
    });
    setStatus($('#repMsg'), `Reporte enviado con el código ${r.id}. Queda pendiente hasta que Bomberos lo revise. Si hay peligro, llamá al 911 o al 132.`, 'ok');
    $('#repForm').reset();
    setStatus($('#pickCoords'), 'Ubicación sin marcar.');
    picked = null;
    if (pickMarker) { pickMap.removeLayer(pickMarker); pickMarker = null; }
    loadPublicReports();
  } catch (err) { setStatus($('#repMsg'), err.message, 'err'); }
  finally { btn.disabled = false; }
});

// ---------- Bomberos ----------
let token = '';
try { token = sessionStorage.getItem('fgtoken') || ''; } catch { /* sin almacenamiento */ }
const saveToken = (t) => { try { t ? sessionStorage.setItem('fgtoken', t) : sessionStorage.removeItem('fgtoken'); } catch { /* sin almacenamiento */ } };
const adminApi = (url, opts = {}) => api(url, { ...opts, headers: { 'x-admin-token': token, 'content-type': 'application/json' } });
$('#btnLogin').addEventListener('click', async () => {
  token = $('#tokenInput').value.trim();
  try {
    await adminApi('/api/admin/reports');
    saveToken(token);
    $('#tokenInput').value = '';
    setStatus($('#loginMsg'), '');
    loadAdmin();
  } catch (e) { token = ''; setStatus($('#loginMsg'), e.message, 'err'); }
});
$('#tokenInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btnLogin').click(); });
$('#btnLogout').addEventListener('click', () => { token = ''; saveToken(''); $('#adminBox').hidden = true; $('#loginBox').hidden = false; });
$('#btnAdminReload').addEventListener('click', loadAdmin);

async function loadAdmin() {
  try {
    const [reps, alerts] = await Promise.all([adminApi('/api/admin/reports'), adminApi('/api/admin/alerts').catch(() => null)]);
    $('#loginBox').hidden = true; $('#adminBox').hidden = false;
    $('#alerts').replaceChildren(...(alerts === null
      ? [el('p', { class: 'note' }, 'No se pudieron calcular las alertas. Puede que NASA FIRMS no haya respondido.')]
      : alerts.length ? alerts.map((a) => el('div', { class: 'item alert' },
          el('div', { class: 'top' }, el('b', {}, `Reporte ${a.reportId}`)),
          `A ${a.nearest.km} km de una detección ${a.nearest.sensor} (confianza ${CONF[a.nearest.conf]}, ${a.nearest.date} ${a.nearest.time.slice(0, 2)}:${a.nearest.time.slice(2)} UTC).`,
          el('div', {}, a.description)))
      : [el('p', { class: 'note' }, 'Ningún reporte abierto coincide con una detección cercana por ahora.')]));
    $('#adminReports').replaceChildren(...(reps.length ? reps.map(renderAdminReport) : [el('p', { class: 'note' }, 'Todavía no hay reportes.')]));
  } catch (e) {
    $('#loginBox').hidden = false; $('#adminBox').hidden = true;
    setStatus($('#loginMsg'), e.message, 'err');
  }
}
function renderAdminReport(r) {
  const note = el('input', { type: 'text', placeholder: 'Nota (opcional)', maxlength: '300', 'aria-label': 'Nota para el historial' });
  const sel = el('select', { 'aria-label': 'Estado del reporte' }, ['pendiente', 'verificado', 'atendido', 'descartado'].map((s) => el('option', s === r.status ? { value: s, selected: '' } : { value: s }, s)));
  const save = el('button', { class: 'btn primary', onclick: async () => {
    try { await adminApi('/api/admin/reports/' + r.id, { method: 'PATCH', body: JSON.stringify({ status: sel.value, note: note.value }) }); loadAdmin(); loadPublicReports(); }
    catch (e) { alert(e.message); }
  } }, 'Guardar');
  const n = nearestStations(r.lat, r.lon, 1)[0];
  return el('div', { class: 'item ' + r.status },
    el('div', { class: 'top' }, el('b', {}, `Reporte ${r.id}`), el('span', { class: 'pill ' + r.status }, r.status), el('small', {}, fmtDateTime(r.createdAt))),
    el('div', {}, r.description),
    el('small', {}, `Ubicación ${r.lat}, ${r.lon}` + (r.name ? `. Nombre: ${r.name}` : '') + (r.contact ? `. Contacto: ${r.contact}` : '') + (n ? `. Cuartel más cercano: ${stationName(n.s)}, a ${fmtKm(n.km)} km.` : '')),
    el('div', { class: 'controls' }, sel, note, save,
      el('button', { class: 'btn', onclick: () => { showTab('mapa'); map.setView([r.lat, r.lon], 13); } }, 'Ver en el mapa')),
    el('ul', { class: 'hist' }, r.history.map((h) => el('li', {}, `${fmtDateTime(h.at)}: ${h.status}${h.note ? '. ' + h.note : ''}`))));
}

// ---------- Inicio ----------
renderOverview();
loadFires();
loadPublicReports();
loadStations();
