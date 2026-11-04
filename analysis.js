// FIREGUARD - análisis ambiental de un foco (funciones puras, sin red).
// Recibe valores ya leídos de Earth Engine (ver earth.js) y arma un resumen en español.
//
// IMPORTANTE: el "potencial de propagación" es una REGLA SIMPLE propia del proyecto para dar contexto.
// No es un modelo validado de comportamiento del fuego y no confirma que haya un incendio.

const DAY = 86400000;

// Cuántos días de antigüedad se aceptan para usar cada fuente en el puntaje.
const MAX_AGE = { smap: 7, imerg: 10, chirps: 12, era5: 7, s2: 75 };

// ---------- Conversiones ----------
export const kelvinToC = (k) => k - 273.15;

// Humedad relativa (%) a partir de temperatura y punto de rocío en °C (fórmula de Magnus)
export function relativeHumidity(tC, tdC) {
  const a = 17.625, b = 243.04;
  const rh = 100 * Math.exp((a * tdC) / (b + tdC) - (a * tC) / (b + tC));
  return Math.max(0, Math.min(100, rh));
}

// Dirección DESDE donde sopla el viento, en grados (0 = norte, 90 = este). u = hacia el este, v = hacia el norte.
export const windFromDeg = (u, v) => (((270 - (Math.atan2(v, u) * 180) / Math.PI) % 360) + 360) % 360;
export const windSpeedKmh = (u, v) => Math.hypot(u, v) * 3.6;

const DIRS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
export const compass = (deg) => DIRS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

// Textura del suelo (clasificación USDA) a partir de % de arcilla y limo
export function soilTexture(clay, silt) {
  const sand = 100 - clay - silt;
  const c = clay, s = silt;
  let name;
  if (s + 1.5 * c < 15) name = 'arenoso';
  else if (s + 1.5 * c >= 15 && s + 2 * c < 30) name = 'areno-franco';
  else if ((c >= 7 && c < 20 && sand > 52 && s + 2 * c >= 30) || (c < 7 && s < 50 && s + 2 * c >= 30)) name = 'franco arenoso';
  else if (c >= 7 && c < 27 && s >= 28 && s < 50 && sand <= 52) name = 'franco';
  else if ((s >= 50 && c >= 12 && c < 27) || (s >= 50 && s < 80 && c < 12)) name = 'franco limoso';
  else if (s >= 80 && c < 12) name = 'limoso';
  else if (c >= 20 && c < 35 && s < 28 && sand > 45) name = 'franco arcillo arenoso';
  else if (c >= 27 && c < 40 && sand > 20 && sand <= 45) name = 'franco arcilloso';
  else if (c >= 27 && c < 40 && sand <= 20) name = 'franco arcillo limoso';
  else if (c >= 35 && sand > 45) name = 'arcillo arenoso';
  else if (c >= 40 && s >= 40) name = 'arcillo limoso';
  else if (c >= 40) name = 'arcilloso';
  else name = 'franco';
  let behaviour;
  if (/arenoso|areno-franco/.test(name) && !/arcillo/.test(name)) behaviour = 'drena rápido y se seca pronto';
  else if (/arcillo/.test(name)) behaviour = 'retiene la humedad por más tiempo';
  else behaviour = 'retiene humedad de forma intermedia';
  return { name, sand, behaviour };
}

// ESA WorldCover v200: clase -> nombre y si hay vegetación que pueda quemarse
const COVER = {
  10: { name: 'bosque o plantación arbolada', fuel: true },
  20: { name: 'arbustal', fuel: true },
  30: { name: 'pastizal', fuel: true },
  40: { name: 'cultivo', fuel: true },
  50: { name: 'zona urbanizada', fuel: false },
  60: { name: 'suelo desnudo o con poca vegetación', fuel: false },
  70: { name: 'nieve o hielo', fuel: false },
  80: { name: 'agua', fuel: false },
  90: { name: 'humedal herbáceo', fuel: true },
  95: { name: 'manglar', fuel: true },
  100: { name: 'musgo o líquenes', fuel: true },
};
export function dominantCover(hist) {
  if (!hist) return null;
  const entries = Object.entries(hist).map(([k, v]) => [Number(k), Number(v)]).filter(([, v]) => v > 0);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  if (!total) return null;
  const [cls, n] = entries.sort((a, b) => b[1] - a[1])[0];
  const info = COVER[cls] || { name: `clase ${cls}`, fuel: true };
  return { cls, name: info.name, fuel: info.fuel, share: Math.round((n / total) * 100) };
}

// Días secos seguidos (menos de 1 mm) contando hacia atrás desde el último dato, y lluvia de los últimos 30 días
export function rainStats(series) {
  const list = (series || []).filter((d) => d.mm != null && Number.isFinite(d.mm)).sort((a, b) => a.t - b.t);
  if (!list.length) return null;
  let dry = 0;
  for (let i = list.length - 1; i >= 0 && list[i].mm < 1; i--) dry++;
  const last30 = list.slice(-30);
  return { dryDays: dry, mm30: last30.reduce((a, d) => a + d.mm, 0), days: last30.length, lastT: list[list.length - 1].t };
}

// ---------- Utilidades de texto ----------
const fmt = (n, d = 0) => (n == null || !Number.isFinite(n) ? '—' : n.toFixed(d).replace('.', ','));
const dateOf = (ms) => (ms == null ? null : new Date(ms).toISOString().slice(0, 10));
const ageDays = (ms, now) => (ms == null ? Infinity : (now - ms) / DAY);
const list = (arr) => (arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1]);

// ---------- Resumen ----------
export function buildSummary(raw, errors = {}, now = Date.now()) {
  const items = [];     // frases del resumen, con su etiqueta
  const rows = [];      // tabla de datos por fuente
  const factors = [];   // factores que suman al potencial de propagación
  const notes = [];
  const row = (label, value, date, source) => rows.push({ label, value: value ?? 'sin dato', date: date || '', source });
  const why = (key) => errors[key] ? ' (' + errors[key] + ')' : '';

  // --- Viento, temperatura y humedad del aire (ERA5-Land) ---
  const e = raw.era5;
  let windToward = null;
  if (e && e.u != null && e.v != null) {
    const kmh = windSpeedKmh(e.u, e.v);
    const from = windFromDeg(e.u, e.v);
    windToward = compass((from + 180) % 360);
    const tC = e.t2m != null ? kelvinToC(e.t2m) : null;
    const rh = e.t2m != null && e.d2m != null ? relativeHumidity(tC, kelvinToC(e.d2m)) : null;
    const old = ageDays(e.time, now) > MAX_AGE.era5;
    const when = dateOf(e.time);
    const stale = old ? ` Es el último dato disponible (${when}), no representa las condiciones de hoy y no se usa en el puntaje.` : '';
    row('Viento (ECMWF ERA5-Land)', `${fmt(kmh, 0)} km/h desde el ${compass(from)} (${fmt(from, 0)}°)`, when, 'ECMWF/ERA5_LAND/HOURLY');
    row('Movimiento del aire (ERA5-Land)', `componente este-oeste ${fmt(e.u, 1)} m/s, norte-sur ${fmt(e.v, 1)} m/s`, when, 'ECMWF/ERA5_LAND/HOURLY');
    row('Temperatura del aire (ERA5-Land)', tC == null ? null : `${fmt(tC, 1)} °C` + (rh == null ? '' : `, humedad relativa ${fmt(rh, 0)} %`), when, 'ECMWF/ERA5_LAND/HOURLY');
    items.push({
      label: 'Viento',
      text: (kmh < 5 ? `Casi sin viento (${fmt(kmh, 0)} km/h).` : `Viento del ${compass(from)} a ${fmt(kmh, 0)} km/h, que empuja el fuego hacia el ${windToward}.`) + stale,
    });
    if (tC != null) items.push({ label: 'Aire', text: `${fmt(tC, 0)} °C` + (rh != null ? ` y humedad relativa de ${fmt(rh, 0)} %` : '') + (rh != null && rh < 30 ? ': aire muy seco' : '') + '.' });
    if (!old) {
      const wp = kmh < 8 ? 0 : kmh < 15 ? 8 : kmh < 25 ? 15 : kmh < 35 ? 20 : 25;
      factors.push({ key: 'viento', label: 'viento', points: wp, max: 25, up: wp >= 15, down: wp === 0 });
      if (rh != null) { const p = rh >= 60 ? 0 : rh >= 45 ? 5 : rh >= 30 ? 12 : rh >= 20 ? 17 : 20; factors.push({ key: 'aire', label: 'aire seco', points: p, max: 20, up: p >= 12, down: p === 0 }); }
      if (tC != null) { const p = tC < 25 ? 0 : tC < 30 ? 3 : tC < 35 ? 7 : 10; factors.push({ key: 'temp', label: 'temperatura alta', points: p, max: 10, up: p >= 7, down: p === 0 }); }
    }
  } else {
    row('Viento y temperatura (ECMWF ERA5-Land)', null, '', 'ECMWF/ERA5_LAND/HOURLY');
    items.push({ label: 'Viento', text: 'No hay dato de viento para este punto' + why('era5') + '.' });
  }

  // --- Humedad del suelo (SMAP) ---
  const sm = raw.smap;
  if (sm && (sm.sm_surface != null || sm.sm_rootzone != null)) {
    const when = dateOf(sm.time);
    const old = ageDays(sm.time, now) > MAX_AGE.smap;
    row('Humedad superficial (NASA SMAP L4)', sm.sm_surface == null ? null : `${fmt(sm.sm_surface * 100, 0)} % del volumen (0-5 cm)`, when, 'NASA/SMAP/SPL4SMGP/008');
    row('Humedad de raíces (NASA SMAP L4)', sm.sm_rootzone == null ? null : `${fmt(sm.sm_rootzone * 100, 0)} % del volumen (0-100 cm)` + (sm.sm_rootzone_pctl == null ? '' : `, percentil ${fmt(sm.sm_rootzone_pctl, 0)}`), when, 'NASA/SMAP/SPL4SMGP/008');
    const pct = sm.sm_rootzone_pctl;
    const rel = pct == null ? '' : pct < 25 ? ', más seca de lo habitual para esta época' : pct > 75 ? ', más húmeda de lo habitual' : ', dentro de lo habitual';
    items.push({
      label: 'Suelo (humedad)',
      text: `Humedad en superficie ${sm.sm_surface == null ? 'sin dato' : fmt(sm.sm_surface * 100, 0) + ' %'} y en la zona de raíces ${sm.sm_rootzone == null ? 'sin dato' : fmt(sm.sm_rootzone * 100, 0) + ' %'}${rel}.` + (old ? ` Dato del ${when}, no se usa en el puntaje.` : ''),
    });
    if (!old) {
      let p;
      if (pct != null) p = pct < 10 ? 10 : pct < 25 ? 8 : pct < 40 ? 5 : pct < 60 ? 2 : 0;
      else if (sm.sm_rootzone != null) p = sm.sm_rootzone < 0.15 ? 10 : sm.sm_rootzone < 0.25 ? 6 : sm.sm_rootzone < 0.35 ? 2 : 0;
      if (p != null) factors.push({ key: 'suelo', label: 'suelo seco', points: p, max: 10, up: p >= 6, down: p === 0 });
    }
  } else {
    row('Humedad superficial y de raíces (NASA SMAP L4)', null, '', 'NASA/SMAP/SPL4SMGP/008');
    items.push({ label: 'Suelo (humedad)', text: 'Sin dato de humedad del suelo' + why('smap') + '.' });
  }

  // --- Lluvia (CHIRPS diario + GPM IMERG) ---
  const rs = raw.chirps ? rainStats(raw.chirps.series) : null;
  const im = raw.imerg;
  const chirpsFresh = rs && ageDays(rs.lastT, now) <= MAX_AGE.chirps;
  const imergFresh = im && im.mm7 != null && ageDays(im.time, now) <= MAX_AGE.imerg;
  if (rs) row('Lluvia diaria (CHIRPS)', `${fmt(rs.mm30, 0)} mm en 30 días, ${rs.dryDays} días secos seguidos`, dateOf(rs.lastT), 'UCSB-CHG/CHIRPS/DAILY');
  else row('Lluvia diaria (CHIRPS)', null, '', 'UCSB-CHG/CHIRPS/DAILY');
  if (im && im.mm7 != null) row('Precipitación de 7 días (NASA GPM IMERG)', `${fmt(im.mm7, 1)} mm`, dateOf(im.time), 'NASA/GPM_L3/IMERG_V07');
  else row('Precipitación de 7 días (NASA GPM IMERG)', null, '', 'NASA/GPM_L3/IMERG_V07');
  const rainBits = [];
  if (rs) rainBits.push(`${rs.dryDays} días seguidos sin lluvia significativa y ${fmt(rs.mm30, 0)} mm en los últimos 30 días (CHIRPS, hasta el ${dateOf(rs.lastT)})`);
  if (im && im.mm7 != null) rainBits.push(`${fmt(im.mm7, 1)} mm en los 7 días hasta el ${dateOf(im.time)} (GPM IMERG)`);
  items.push({ label: 'Lluvia', text: rainBits.length ? rainBits.join('; ') + '.' : 'Sin datos de lluvia' + why('chirps') + '.' });
  if (chirpsFresh) {
    const p = (rs.dryDays >= 15 ? 10 : rs.dryDays >= 8 ? 7 : rs.dryDays >= 4 ? 3 : 0) + (rs.days >= 20 && rs.mm30 < 40 ? 3 : 0);
    factors.push({ key: 'lluvia', label: 'falta de lluvia', points: p, max: 13, up: p >= 7, down: p === 0 });
  } else if (imergFresh) {
    const p = im.mm7 < 2 ? 10 : im.mm7 < 10 ? 5 : 0;
    factors.push({ key: 'lluvia', label: 'falta de lluvia', points: p, max: 10, up: p >= 5, down: p === 0 });
  }

  // --- Tipo de suelo (SoilGrids) ---
  const so = raw.soil;
  if (so && so.clay != null && so.silt != null) {
    const clay = so.clay / 10, silt = so.silt / 10; // SoilGrids viene en g/kg
    const t = soilTexture(clay, silt);
    row('Arcilla (ISRIC SoilGrids, 0-5 cm)', `${fmt(clay, 0)} %`, '', 'projects/soilgrids-isric/clay_mean');
    row('Limo (ISRIC SoilGrids, 0-5 cm)', `${fmt(silt, 0)} %`, '', 'projects/soilgrids-isric/silt_mean');
    items.push({ label: 'Suelo (tipo)', text: `Textura ${t.name} (arcilla ${fmt(clay, 0)} %, limo ${fmt(silt, 0)} %, arena ${fmt(t.sand, 0)} %): ${t.behaviour}.` });
  } else {
    row('Arcilla y limo (ISRIC SoilGrids)', null, '', 'projects/soilgrids-isric/clay_mean, silt_mean');
    items.push({ label: 'Suelo (tipo)', text: 'Sin dato de textura del suelo' + why('soil') + '.' });
  }

  // --- Cobertura (ESA WorldCover) ---
  const cover = dominantCover(raw.landcover && raw.landcover.hist);
  if (cover) row('Cobertura del terreno (ESA WorldCover)', `${cover.name}, ${cover.share} % del área`, '2021', 'ESA/WorldCover/v200');
  else row('Cobertura del terreno (ESA WorldCover)', null, '', 'ESA/WorldCover/v200');

  // --- Vegetación y degradación (Sentinel-2) ---
  const v = raw.s2;
  let vegPresent = true;
  if (v && v.ndvi != null) {
    const dens = v.ndvi >= 0.6 ? 'densa' : v.ndvi >= 0.3 ? 'media' : 'rala';
    vegPresent = v.ndvi >= 0.15;
    const moist = v.ndmi == null ? null : v.ndmi < 0.05 ? 'seca' : v.ndmi < 0.25 ? 'con humedad moderada' : 'húmeda';
    const when = v.start && v.end ? `${v.start} a ${v.end}` : '';
    row('Vegetación (Copernicus Sentinel-2)', `NDVI ${fmt(v.ndvi, 2)} (${dens})` + (v.ndmi == null ? '' : `, NDMI ${fmt(v.ndmi, 2)} (${moist})`), when, 'COPERNICUS/S2_SR_HARMONIZED');
    items.push({
      label: 'Vegetación',
      text: `${cover ? 'Cobertura de ' + cover.name + ' (' + cover.share + ' % del área). ' : ''}Vegetación ${dens} (NDVI ${fmt(v.ndvi, 2)})${moist ? ' y ' + moist + ' (NDMI ' + fmt(v.ndmi, 2) + ')' : ''}.`,
    });
    if (v.ndmi != null && vegPresent) {
      const p = v.ndmi < 0 ? 10 : v.ndmi < 0.1 ? 7 : v.ndmi < 0.2 ? 4 : v.ndmi < 0.3 ? 1 : 0;
      factors.push({ key: 'veg', label: 'vegetación seca', points: p, max: 10, up: p >= 7, down: p === 0 });
    }
    // Degradación: suelo expuesto y pérdida de vegetación frente al mismo período del año anterior
    if (v.bsi != null) {
      const drop = v.ndvi_prev != null ? v.ndvi - v.ndvi_prev : null;
      const degraded = v.bsi > 0.1 && drop != null && drop < -0.1;
      row('Degradación del suelo (Copernicus Sentinel-2)', `índice de suelo desnudo ${fmt(v.bsi, 2)}` + (drop == null ? '' : `, cambio de NDVI frente al año anterior ${fmt(drop, 2)}`), when, 'COPERNICUS/S2_SR_HARMONIZED');
      if (degraded) items.push({ label: 'Suelo (estado)', text: `Indicios de degradación: suelo más expuesto y menos vegetación que hace un año (NDVI ${fmt(drop, 2)}).` });
    }
  } else {
    row('Vegetación y degradación (Copernicus Sentinel-2)', null, '', 'COPERNICUS/S2_SR_HARMONIZED');
    items.push({ label: 'Vegetación', text: (cover ? `Cobertura de ${cover.name} (${cover.share} % del área). ` : '') + 'Sin imágenes Sentinel-2 útiles (nubes o falta de pasadas)' + why('s2') + '.' });
  }
  const fuelPresent = (cover ? cover.fuel : true) && vegPresent;
  if (cover || (v && v.ndvi != null)) factors.push({ key: 'combustible', label: 'vegetación que puede quemarse', points: fuelPresent ? 5 : 0, max: 5, up: false, down: !fuelPresent });

  // --- Relieve (SRTM) ---
  const tr = raw.terrain;
  if (tr && tr.slope != null) {
    row('Elevación (USGS SRTM)', tr.elevation == null ? null : `${fmt(tr.elevation, 0)} m`, '', 'USGS/SRTMGL1_003');
    row('Pendiente (USGS SRTM)', `${fmt(tr.slope, 0)}°`, '', 'USGS/SRTMGL1_003');
    const cls = tr.slope < 5 ? 'plano' : tr.slope < 10 ? 'suave' : tr.slope < 20 ? 'inclinado' : 'empinado';
    items.push({ label: 'Relieve', text: `Terreno ${cls} (${fmt(tr.slope, 0)}° de pendiente, ${fmt(tr.elevation, 0)} m de altitud)` + (tr.slope >= 10 ? '; el fuego sube más rápido en pendiente.' : '.') });
    const p = tr.slope < 5 ? 0 : tr.slope < 10 ? 4 : tr.slope < 20 ? 8 : 12;
    factors.push({ key: 'pendiente', label: 'pendiente', points: p, max: 12, up: p >= 8, down: p === 0 });
  } else {
    row('Elevación y pendiente (USGS SRTM)', null, '', 'USGS/SRTMGL1_003');
  }

  // --- Radar (Sentinel-1). OJO: GRD no mide deformación, mide retrodispersión ---
  const r = raw.s1;
  if (r && r.vv_now != null) {
    const d = r.vv_prev != null ? r.vv_now - r.vv_prev : null;
    row('Cambio en la superficie (Copernicus Sentinel-1)', `retrodispersión VV ${fmt(r.vv_now, 1)} dB` + (d == null ? '' : `, cambio ${fmt(d, 1)} dB frente al período anterior`), '', 'COPERNICUS/S1_GRD');
    if (d != null && Math.abs(d) >= 2) items.push({ label: 'Radar', text: `La señal radar cambió ${fmt(d, 1)} dB entre dos períodos: indica cambios de humedad o de vegetación en la superficie.` });
  } else {
    row('Cambio en la superficie (Copernicus Sentinel-1)', null, '', 'COPERNICUS/S1_GRD');
  }
  notes.push('Sentinel-1 GRD no mide deformación del terreno (eso requiere interferometría). Se usa la retrodispersión radar para ver cambios en la superficie.');

  // --- Potencial de propagación ---
  const have = factors.length;
  const maxSum = factors.reduce((a, f) => a + f.max, 0);
  let score = maxSum ? Math.round((factors.reduce((a, f) => a + f.points, 0) / maxSum) * 100) : null;
  if (score != null && !fuelPresent) score = Math.min(score, 30);
  const level = score == null ? null : score < 25 ? 'bajo' : score < 50 ? 'moderado' : score < 70 ? 'alto' : 'muy alto';

  let conclusion;
  if (score == null) {
    conclusion = 'No hay datos suficientes para estimar el potencial de propagación en este punto.';
  } else {
    const up = factors.filter((f) => f.up).sort((a, b) => b.points / b.max - a.points / a.max).map((f) => f.label);
    const down = factors.filter((f) => f.down && f.key !== 'combustible').map((f) => f.label);
    conclusion = `Se usaron ${have} de 8 factores. `;
    if (!fuelPresent) conclusion += 'Hay poca vegetación para quemar, por eso el potencial se limita. ';
    if (up.length) conclusion += `Lo favorecen: ${list(up)}. `;
    if (down.length) conclusion += `Lo frenan: ${list(down)}. `;
    if (windToward && factors.some((f) => f.key === 'viento')) conclusion += `Si hubiera fuego, el viento tendería a llevarlo hacia el ${windToward}.`;
  }
  notes.push('Estimación orientativa con reglas simples del proyecto, no un modelo validado de comportamiento del fuego. Un foco satelital no confirma un incendio y esto no reemplaza el criterio de Bomberos.');

  return { level, score, factorsUsed: have, conclusion: conclusion.trim(), items, rows, notes, generatedAt: new Date(now).toISOString() };
}
