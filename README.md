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
| `PORT` | Puerto (por defecto 3000). |

## Estructura
```
server.js        API: proxy a FIRMS, armonización, anomalías, reportes, panel
public/          index.html, style.css, app.js (Leaflet)
data/            reportes guardados (reports.json, se crea solo)
```

## Publicarlo (Render, Railway, Fly.io, etc.)
1. Subí el proyecto a GitHub **sin** `.env` (ya está en `.gitignore`).
2. Creá un servicio web Node: build `npm install`, start `npm start`.
3. Cargá `FIRMS_MAP_KEY` y `FIREFIGHTER_TOKEN` como variables de entorno del servicio.
4. Probá en la URL pública: `/api/health` debe mostrar `firmsKeyConfigured: true`, y el mapa debe cargar detecciones.
5. Importante: muchos servicios gratuitos borran el disco al reiniciar. Para uso real, guardá los reportes en una base de datos (Postgres/Supabase) o montá un disco persistente en `DATA_DIR`.

## Pruebas de las funciones principales
- `GET /api/health` → servidor y claves configuradas.
- `GET /api/fires?days=2` → detecciones reales (MODIS + VIIRS).
- `GET /api/analysis?days=10` → calendario armonizado con anomalías.
- Enviar un reporte desde la pestaña "Reportar" y gestionarlo desde "Bomberos".

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
