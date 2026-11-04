# FIREGUARD

Calendario armonizado de actividad de incendios en Paraguay, construido con datos reales de **NASA FIRMS** (MODIS y VIIRS).

## Problema
MODIS y VIIRS detectan puntos de calor con resoluciones, horarios y escalas de confianza distintas. Mirarlos por separado hace difícil saber cuándo sube realmente la actividad de incendios.

## Solución
- **Mapa** (Leaflet) con detecciones recientes de ambos sensores y reportes ciudadanos.
- **Calendario armonizado**: une MODIS y VIIRS por día sin contar dos veces la misma zona (celdas de 0,02° ≈ 2 km), convierte las escalas de confianza a una sola (baja / nominal / alta) y marca **anomalías** comparando cada día con los mismos días de los 2 años anteriores (archivo SP de FIRMS) y con la propia ventana (puntaje z).
- **Portal ciudadano**: cualquier persona puede reportar humo o fuego marcando el mapa.
- **Panel de bomberos** (protegido con token): verificar, atender o descartar reportes, ver historial y alertas (reporte con una detección satelital a ≤5 km).

## ¿Para qué sirve?
Para ver rápido dónde y cuándo se concentra la actividad y priorizar revisiones. **Una detección satelital no confirma un incendio** (puede ser quema agrícola, industria o falsa alarma) y **FIREGUARD no reemplaza a los bomberos ni a los servicios de emergencia** (Paraguay: 911 / Bomberos 132).

## Cómo ejecutarlo
Requiere Node.js 18 o superior.

```bash
npm install
npm start
# abrir http://localhost:3000
```

La configuración vive en el archivo `.env` (no se sube a ningún repositorio):

| Variable | Qué es |
|---|---|
| `FIRMS_MAP_KEY` | Clave (MAP_KEY) de NASA FIRMS. **Solo la usa el servidor**; el navegador nunca la ve. |
| `FIREFIGHTER_TOKEN` | Token para entrar a la pestaña "Bomberos". |
| `GEE_PROJECT` y `GEE_SERVICE_ACCOUNT_JSON` | Conexión a Google Earth Engine para el resumen de cada foco (opcional). |
| `DATABASE_URL` | Cadena de conexión de PostgreSQL donde se guardan los reportes. Si falta, se usa un archivo local (solo pruebas). |
| `PORT` | Puerto (por defecto 3000). |

## Estructura
```
server.js        API: proxy a FIRMS, armonización, anomalías, reportes, panel
earth.js         lectura de datos de Google Earth Engine (por foco)
analysis.js      resumen y potencial de propagación (lógica pura)
unit/            pruebas de la lógica de análisis (npm test)
public/          index.html, style.css, app.js (Leaflet)
tests/           pruebas automáticas con Playwright (e2e.spec.js)
data/            solo si no hay DATABASE_URL: reports.json de respaldo local
```

## Publicarlo (Render, Railway, Fly.io, etc.)
1. Subí el proyecto a GitHub **sin** `.env` (ya está en `.gitignore`).
2. Creá un servicio web Node: build `npm install`, start `npm start`.
3. Cargá `FIRMS_MAP_KEY` y `FIREFIGHTER_TOKEN` como variables de entorno del servicio.
4. Probá en la URL pública: `/api/health` debe mostrar `firmsKeyConfigured: true`, y el mapa debe cargar detecciones.
5. Creá una base PostgreSQL (Render, Neon o Supabase) y cargá su cadena como `DATABASE_URL`. La tabla `reports` se crea sola al arrancar. `/api/health` debe mostrar `storage: "postgres"`.

## Pruebas de las funciones principales
- `GET /api/health` → servidor y claves configuradas.
- `GET /api/fires?days=2` → detecciones reales (MODIS + VIIRS).
- `GET /api/analysis?days=10` → calendario armonizado con anomalías.
- Enviar un reporte desde la pestaña "Reportar" y gestionarlo desde "Bomberos".

## Resumen ambiental de cada foco (Google Earth Engine)
Al abrir un foco en el mapa, el servidor lee datos del lugar y arma un resumen en español: viento, temperatura y humedad del aire, humedad del suelo, lluvia, tipo de suelo, vegetación, degradación del suelo, relieve y cambios en la superficie, con un **potencial de propagación** orientativo. Cada dato muestra su fecha y su fuente en "Datos por fuente".

| Dato | Fuente (id en Earth Engine) |
|---|---|
| Humedad superficial y de raíces | NASA SMAP L4 `NASA/SMAP/SPL4SMGP/008` |
| Precipitación | NASA GPM IMERG `NASA/GPM_L3/IMERG_V07` y CHIRPS `UCSB-CHG/CHIRPS/DAILY` |
| Arcilla y limo | ISRIC SoilGrids `projects/soilgrids-isric/clay_mean`, `silt_mean` |
| Viento, temperatura, humedad del aire | ECMWF ERA5-Land `ECMWF/ERA5_LAND/HOURLY` |
| Elevación y pendiente | USGS SRTM `USGS/SRTMGL1_003` |
| Vegetación y degradación del suelo | Copernicus Sentinel-2 `COPERNICUS/S2_SR_HARMONIZED` |
| Cambios en la superficie | Copernicus Sentinel-1 `COPERNICUS/S1_GRD` (retrodispersión radar; **no** mide deformación) |
| Cobertura del terreno (extra) | ESA WorldCover `ESA/WorldCover/v200` |

**Cómo se calcula el potencial de propagación:** suma puntos por viento, aire seco, temperatura, humedad del suelo, falta de lluvia, vegetación seca, pendiente y presencia de vegetación que pueda quemarse (ver `analysis.js`). Es una regla simple del proyecto, **no un modelo validado**, y no confirma que haya un incendio. Los datos con más de unos días de antigüedad no entran al puntaje y se avisa la fecha. Si una fuente falla, se muestra "sin dato" y las demás siguen.

### Cómo conectar Earth Engine
1. Registrá un proyecto de Google Cloud para Earth Engine en https://code.earthengine.google.com/register (uso no comercial).
2. En Google Cloud Console, en ese proyecto, activá la API de Earth Engine y creá una **cuenta de servicio** (IAM y administración > Cuentas de servicio). Dale los roles "Lector de recursos de Earth Engine" y "Consumidor de Service Usage".
3. En la cuenta de servicio creá una **clave JSON** y descargala. Tratala como una contraseña: no la subas a GitHub.
4. Cargá dos variables de entorno (en Render: Environment):
   - `GEE_PROJECT`: el id del proyecto de Google Cloud.
   - `GEE_SERVICE_ACCOUNT_JSON`: el contenido completo del archivo JSON.
5. Reiniciá el servicio. `/api/health` debe mostrar `"earthEngineConfigured":true`.

Sin estas variables la web funciona igual y el foco muestra que el resumen todavía no está configurado. Cada consulta puede tardar de 10 a 60 segundos; los resultados se guardan en caché 3 horas por celda de unos 1 km, y hay un límite de consultas por conexión.

## Pruebas automáticas (Playwright)
Las pruebas abren la web en un navegador real y comprueban las funciones principales: carga y aviso de emergencia, mapa con datos de NASA, calendario con sus gráficos, envío de un reporte, panel de Bomberos, que la clave de NASA no se filtre al navegador y que un texto con inyección SQL se guarde como texto.

```bash
npm install
npm run test:e2e:install     # una sola vez: descarga el navegador de pruebas
npm run test:e2e             # prueba el servidor local (lo arranca solo)

# Probar la web publicada (Windows PowerShell):
$env:BASE_URL="https://tu-app.onrender.com"; $env:FIREFIGHTER_TOKEN="tu_token"; npm run test:e2e
```
Los reportes de prueba empiezan con `[PRUEBA]` y se descartan solos al terminar. El servidor limita a 5 reportes por hora por conexión, así que no repitas la prueba muchas veces seguidas. Si falla algo, `npx playwright show-report` abre un informe con capturas.

## Seguridad de la base de datos
- Todas las consultas SQL usan **parámetros** (`$1`, `$2`…): los datos del usuario nunca se pegan dentro del texto SQL, por lo que no hay inyección SQL.
- Además se validan tipo, rango y largo de cada campo, y los estados permitidos también están limitados en la tabla (`CHECK`).
- Los errores de la base se registran en el servidor y al usuario solo le llega un mensaje genérico.

## Límites conocidos
- FIRMS da detecciones de pasadas satelitales recientes, no seguimiento continuo.
- La comparación histórica usa MODIS + VIIRS S-NPP (los únicos con archivo SP comparable); si el archivo de un año no está disponible, se omite.
- Los reportes ciudadanos no tienen verificación automática de identidad; el panel de bomberos usa un token compartido (suficiente para un prototipo, no para producción).
- Los límites de la API de FIRMS (transacciones por ventana de tiempo) aplican; el servidor guarda resultados en caché 10 min (reciente) y 24 h (histórico).

## Fuentes y créditos
- Datos: [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) (MODIS y VIIRS).
- Mapas: © OpenStreetMap contributors; imágenes Esri.
- Leaflet (BSD-2).
- FIREGUARD es un proyecto independiente. **NASA no lo creó ni lo respalda**; no se usan logos de NASA.

## Declaración de uso de IA
El código de este proyecto fue escrito con asistencia de IA (Claude, de Anthropic) a partir de las indicaciones del equipo. Los datos mostrados son reales y provienen de NASA FIRMS; no se inventan ni se presentan simulaciones como reales. El equipo debe revisar el código y seguir las instrucciones oficiales de entrega del evento.
