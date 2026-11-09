// FIREGUARD - interfaz. Todo el texto de datos se inserta con textContent (sin innerHTML) para evitar XSS.
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;// FIREGUARD - interfaz. Todo el texto de datos se inserta con textContent (sin innerHTML) para evitar XSS.
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
};
const svg = (tag, props = {}, ...kids) => {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(props)) e.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
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
const COLOR = { modis: '#c77700', viirs: '#c2271f', uni: '#1b3a57', hist: '#a7b4ae', rep: '#6b46c1' };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const STATION_ICON = 'img/cuartel.png';
const shortDate = (s) => { const [, m, d] = s.split('-'); return `${Number(d)} ${MESES[Number(m) - 1]}`; };
const fmtDateTime = (iso) => new Date(iso).toLocaleString('es-PY');

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
const osm = () => L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors', className: 'tiles-soft' });
const esri = () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Imágenes © Esri' });
const map = L.map('map', { preferCanvas: true }).fitBounds(PY_BOUNDS);
const base = osm().addTo(map);
L.control.layers({ Calles: base, Satélite: esri() }).addTo(map);
const fireLayer = L.layerGroup().addTo(map);
const reportLayer = L.layerGroup().addTo(map);
const stationLayer = L.layerGroup().addTo(map);
let stations = [];
let fires = [];

// Leyenda dentro del mapa: anillo = MODIS, punto = VIIRS, tamaño = potencia
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
function nearestStation(lat, lon) {
  let best = null;
  for (const s of stations) {
    const km = kmBetween(lat, lon, s.lat, s.lon);
    if (!best || km < best.km) best = { s, km };
  }
  return best;
}
const stationName = (s) => `${s.t} de ${s.d}`;
async function loadStations() {
  try {
    stations = await api('/bomberos.json');
    for (const s of stations) {
      L.marker([s.lat, s.lon], {
        icon: L.icon({ iconUrl: STATION_ICON, className: 'stn-pin', iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] }),
        zIndexOffset: -500, title: stationName(s),
      }).bindPopup(el('div', {}, el('b', {}, 'Cuartel de bomberos'), el('br'), stationName(s), el('br'),
        el('small', {}, `${s.b ? s.b + ', ' : ''}${s.d} (${s.p}). Emergencias: 911 / Bomberos 132.`))).addTo(stationLayer);
    }
  } catch { /* sin cuarteles */ }
}
$('#fStations').addEventListener('change', (e) => { e.target.checked ? map.addLayer(stationLayer) : map.removeLayer(stationLayer); });

// ---------- Resumen del área de un foco (se pide al abrirlo) ----------
const isMobile = () => window.matchMedia('(max-width: 820px)').matches;
const sheet = el('aside', { class: 'sheet', hidden: '', 'aria-label': 'Detalle del foco' });
$('.mapbox').append(sheet);
function closeSheet() { sheet.hidden = true; sheet.replaceChildren(); $('.mapbox').classList.remove('sheet-open'); }
map.on('click', () => { if (!sheet.hidden) closeSheet(); });

async function loadEnv(box, lat, lon, popup) {
  if (box.dataset.state === 'loading' || box.dataset.state === 'done') return;
  box.dataset.state = 'loading';
  box.replaceChildren(el('p', { class: 'status loading' }, 'Analizando el área con datos de NASA, Copernicus y ECMWF. Puede tardar hasta un minuto.'));
  popup.update();
  try {
    const d = await api(`/api/focus?lat=${lat}&lon=${lon}`);
    renderEnv(box, d.summary);
    box.dataset.state = 'done';
  } catch (e) {
    box.dataset.state = 'error';
    box.replaceChildren(
      el('p', { class: 'status err' }, 'Resumen del área no disponible. ' + e.message),
      el('button', { class: 'btn', type: 'button', onclick: () => { box.dataset.state = ''; loadEnv(box, lat, lon, popup); } }, 'Reintentar'));
  }
  popup.update();
}
function renderEnv(box, s) {
  const lvl = s.level ? 'lvl-' + s.level.replace(' ', '-') : 'lvl-nd';
  const facs = (s.factors || []).filter((f) => f.key !== 'combustible');
  // Lo más importante: primero lo que favorece el fuego (rojo), luego lo que lo frena (verde)
  const risks = facs.filter((f) => f.up).sort((a, b) => b.points / b.max - a.points / a.max);
  const calms = facs.filter((f) => f.down);
  const chip = (f, kind) => el('li', { class: 'tag ' + kind }, el('span', { class: 'arr', 'aria-hidden': 'true' }, kind === 'risk' ? '▲' : '▼'), f.label);
  const bar = el('i', { class: lvl });
  const top = [
    el('div', { class: 'lvl ' + lvl },
      el('b', {}, s.level ? `Potencial de propagación: ${s.level}` : 'Sin datos suficientes'),
      s.level ? el('span', {}, `${s.score}/100`) : null),
    s.level ? el('div', { class: 'meter', role: 'img', 'aria-label': `Potencial ${s.score} de 100` }, bar) : null,
  ];
  const flags = (risks.length || calms.length) ? el('div', { class: 'flags' },
    risks.length ? el('p', { class: 'flag-title' }, 'Lo que favorece el fuego') : null,
    risks.length ? el('ul', { class: 'tags' }, risks.map((f) => chip(f, 'risk'))) : null,
    calms.length ? el('p', { class: 'flag-title' }, 'Lo que lo frena') : null,
    calms.length ? el('ul', { class: 'tags' }, calms.map((f) => chip(f, 'calm'))) : null) : null;
  const wind = s.windToward ? el('p', { class: 'windline' }, el('span', { 'aria-hidden': 'true' }, '➜ '), `Si hubiera fuego, el viento lo llevaría hacia el ${s.windToward}.`) : null;
  const KEYS = { 'Viento': ['viento'], 'Aire': ['aire', 'temp'], 'Suelo (humedad)': ['suelo'], 'Lluvia': ['lluvia'], 'Vegetación': ['veg', 'combustible'], 'Relieve': ['pendiente'] };
  const toneOf = (label) => {
    const fs = facs.filter((f) => (KEYS[label] || []).includes(f.key));
    if (!fs.length) return 'info';
    if (fs.some((f) => f.up)) return 'risk';
    if (fs.every((f) => f.down)) return 'calm';
    return 'mid';
  };
  const datos = el('div', { class: 'datos' },
    el('p', { class: 'flag-title' }, 'Datos del área'),
    ...s.items.map((i) => el('div', { class: 'dato ' + toneOf(i.label) }, el('b', {}, i.label), el('span', {}, i.text))));
  const detail = el('details', { class: 'more' }, el('summary', {}, 'Fuentes, fechas y notas'),
    el('p', { class: 'concl' }, s.conclusion),
    el('div', { class: 'srcs' },
      ...s.rows.map((r) => el('div', { class: 'src-row' },
        el('b', {}, r.label), el('span', {}, r.value),
        r.date ? el('small', {}, 'Fecha: ' + r.date) : null,
        el('small', {}, 'Fuente: ' + r.source)))),
    el('p', { class: 'fine' }, s.notes.join(' ')));
  detail.addEventListener('toggle', () => requestAnimationFrame(() => box.dispatchEvent(new Event('resized'))));
  box.replaceChildren(...top, flags, wind, datos, detail);
  requestAnimationFrame(() => { bar.style.width = (s.score || 0) + '%'; });
}

async function loadFires() {
  setStatus($('#mapStatus'), 'Consultando NASA FIRMS…', 'loading');
  try {
    const d = await api('/api/fires?days=' + radio('days'));
    fires = d.points;
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
  let shown = 0;
  for (const [lat, lon, date, time, sensor, sat, conf, frp] of fires) {
    if ((sensor === 'MODIS' && !m) || (sensor === 'VIIRS' && !v) || (hi && conf !== 'high')) continue;
    shown++;
    const r = Math.min(9, 3 + Math.sqrt(frp) / 2);
    const mk = sensor === 'MODIS'
      ? L.circleMarker([lat, lon], { radius: r + 1.5, color: COLOR.modis, weight: 2, fillColor: COLOR.modis, fillOpacity: 0.1 })
      : L.circleMarker([lat, lon], { radius: r, color: COLOR.viirs, weight: 1, fillColor: COLOR.viirs, fillOpacity: 0.6 });
    const hh = `${time.slice(0, 2)}:${time.slice(2)}`;
    mk.on('click', (ev) => {
      L.DomEvent.stopPropagation(ev);
      const env = el('div', { class: 'env' });
      const node = el('div', { class: 'focus' },
        el('div', { class: 'focus-head' },
          el('b', {}, `Detección térmica ${sensor}`),
          isMobile() ? el('button', { class: 'sheet-x', type: 'button', 'aria-label': 'Cerrar', onclick: closeSheet }, '×') : null),
        el('p', { class: 'facts' },
          el('span', {}, `${date} ${hh} UTC`), el('span', {}, `Confianza ${CONF[conf]}`),
          el('span', {}, `${frp} MW`), el('span', {}, sat)),
        el('small', {}, 'Un foco satelital no confirma un incendio.'),
        (() => {
          const n = nearestStation(lat, lon);
          return n ? el('p', { class: 'near' }, el('b', {}, 'Cuartel más cercano: '), `${stationName(n.s)}, a ${n.km < 10 ? n.km.toFixed(1).replace('.', ',') : Math.round(n.km)} km en línea recta.`) : null;
        })(),
        env);
      if (isMobile()) {
        map.closePopup();
        sheet.replaceChildren(node); sheet.hidden = false; sheet.scrollTop = 0;
        $('.mapbox').classList.add('sheet-open');
        map.invalidateSize();
        $('.mapbox').scrollIntoView({ block: 'start', behavior: 'smooth' });
        map.panTo([lat, lon]);
        loadEnv(env, lat, lon, { update() {} });
      } else {
        const pop = L.popup({ maxWidth: 380, minWidth: 290, maxHeight: 460 }).setLatLng([lat, lon]).setContent(node).openOn(map);
        env.addEventListener('resized', () => pop.update());
        loadEnv(env, lat, lon, pop);
      }
    });
    mk.addTo(fireLayer);
  }
  setStatus($('#mapStatus'), `${$('#mapStatus').dataset.base || ''} ${shown} de ${fires.length} detecciones visibles.`);
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
    reportLayer.clearLayers();
    for (const r of list) {
      L.circleMarker([r.lat, r.lon], { radius: 7, color: COLOR.rep, fillColor: COLOR.rep, fillOpacity: 0.85, weight: 2 })
        .bindPopup(el('div', {}, el('b', {}, 'Reporte ciudadano'), ` (${r.status})`, el('br'), r.description, el('br'),
          el('small', {}, fmtDateTime(r.createdAt) + '. Sin verificar, salvo que figure como verificado.')))
        .addTo(reportLayer);
    }
  } catch { /* sin reportes */ }
}
$('#fReports').addEventListener('change', (e) => { e.target.checked ? map.addLayer(reportLayer) : map.removeLayer(reportLayer); });

// ---------- Gráficos del calendario (SVG propio, sin librerías) ----------
function niceMax(m) {
  const p = 10 ** Math.floor(Math.log10(m));
  for (const k of [1, 2, 4, 5, 8, 10]) if (k * p >= m) return k * p;
  return 10 * p;
}
function groupedBars(rows, series, label) {
  const W = 760, H = 264, M = { l: 44, r: 8, t: 12, b: 30 };
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const max = niceMax(Math.max(1, ...rows.flatMap((r) => series.map((s) => r[s.key] ?? 0))));
  const band = iw / rows.length, pad = band * 0.16, bw = (band - pad * 2) / series.length;
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
      root.append(svg('rect', { class: 'bar', x: x0 + pad + j * bw, y: M.t + ih - h, width: Math.max(1, bw - 2), height: h, rx: 2, style: `fill:${s.color}` },
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
const fmtN = (n) => Number(n).toLocaleString('es-PY');
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
    // El número del día lleva el mes cuando empieza un mes o es la primera casilla con datos
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

// ---------- Calendario ----------
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
osm().addTo(pickMap);
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
  return el('div', { class: 'item ' + r.status },
    el('div', { class: 'top' }, el('b', {}, `Reporte ${r.id}`), el('span', { class: 'pill ' + r.status }, r.status), el('small', {}, fmtDateTime(r.createdAt))),
    el('div', {}, r.description),
    el('small', {}, `Ubicación ${r.lat}, ${r.lon}` + (r.name ? `. Nombre: ${r.name}` : '') + (r.contact ? `. Contacto: ${r.contact}` : '')),
    el('div', { class: 'controls' }, sel, note, save,
      el('button', { class: 'btn', onclick: () => { showTab('mapa'); map.setView([r.lat, r.lon], 13); } }, 'Ver en el mapa')),
    el('ul', { class: 'hist' }, r.history.map((h) => el('li', {}, `${fmtDateTime(h.at)}: ${h.status}${h.note ? '. ' + h.note : ''}`))));
}

// ---------- Inicio ----------
loadFires();
loadPublicReports();
loadStations();

    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
};
const svg = (tag, props = {}, ...kids) => {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(props)) e.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
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
const COLOR = { modis: '#c77700', viirs: '#c2271f', uni: '#1b3a57', hist: '#a7b4ae', rep: '#6b46c1' };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const shortDate = (s) => { const [, m, d] = s.split('-'); return `${Number(d)} ${MESES[Number(m) - 1]}`; };
const fmtDateTime = (iso) => new Date(iso).toLocaleString('es-PY');

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
const osm = () => L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors', className: 'tiles-soft' });
const esri = () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Imágenes © Esri' });
const map = L.map('map', { preferCanvas: true }).fitBounds(PY_BOUNDS);
const base = osm().addTo(map);
L.control.layers({ Calles: base, Satélite: esri() }).addTo(map);
const fireLayer = L.layerGroup().addTo(map);
const reportLayer = L.layerGroup().addTo(map);
const stationLayer = L.layerGroup().addTo(map);
let stations = [];
let fires = [];

// Leyenda dentro del mapa: anillo = MODIS, punto = VIIRS, tamaño = potencia
const legend = L.control({ position: 'bottomleft' });
legend.onAdd = () => el('div', { class: 'map-legend' },
  el('div', {}, el('i', { class: 'g ring' }), 'MODIS'),
  el('div', {}, el('i', { class: 'g dot' }), 'VIIRS'),
  el('div', {}, el('i', { class: 'g rep' }), 'Reporte ciudadano'),
  el('div', {}, el('i', { class: 'g stn' }), 'Cuartel de bomberos'),
  el('div', {}, 'Más grande = más potencia'));
legend.addTo(map);

// ---------- Cuarteles de bomberos (archivo estático public/bomberos.json) ----------
const rad = (x) => (x * Math.PI) / 180;
function kmBetween(a, b, c, d) {
  const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
function nearestStation(lat, lon) {
  let best = null;
  for (const s of stations) {
    const km = kmBetween(lat, lon, s.lat, s.lon);
    if (!best || km < best.km) best = { s, km };
  }
  return best;
}
const stationName = (s) => `${s.t} de ${s.d}`;
async function loadStations() {
  try {
    stations = await api('/bomberos.json');
    for (const s of stations) {
      L.marker([s.lat, s.lon], {
        icon: L.divIcon({ className: 'stn-pin', html: '<span>B</span>', iconSize: [20, 20] }),
        zIndexOffset: -500, title: stationName(s),
      }).bindPopup(el('div', {}, el('b', {}, 'Cuartel de bomberos'), el('br'), stationName(s), el('br'),
        el('small', {}, `${s.b ? s.b + ', ' : ''}${s.d} (${s.p}). Emergencias: 911 / Bomberos 132.`))).addTo(stationLayer);
    }
  } catch { /* sin cuarteles */ }
}
$('#fStations').addEventListener('change', (e) => { e.target.checked ? map.addLayer(stationLayer) : map.removeLayer(stationLayer); });

// ---------- Resumen del área de un foco (se pide al abrirlo) ----------
const isMobile = () => window.matchMedia('(max-width: 820px)').matches;
const sheet = el('aside', { class: 'sheet', hidden: '', 'aria-label': 'Detalle del foco' });
$('.mapbox').append(sheet);
function closeSheet() { sheet.hidden = true; sheet.replaceChildren(); $('.mapbox').classList.remove('sheet-open'); }
map.on('click', () => { if (!sheet.hidden) closeSheet(); });

async function loadEnv(box, lat, lon, popup) {
  if (box.dataset.state === 'loading' || box.dataset.state === 'done') return;
  box.dataset.state = 'loading';
  box.replaceChildren(el('p', { class: 'status loading' }, 'Analizando el área con datos de NASA, Copernicus y ECMWF. Puede tardar hasta un minuto.'));
  popup.update();
  try {
    const d = await api(`/api/focus?lat=${lat}&lon=${lon}`);
    renderEnv(box, d.summary);
    box.dataset.state = 'done';
  } catch (e) {
    box.dataset.state = 'error';
    box.replaceChildren(
      el('p', { class: 'status err' }, 'Resumen del área no disponible. ' + e.message),
      el('button', { class: 'btn', type: 'button', onclick: () => { box.dataset.state = ''; loadEnv(box, lat, lon, popup); } }, 'Reintentar'));
  }
  popup.update();
}
function renderEnv(box, s) {
  const lvl = s.level ? 'lvl-' + s.level.replace(' ', '-') : 'lvl-nd';
  const facs = (s.factors || []).filter((f) => f.key !== 'combustible');
  // Lo más importante: primero lo que favorece el fuego (rojo), luego lo que lo frena (verde)
  const risks = facs.filter((f) => f.up).sort((a, b) => b.points / b.max - a.points / a.max);
  const calms = facs.filter((f) => f.down);
  const chip = (f, kind) => el('li', { class: 'tag ' + kind }, el('span', { class: 'arr', 'aria-hidden': 'true' }, kind === 'risk' ? '▲' : '▼'), f.label);
  const bar = el('i', { class: lvl });
  const top = [
    el('div', { class: 'lvl ' + lvl },
      el('b', {}, s.level ? `Potencial de propagación: ${s.level}` : 'Sin datos suficientes'),
      s.level ? el('span', {}, `${s.score}/100`) : null),
    s.level ? el('div', { class: 'meter', role: 'img', 'aria-label': `Potencial ${s.score} de 100` }, bar) : null,
  ];
  const flags = (risks.length || calms.length) ? el('div', { class: 'flags' },
    risks.length ? el('p', { class: 'flag-title' }, 'Lo que favorece el fuego') : null,
    risks.length ? el('ul', { class: 'tags' }, risks.map((f) => chip(f, 'risk'))) : null,
    calms.length ? el('p', { class: 'flag-title' }, 'Lo que lo frena') : null,
    calms.length ? el('ul', { class: 'tags' }, calms.map((f) => chip(f, 'calm'))) : null) : null;
  const wind = s.windToward ? el('p', { class: 'windline' }, el('span', { 'aria-hidden': 'true' }, '➜ '), `Si hubiera fuego, el viento lo llevaría hacia el ${s.windToward}.`) : null;
  const KEYS = { 'Viento': ['viento'], 'Aire': ['aire', 'temp'], 'Suelo (humedad)': ['suelo'], 'Lluvia': ['lluvia'], 'Vegetación': ['veg', 'combustible'], 'Relieve': ['pendiente'] };
  const toneOf = (label) => {
    const fs = facs.filter((f) => (KEYS[label] || []).includes(f.key));
    if (!fs.length) return 'info';
    if (fs.some((f) => f.up)) return 'risk';
    if (fs.every((f) => f.down)) return 'calm';
    return 'mid';
  };
  const datos = el('div', { class: 'datos' },
    el('p', { class: 'flag-title' }, 'Datos del área'),
    ...s.items.map((i) => el('div', { class: 'dato ' + toneOf(i.label) }, el('b', {}, i.label), el('span', {}, i.text))));
  const detail = el('details', { class: 'more' }, el('summary', {}, 'Fuentes, fechas y notas'),
    el('p', { class: 'concl' }, s.conclusion),
    el('div', { class: 'srcs' },
      ...s.rows.map((r) => el('div', { class: 'src-row' },
        el('b', {}, r.label), el('span', {}, r.value),
        r.date ? el('small', {}, 'Fecha: ' + r.date) : null,
        el('small', {}, 'Fuente: ' + r.source)))),
    el('p', { class: 'fine' }, s.notes.join(' ')));
  detail.addEventListener('toggle', () => requestAnimationFrame(() => box.dispatchEvent(new Event('resized'))));
  box.replaceChildren(...top, flags, wind, datos, detail);
  requestAnimationFrame(() => { bar.style.width = (s.score || 0) + '%'; });
}

async function loadFires() {
  setStatus($('#mapStatus'), 'Consultando NASA FIRMS…', 'loading');
  try {
    const d = await api('/api/fires?days=' + radio('days'));
    fires = d.points;
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
  let shown = 0;
  for (const [lat, lon, date, time, sensor, sat, conf, frp] of fires) {
    if ((sensor === 'MODIS' && !m) || (sensor === 'VIIRS' && !v) || (hi && conf !== 'high')) continue;
    shown++;
    const r = Math.min(9, 3 + Math.sqrt(frp) / 2);
    const mk = sensor === 'MODIS'
      ? L.circleMarker([lat, lon], { radius: r + 1.5, color: COLOR.modis, weight: 2, fillColor: COLOR.modis, fillOpacity: 0.1 })
      : L.circleMarker([lat, lon], { radius: r, color: COLOR.viirs, weight: 1, fillColor: COLOR.viirs, fillOpacity: 0.6 });
    const hh = `${time.slice(0, 2)}:${time.slice(2)}`;
    mk.on('click', (ev) => {
      L.DomEvent.stopPropagation(ev);
      const env = el('div', { class: 'env' });
      const node = el('div', { class: 'focus' },
        el('div', { class: 'focus-head' },
          el('b', {}, `Detección térmica ${sensor}`),
          isMobile() ? el('button', { class: 'sheet-x', type: 'button', 'aria-label': 'Cerrar', onclick: closeSheet }, '×') : null),
        el('p', { class: 'facts' },
          el('span', {}, `${date} ${hh} UTC`), el('span', {}, `Confianza ${CONF[conf]}`),
          el('span', {}, `${frp} MW`), el('span', {}, sat)),
        el('small', {}, 'Un foco satelital no confirma un incendio.'),
        (() => {
          const n = nearestStation(lat, lon);
          return n ? el('p', { class: 'near' }, el('b', {}, 'Cuartel más cercano: '), `${stationName(n.s)}, a ${n.km < 10 ? n.km.toFixed(1).replace('.', ',') : Math.round(n.km)} km en línea recta.`) : null;
        })(),
        env);
      if (isMobile()) {
        map.closePopup();
        sheet.replaceChildren(node); sheet.hidden = false; sheet.scrollTop = 0;
        $('.mapbox').classList.add('sheet-open');
        map.invalidateSize();
        $('.mapbox').scrollIntoView({ block: 'start', behavior: 'smooth' });
        map.panTo([lat, lon]);
        loadEnv(env, lat, lon, { update() {} });
      } else {
        const pop = L.popup({ maxWidth: 380, minWidth: 290, maxHeight: 460 }).setLatLng([lat, lon]).setContent(node).openOn(map);
        env.addEventListener('resized', () => pop.update());
        loadEnv(env, lat, lon, pop);
      }
    });
    mk.addTo(fireLayer);
  }
  setStatus($('#mapStatus'), `${$('#mapStatus').dataset.base || ''} ${shown} de ${fires.length} detecciones visibles.`);
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
    reportLayer.clearLayers();
    for (const r of list) {
      L.circleMarker([r.lat, r.lon], { radius: 7, color: COLOR.rep, fillColor: COLOR.rep, fillOpacity: 0.85, weight: 2 })
        .bindPopup(el('div', {}, el('b', {}, 'Reporte ciudadano'), ` (${r.status})`, el('br'), r.description, el('br'),
          el('small', {}, fmtDateTime(r.createdAt) + '. Sin verificar, salvo que figure como verificado.')))
        .addTo(reportLayer);
    }
  } catch { /* sin reportes */ }
}
$('#fReports').addEventListener('change', (e) => { e.target.checked ? map.addLayer(reportLayer) : map.removeLayer(reportLayer); });

// ---------- Gráficos del calendario (SVG propio, sin librerías) ----------
function niceMax(m) {
  const p = 10 ** Math.floor(Math.log10(m));
  for (const k of [1, 2, 4, 5, 8, 10]) if (k * p >= m) return k * p;
  return 10 * p;
}
function groupedBars(rows, series, label) {
  const W = 760, H = 280, M = { l: 44, r: 8, t: 12, b: 46 };
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const max = niceMax(Math.max(1, ...rows.flatMap((r) => series.map((s) => r[s.key] ?? 0))));
  const band = iw / rows.length, pad = band * 0.16, bw = (band - pad * 2) / series.length;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label, class: 'chart' });
  for (let i = 0; i <= 4; i++) {
    const y = M.t + ih - (ih * i) / 4;
    root.append(svg('line', { class: 'grid', x1: M.l, x2: W - M.r, y1: y, y2: y }),
      svg('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end' }, String(Math.round((max * i) / 4))));
  }
  rows.forEach((r, i) => {
    const x0 = M.l + i * band;
    if (r.anomaly) root.append(svg('rect', { x: x0 + 2, y: M.t, width: band - 4, height: ih, rx: 4, style: 'fill:rgba(194,39,31,.09)' }));
    series.forEach((s, j) => {
      const v = r[s.key];
      if (v == null) return;
      const h = (ih * v) / max;
      root.append(svg('rect', { class: 'bar', x: x0 + pad + j * bw, y: M.t + ih - h, width: Math.max(1, bw - 2), height: h, rx: 2, style: `fill:${s.color}` },
        svg('title', {}, `${shortDate(r.date)}: ${s.label} ${v}`)));
    });
    root.append(svg('text', { x: x0 + band / 2, y: H - 26, 'text-anchor': 'middle' }, shortDate(r.date)));
    if (r.anomaly) root.append(svg('text', { class: 'flagtxt', x: x0 + band / 2, y: H - 10, 'text-anchor': 'middle' }, 'Anomalía'));
  });
  return root;
}

// ---------- Calendario ----------
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
  $('#chartMain').replaceChildren(groupedBars(d.calendar, [
    { key: 'modis', label: 'MODIS', color: COLOR.modis },
    { key: 'viirs', label: 'VIIRS', color: COLOR.viirs },
    { key: 'unified', label: 'Zonas únicas', color: COLOR.uni },
  ], 'Detecciones por día de MODIS, VIIRS y zonas únicas'));

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

  const head = ['Fecha', 'MODIS', 'VIIRS', 'Zonas únicas', 'En ambos', 'Confianza alta', 'Potencia (MW)', 'Histórico', 'Razón', 'Puntaje z', 'Anomalía'];
  $('#calTable').replaceChildren(
    el('tr', {}, head.map((h) => el('th', {}, h))),
    ...d.calendar.map((c) => el('tr', { class: c.anomaly ? 'flag' : '' }, [c.date, c.modis, c.viirs, c.unified, c.both, c.high, c.frp,
      c.baseline ?? '—', c.ratio ?? '—', c.z, c.anomaly ? 'Sí' : 'No'].map((v) => el('td', {}, v)))));
}
$('#btnCal').addEventListener('click', loadCalendar);
document.querySelectorAll('input[name="calDays"]').forEach((i) => i.addEventListener('change', loadCalendar));

// ---------- Reportar ----------
const pickMap = L.map('pickmap').fitBounds(PY_BOUNDS);
osm().addTo(pickMap);
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
  return el('div', { class: 'item ' + r.status },
    el('div', { class: 'top' }, el('b', {}, `Reporte ${r.id}`), el('span', { class: 'pill ' + r.status }, r.status), el('small', {}, fmtDateTime(r.createdAt))),
    el('div', {}, r.description),
    el('small', {}, `Ubicación ${r.lat}, ${r.lon}` + (r.name ? `. Nombre: ${r.name}` : '') + (r.contact ? `. Contacto: ${r.contact}` : '')),
    el('div', { class: 'controls' }, sel, note, save,
      el('button', { class: 'btn', onclick: () => { showTab('mapa'); map.setView([r.lat, r.lon], 13); } }, 'Ver en el mapa')),
    el('ul', { class: 'hist' }, r.history.map((h) => el('li', {}, `${fmtDateTime(h.at)}: ${h.status}${h.note ? '. ' + h.note : ''}`))));
}

// ---------- Inicio ----------
loadFires();
loadPublicReports();
loadStations();
