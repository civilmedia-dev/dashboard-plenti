# Plenti | Performance

Dashboard de performance de Plenti para Civil Mafia. Lee los datos de BigQuery (`civil-datalake`) del lado del servidor, se despliega en Vercel y está protegido con contraseña.

## Qué muestra

Nueve páginas con filtros de período, sistema operativo (Consolidado, Android, iOS) y moneda (USD o COP):

1. Resumen ejecutivo
2. Funnel y costo por canal
3. Calidad por cohorte
4. Meta Ads
5. Google Ads
6. X Ads
7. Creatividades
8. Producto e in-app
9. Control de medición

## Fuentes de datos

| Fuente | Tabla en BigQuery |
| --- | --- |
| Meta Ads | `windsor_gbq_civil.facebook_ads_all` (cuenta "Somos Plenti 2026") |
| X Ads | `windsor_gbq_civil.twitterAds_campaigns_ads` (cuenta "somosplenti", en COP) |
| Google Ads | `raw_google_ads_native.ads_*_2688373478` (Data Transfer, en COP) |
| Firebase / GA4 | `analytics_375366038.events_*` (export diario) |
| GA4 histórico | `civil_curated_views.plenti_ga4_event_summary_60d` (antes del export completo) |

Reglas principales:

- Los eventos de la app usan la vista resumen de GA4 hasta el día anterior a `GA4_EXPORT_COMPLETE_FROM` y el export diario desde esa fecha.
- Los montos en COP se pasan a USD con la TRM de referencia `FX_COP_PER_USD`.
- En Meta se incluyen los anuncios con inversión diaria de al menos USD 1.
- El sistema operativo sale del nombre de la campaña. El perfil de audiencia de Meta sale del nombre del ad set. Las reglas están en `src/lib/classify.ts`.
- Las consultas SQL están en `src/server/queries.ts`.
- Los datos se cachean 3 horas por rango de fechas: las fuentes se actualizan una vez por día.

## Estructura

```
src/
  app/            páginas (dashboard y login) y rutas API
  components/     dashboard, gráficos y las 9 páginas
  lib/            tipos, fechas, formato, reglas de clasificación y modelo de datos
  server/         acceso a BigQuery (solo servidor)
  middleware.ts   protección con contraseña
```

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DASHBOARD_PASSWORD` | Sí | Contraseña para entrar al dashboard |
| `GCP_CLIENT_EMAIL` | Sí (Vercel) | `client_email` del JSON de la service account |
| `GCP_PRIVATE_KEY` | Sí (Vercel) | `private_key` del JSON de la service account, completa |
| `BIGQUERY_PROJECT_ID` | No | Por defecto `civil-datalake` |
| `BIGQUERY_LOCATION` | No | Por defecto `US` |
| `FX_COP_PER_USD` | No | TRM de referencia, por defecto `3250` |
| `GA4_EXPORT_COMPLETE_FROM` | No | Primer día del export completo de GA4, por defecto `2026-10-20` |
| `BIGQUERY_CREDENTIALS_PATH` | No | Solo local: ruta al JSON de la service account |

Los nombres de cuentas también se pueden cambiar por variable (ver `.env.example` y `src/server/config.ts`).

La service account necesita los roles **BigQuery Data Viewer** y **BigQuery Job User** en `civil-datalake`.

Nunca subas el JSON de la service account ni archivos `.env` al repositorio. El `.gitignore` ya los excluye.

## Desarrollo local

Requiere Node.js 18.18 o superior.

```bash
npm install
cp .env.example .env.local   # completar DASHBOARD_PASSWORD y credenciales
npm run dev                  # http://localhost:3000
```

Validación antes de subir cambios:

```bash
npm run typecheck
npm run lint
npm run build
```

## Deploy en Vercel

1. En Vercel: Add New, Project, importar este repositorio. Vercel detecta Next.js solo.
2. En Environment Variables cargar `DASHBOARD_PASSWORD`, `GCP_CLIENT_EMAIL` y `GCP_PRIVATE_KEY`. Para la clave privada se pega el valor completo, incluidas las líneas `-----BEGIN PRIVATE KEY-----` y `-----END PRIVATE KEY-----`.
3. Deploy.

Para cambiar la contraseña: se edita `DASHBOARD_PASSWORD` en Vercel y se vuelve a desplegar. Las sesiones abiertas se cierran solas.

## Pendientes conocidos

- Meta: los eventos de app (instalación, verificación, primera transacción) todavía no llegan por Windsor.
- X: el conector trae solo inversión y clics.
- Singular y SKAdNetwork: pendientes de conexión al data lake.
