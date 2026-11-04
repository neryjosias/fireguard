// FIREGUARD - lectura de datos ambientales desde Google Earth Engine.
// Se conecta con una CUENTA DE SERVICIO guardada solo en el servidor (variables de entorno):
//   GEE_PROJECT               id del proyecto de Google Cloud registrado en Earth Engine
//   GEE_SERVICE_ACCOUNT_JSON  contenido completo del archivo JSON de la clave de la cuenta de servicio
// Si falta algo, el servidor sigue funcionando y el resumen del foco avisa que no está configurado.
//
// Cada grupo de datos se consulta por separado: si una fuente falla, las demás igual se muestran.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export const eeConfigured = () => !!(process.env.GEE_PROJECT && process.env.GEE_SERVICE_ACCOUNT_JSON);

const GROUP_TIMEOUT_MS = 50_000;
let ee = null;
let ready = null;

function init() {
  if (ready) return ready;
  ready = new Promise((resolve, reject) => {
    try { ee = require('@google/earthengine'); } catch { return reject(new Error('Falta instalar el paquete @google/earthengine (npm install).')); }
    let key;
    try { key = JSON.parse(process.env.GEE_SERVICE_ACCOUNT_JSON); } catch { return reject(new Error('GEE_SERVICE_ACCOUNT_JSON no es un JSON válido.')); }
    if (typeof key.private_key === 'string') key.private_key = key.private_key.replace(/\\n/g, '\n');
    ee.data.authenticateViaPrivateKey(
      key,
      () => ee.initialize(null, null, resolve, (e) => reject(new Error('No se pudo iniciar Earth Engine: ' + e)), null, process.env.GEE_PROJECT),
      (e) => reject(new Error('Earth Engine rechazó la cuenta de servicio: ' + e)),
    );
  }).catch((e) => { ready = null; throw e; }); // si falla, se reintenta en la próxima consulta
  return ready;
}

const evaluate = (obj) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('tiempo agotado')), GROUP_TIMEOUT_MS);
  obj.evaluate((value, err) => {
    clearTimeout(timer);
    if (err) reject(new Error(String(err).slice(0, 160)));
    else resolve(value);
  });
});

// ---------- Consultas por grupo (cada una devuelve un objeto simple) ----------
const mean = () => ee.Reducer.mean();
const latest = (col) => ee.Image(col.sort('system:time_start', false).first());

const groups = {
  // Humedad superficial y de raíces (NASA SMAP L4, cada 3 horas, ~9 km)
  smap: (pt) => {
    const end = ee.Date(Date.now());
    const col = ee.ImageCollection('NASA/SMAP/SPL4SMGP/008').filterDate(end.advance(-10, 'day'), end)
      .select(['sm_surface', 'sm_rootzone', 'sm_rootzone_pctl']);
    const img = latest(col);
    const vals = img.reduceRegion({ reducer: mean(), geometry: pt, scale: 11000, bestEffort: true });
    return ee.Dictionary(vals).set('time', img.get('system:time_start'));
  },

  // Precipitación de los 7 días previos al último dato (NASA GPM IMERG, cada 30 min; mm/h x 0,5 h)
  imerg: (pt) => {
    const end = ee.Date(Date.now());
    const col = ee.ImageCollection('NASA/GPM_L3/IMERG_V07').filterDate(end.advance(-12, 'day'), end).select('precipitation');
    const t = ee.Number(latest(col).get('system:time_start'));
    const win = col.filterDate(ee.Date(t).advance(-7, 'day'), ee.Date(t).advance(1, 'minute'));
    const mm = win.sum().multiply(0.5).reduceRegion({ reducer: mean(), geometry: pt, scale: 11132, bestEffort: true });
    return ee.Dictionary({ mm7: mm.get('precipitation'), time: t });
  },

  // Lluvia diaria de los últimos ~60 días (CHIRPS, ~5 km)
  chirps: (pt) => {
    const end = ee.Date(Date.now());
    const col = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY').filterDate(end.advance(-60, 'day'), end).select('precipitation');
    const feats = col.map((img) => ee.Feature(null, {
      t: img.get('system:time_start'),
      mm: img.reduceRegion({ reducer: mean(), geometry: pt, scale: 5566, bestEffort: true }).get('precipitation'),
    }));
    return ee.Dictionary({ t: feats.aggregate_array('t'), mm: feats.aggregate_array('mm') });
  },

  // Arcilla y limo (ISRIC SoilGrids, 250 m, capa 0-5 cm; valores en g/kg)
  soil: (pt) => {
    const clay = ee.Image('projects/soilgrids-isric/clay_mean').select(0).rename('clay');
    const silt = ee.Image('projects/soilgrids-isric/silt_mean').select(0).rename('silt');
    return clay.addBands(silt).reduceRegion({ reducer: mean(), geometry: pt.buffer(250), scale: 250, bestEffort: true });
  },

  // Viento, temperatura y punto de rocío (ECMWF ERA5-Land, cada hora, ~11 km): último dato disponible
  era5: (pt) => {
    const end = ee.Date(Date.now());
    const col = ee.ImageCollection('ECMWF/ERA5_LAND/HOURLY').filterDate(end.advance(-120, 'day'), end)
      .select(['temperature_2m', 'dewpoint_temperature_2m', 'u_component_of_wind_10m', 'v_component_of_wind_10m']);
    const img = latest(col);
    const v = ee.Dictionary(img.reduceRegion({ reducer: mean(), geometry: pt, scale: 11132, bestEffort: true }));
    return ee.Dictionary({
      t2m: v.get('temperature_2m'), d2m: v.get('dewpoint_temperature_2m'),
      u: v.get('u_component_of_wind_10m'), v: v.get('v_component_of_wind_10m'),
      time: img.get('system:time_start'),
    });
  },

  // Elevación y pendiente (USGS SRTM, 30 m)
  terrain: (pt) => {
    const dem = ee.Image('USGS/SRTMGL1_003');
    return dem.select('elevation').addBands(ee.Terrain.slope(dem).rename('slope'))
      .reduceRegion({ reducer: mean(), geometry: pt.buffer(500), scale: 30, bestEffort: true });
  },

  // Vegetación (NDVI, NDMI) y suelo expuesto (BSI) con Sentinel-2, últimos 45 días vs. mismo período del año anterior
  s2: (pt) => {
    const region = pt.buffer(300);
    const clear = (img) => {
      const scl = img.select('SCL');
      return img.updateMask(scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10)).and(scl.neq(11)));
    };
    const indices = (img) => {
      const b2 = img.select('B2'), b4 = img.select('B4'), b8 = img.select('B8'), b11 = img.select('B11');
      return b8.subtract(b4).divide(b8.add(b4)).rename('ndvi')
        .addBands(b8.subtract(b11).divide(b8.add(b11)).rename('ndmi'))
        .addBands(b11.add(b4).subtract(b8.add(b2)).divide(b11.add(b4).add(b8.add(b2))).rename('bsi'));
    };
    const composite = (start, stop) => ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(region).filterDate(start, stop).filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 60))
      .map(clear).map(indices).median();
    const end = ee.Date(Date.now()), start = end.advance(-45, 'day');
    const now = composite(start, end).reduceRegion({ reducer: mean(), geometry: region, scale: 20, bestEffort: true });
    const prev = composite(start.advance(-1, 'year'), end.advance(-1, 'year')).reduceRegion({ reducer: mean(), geometry: region, scale: 20, bestEffort: true });
    return ee.Dictionary({ ndvi: now.get('ndvi'), ndmi: now.get('ndmi'), bsi: now.get('bsi'), ndvi_prev: prev.get('ndvi'), start: start.format('YYYY-MM-dd'), end: end.format('YYYY-MM-dd') });
  },

  // Radar Sentinel-1: retrodispersión VV (dB). NO mide deformación: sirve para ver cambios en la superficie.
  s1: (pt) => {
    const region = pt.buffer(300);
    const composite = (start, stop) => ee.ImageCollection('COPERNICUS/S1_GRD').filterBounds(region).filterDate(start, stop)
      .filter(ee.Filter.eq('instrumentMode', 'IW')).filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
      .select('VV').mean();
    const end = ee.Date(Date.now());
    const now = composite(end.advance(-24, 'day'), end).reduceRegion({ reducer: mean(), geometry: region, scale: 20, bestEffort: true });
    const prev = composite(end.advance(-48, 'day'), end.advance(-24, 'day')).reduceRegion({ reducer: mean(), geometry: region, scale: 20, bestEffort: true });
    return ee.Dictionary({ vv_now: now.get('VV'), vv_prev: prev.get('VV') });
  },

  // Cobertura del terreno (ESA WorldCover 10 m): histograma de clases alrededor del foco
  landcover: (pt) => {
    const wc = ee.ImageCollection('ESA/WorldCover/v200').first().select('Map');
    return ee.Dictionary({ hist: ee.Dictionary(wc.reduceRegion({ reducer: ee.Reducer.frequencyHistogram(), geometry: pt.buffer(300), scale: 10, bestEffort: true })).get('Map') });
  },
};

// Convierte la respuesta de cada grupo al formato que usa analysis.js
const shape = {
  chirps: (r) => ({ series: (r.t || []).map((t, i) => ({ t, mm: r.mm ? r.mm[i] : null })) }),
};

/** Lee todos los grupos para un punto. Devuelve { raw, errors }. Lanza error solo si no se puede iniciar Earth Engine. */
export async function fetchEnvironment(lat, lon) {
  await init();
  const pt = ee.Geometry.Point([lon, lat]);
  const names = Object.keys(groups);
  const results = await Promise.allSettled(names.map((n) => evaluate(groups[n](pt))));
  const raw = {}, errors = {};
  results.forEach((r, i) => {
    const n = names[i];
    if (r.status === 'fulfilled' && r.value) raw[n] = shape[n] ? shape[n](r.value) : r.value;
    else { raw[n] = null; errors[n] = r.status === 'rejected' ? r.reason.message : 'sin datos'; }
  });
  return { raw, errors };
}
