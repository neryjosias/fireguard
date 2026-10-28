// FIREGUARD - interfaz. Todo el texto de datos se inserta con textContent (sin innerHTML) para evitar XSS.
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
const api = async (url, opts = {}) => {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
};
const setStatus = (node, text, kind = '') => { node.textContent = text; node.className = 'status ' + kind; };
const PY_BOUNDS = [[-27.7, -62.7], [-19.2, -54.2]];
const CONF = { high: 'alta', nominal: 'nominal', low: 'baja' };

// ---------- Pestañas ----------
let calLoaded = false;
document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
function showTab(name) {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === name));
  if (name === 'mapa') setTimeout(() => map.invalidateSize(), 50);
  if (name === 'reportar') setTimeout(() => pickMap.invalidateSize(), 50);
  if (name === 'calendario' && !calLoaded) loadCalendar();
  if (name === 'bomberos' && token) loadAdmin();
}

// ---------- Mapa principal ----------
const osm = () => L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' });
const esri = () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Tiles © Esri' });
const map = L.map('map', { preferCanvas: true }).fitBounds(PY_BOUNDS);
const base = osm().addTo(map);
L.control.layers({ Calles: base, Satélite: esri() }).addTo(map);
const fireLayer = L.layerGroup().addTo(map);
const reportLayer = L.layerGroup().addTo(map);
let fires = [];

async function loadFires() {
  setStatus($('#mapStatus'), 'Consultando NASA FIRMS…');
  try {
    const d = await api('/api/fires?days=' + $('#days').value);
    fires = d.points;
    drawFires();
    const failed = d.sourcesFailed.length ? ` · sin respuesta: ${d.sourcesFailed.join(', ')}` : '';
    $('#mapStatus').dataset.base = `Datos NASA FIRMS del ${d.start} al ${d.end} (UTC)${failed}`;
    updateMapStatus();
  } catch (e) {
    setStatus($('#mapStatus'), 'No se pudieron cargar los datos: ' + e.message, 'err');
  }
}
function updateMapStatus(shown) {
  const baseText = $('#mapStatus').dataset.base || '';
  if (shown != null) $('#mapStatus').textContent = `${baseText} · ${shown} detecciones mostradas de ${fires.length}`;
}
function drawFires() {
  fireLayer.clearLayers();
  const m = $('#fMODIS').checked, v = $('#fVIIRS').checked, hi = $('#fHigh').checked;
  let shown = 0;
  for (const [lat, lon, date, time, sensor, sat, conf, frp] of fires) {
    if ((sensor === 'MODIS' && !m) || (sensor === 'VIIRS' && !v) || (hi && conf !== 'high')) continue;
    shown++;
    const color = sensor === 'MODIS' ? '#ff9f1a' : '#e8344e';
    const mk = L.circleMarker([lat, lon], { radius: Math.min(10, 3 + Math.sqrt(frp) / 2), color, weight: 1, fillColor: color, fillOpacity: 0.55 });
    mk.bindPopup(el('div', {},
      el('b', {}, `Detección térmica ${sensor}`), el('br'),
      `Satélite: ${sat}`, el('br'),
      `Fecha: ${date} ${time.slice(0, 2)}:${time.slice(2)} UTC`, el('br'),
      `Confianza: ${CONF[conf]}`, el('br'),
      `Potencia radiativa (FRP): ${frp} MW`, el('br'),
      el('small', {}, 'Un foco satelital no confirma un incendio.')));
    mk.addTo(fireLayer);
  }
  updateMapStatus(shown);
}
['fMODIS', 'fVIIRS', 'fHigh'].forEach((id) => $('#' + id).addEventListener('change', drawFires));
$('#days').addEventListener('change', loadFires);
$('#btnReload').addEventListener('click', () => { loadFires(); loadPublicReports(); });
$('#btnPY').addEventListener('click', () => map.fitBounds(PY_BOUNDS));
$('#btnLoc').addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Tu navegador no permite geolocalización.');
  navigator.geolocation.getCurrentPosition((p) => map.setView([p.coords.latitude, p.coords.longitude], 11), () => alert('No se pudo obtener tu ubicación.'));
});

async function loadPublicReports() {
  try {
    const list = await api('/api/reports');
    reportLayer.clearLayers();
    for (const r of list) {
      L.circleMarker([r.lat, r.lon], { radius: 7, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.8, weight: 2 })
        .bindPopup(el('div', {}, el('b', {}, 'Reporte ciudadano'), ` (${r.status})`, el('br'), r.description, el('br'),
          el('small', {}, new Date(r.createdAt).toLocaleString('es-PY') + ' · no verificado salvo que figure como verificado')))
        .addTo(reportLayer);
    }
  } catch { /* sin reportes */ }
}
$('#fReports').addEventListener('change', (e) => { e.target.checked ? map.addLayer(reportLayer) : map.removeLayer(reportLayer); });

// ---------- Calendario ----------
async function loadCalendar() {
  setStatus($('#calStatus'), 'Armonizando MODIS y VIIRS y comparando con años anteriores… (puede tardar unos segundos)');
  try {
    const d = await api('/api/analysis?days=' + $('#calDays').value);
    calLoaded = true;
    const failed = d.sourcesFailed.length ? ` · sin respuesta: ${d.sourcesFailed.join(', ')}` : '';
    const years = d.method.baselineYears.length ? d.method.baselineYears.join(' y ') : 'no disponible';
    setStatus($('#calStatus'), `Del ${d.start} al ${d.end} (UTC) · años de comparación: ${years}${failed}`);
    renderCalendar(d);
  } catch (e) {
    setStatus($('#calStatus'), 'No se pudo cargar el análisis: ' + e.message, 'err');
  }
}
function renderCalendar(d) {
  const max = Math.max(1, ...d.calendar.map((c) => Math.max(c.modis, c.viirs, c.unified)));
  const row = (label, val, cls) => el('div', { class: 'row' },
    el('div', { class: 'track', title: label }, el('i', { style: `width:${(val / max) * 100}%;background:var(--${cls})` })),
    String(val));
  const grid = $('#calGrid');
  grid.replaceChildren(...d.calendar.map((c) => el('div', { class: 'day' + (c.anomaly ? ' anom' : '') },
    el('h4', {}, c.date.slice(5), c.anomaly ? el('span', { class: 'badge' }, 'anomalía') : null),
    row('MODIS', c.modis, 'modis'), row('VIIRS', c.viirs, 'viirs'), row('Zonas únicas', c.unified, 'uni'),
    el('small', { class: 'note' }, `${c.both} zonas vistas por ambos sensores`))));

  $('#zones').replaceChildren(...(d.topZones.length ? d.topZones.map((z) =>
    el('div', { class: 'card' }, `Cuadrante ${z.lat.toFixed(1)}° / ${z.lon.toFixed(1)}° (celda de 0,5°): ${z.n} detecciones, FRP total ${z.frp} MW `,
      el('button', { class: 'secondary', onclick: () => { showTab('mapa'); map.setView([z.lat + 0.25, z.lon + 0.25], 9); } }, 'Ver en mapa'))) : [el('p', { class: 'note' }, 'Sin detecciones en la ventana.')]));

  $('#method').replaceChildren(...Object.values(d.method).filter((v) => typeof v === 'string').map((t) => el('p', {}, t)));

  const head = ['Fecha', 'MODIS', 'VIIRS', 'Zonas únicas', 'Ambos', 'Conf. alta', 'FRP (MW)', 'Hist. prom.', 'Razón', 'z', 'Anomalía'];
  const tbl = $('#calTable');
  tbl.replaceChildren(
    el('tr', {}, head.map((h) => el('th', {}, h))),
    ...d.calendar.map((c) => el('tr', {}, [c.date, c.modis, c.viirs, c.unified, c.both, c.high, c.frp,
      c.baseline ?? '—', c.ratio ?? '—', c.z, c.anomaly ? 'Sí' : 'No'].map((v) => el('td', {}, v)))));
}
$('#btnCal').addEventListener('click', loadCalendar);

// ---------- Reportar ----------
const pickMap = L.map('pickmap').fitBounds(PY_BOUNDS);
osm().addTo(pickMap);
let pickMarker = null, picked = null;
function setPick(lat, lon) {
  picked = { lat, lon };
  if (pickMarker) pickMarker.setLatLng([lat, lon]); else pickMarker = L.marker([lat, lon]).addTo(pickMap);
  setStatus($('#pickCoords'), `Ubicación: ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
}
pickMap.on('click', (e) => setPick(e.latlng.lat, e.latlng.lng));
$('#btnPickLoc').addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Tu navegador no permite geolocalización.');
  navigator.geolocation.getCurrentPosition((p) => { setPick(p.coords.latitude, p.coords.longitude); pickMap.setView([p.coords.latitude, p.coords.longitude], 13); }, () => alert('No se pudo obtener tu ubicación.'));
});
$('#repForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!picked) return setStatus($('#repMsg'), 'Primero marcá la ubicación en el mapa.', 'err');
  try {
    const r = await api('/api/reports', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...picked, description: $('#repDesc').value, name: $('#repName').value, contact: $('#repContact').value }),
    });
    setStatus($('#repMsg'), `Reporte enviado (código ${r.id}). Quedará como "pendiente" hasta que lo revisen. Si hay peligro, llamá al 911 o al 132.`, 'ok');
    $('#repForm').reset();
    loadPublicReports();
  } catch (err) { setStatus($('#repMsg'), err.message, 'err'); }
});

// ---------- Bomberos ----------
let token = sessionStorage.getItem('fgtoken') || '';
const adminApi = (url, opts = {}) => api(url, { ...opts, headers: { 'x-admin-token': token, 'content-type': 'application/json' } });
$('#btnLogin').addEventListener('click', async () => {
  token = $('#tokenInput').value.trim();
  try {
    await adminApi('/api/admin/reports');
    sessionStorage.setItem('fgtoken', token);
    $('#tokenInput').value = '';
    loadAdmin();
  } catch (e) { token = ''; setStatus($('#loginMsg'), e.message, 'err'); }
});
$('#btnLogout').addEventListener('click', () => { token = ''; sessionStorage.removeItem('fgtoken'); $('#adminBox').hidden = true; $('#loginBox').hidden = false; });
$('#btnAdminReload').addEventListener('click', loadAdmin);

async function loadAdmin() {
  try {
    const [reps, alerts] = await Promise.all([adminApi('/api/admin/reports'), adminApi('/api/admin/alerts').catch(() => null)]);
    $('#loginBox').hidden = true; $('#adminBox').hidden = false;
    $('#alerts').replaceChildren(...(alerts === null
      ? [el('p', { class: 'note' }, 'No se pudieron calcular alertas (¿sin respuesta de NASA FIRMS?).')]
      : alerts.length ? alerts.map((a) => el('div', { class: 'card' },
          el('b', {}, `Reporte ${a.reportId}`), ` a ${a.nearest.km} km de una detección ${a.nearest.sensor} (confianza ${CONF[a.nearest.conf]}, ${a.nearest.date} ${a.nearest.time.slice(0, 2)}:${a.nearest.time.slice(2)} UTC)`,
          el('br'), a.description))
      : [el('p', { class: 'note' }, 'Sin coincidencias por ahora.')]));
    $('#adminReports').replaceChildren(...(reps.length ? reps.map(renderAdminReport) : [el('p', { class: 'note' }, 'No hay reportes.')]));
  } catch (e) {
    $('#loginBox').hidden = false; $('#adminBox').hidden = true;
    setStatus($('#loginMsg'), e.message, 'err');
  }
}
function renderAdminReport(r) {
  const note = el('input', { type: 'text', placeholder: 'Nota (opcional)', maxlength: '300' });
  const sel = el('select', {}, ['pendiente', 'verificado', 'atendido', 'descartado'].map((s) => el('option', s === r.status ? { value: s, selected: '' } : { value: s }, s)));
  const save = el('button', { onclick: async () => {
    try { await adminApi('/api/admin/reports/' + r.id, { method: 'PATCH', body: JSON.stringify({ status: sel.value, note: note.value }) }); loadAdmin(); loadPublicReports(); }
    catch (e) { alert(e.message); }
  } }, 'Guardar');
  return el('div', { class: 'card' },
    el('b', {}, `#${r.id} `), el('span', { class: 'pill ' + r.status }, r.status), ' ',
    el('small', {}, new Date(r.createdAt).toLocaleString('es-PY')), el('br'),
    r.description, el('br'),
    el('small', {}, `Ubicación ${r.lat}, ${r.lon}` + (r.name ? ` · ${r.name}` : '') + (r.contact ? ` · contacto: ${r.contact}` : '')),
    el('div', { class: 'actions' }, sel, note, save,
      el('button', { class: 'secondary', onclick: () => { showTab('mapa'); map.setView([r.lat, r.lon], 13); } }, 'Ver en mapa')),
    el('ul', { class: 'hist' }, r.history.map((h) => el('li', {}, `${new Date(h.at).toLocaleString('es-PY')} · ${h.status}${h.note ? ' · ' + h.note : ''}`))));
}

// ---------- Inicio ----------
loadFires();
loadPublicReports();
