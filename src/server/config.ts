import 'server-only';

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

/** Configuración del dashboard. Todo lo que puede cambiar vive en variables de entorno. */
export const config = {
  projectId: env('BIGQUERY_PROJECT_ID', 'civil-datalake'),
  location: env('BIGQUERY_LOCATION', 'US'),
  windsorDataset: env('BIGQUERY_DATASET', 'windsor_gbq_civil'),
  googleAdsDataset: env('GOOGLE_ADS_DATASET', 'raw_google_ads_native'),
  curatedDataset: env('CURATED_DATASET', 'civil_curated_views'),
  ga4Dataset: env('GA4_DATASET', 'analytics_375366038'),
  metaAccountName: env('META_ACCOUNT_NAME', 'Somos Plenti 2026'),
  googleAdsCustomerId: env('GOOGLE_ADS_CUSTOMER_ID', '2688373478'),
  xAccountName: env('X_ACCOUNT_NAME', 'somosplenti'),
  /** Primer día con export diario completo de Firebase / GA4. Antes se usa la vista resumen de la API de GA4. */
  ga4ExportCompleteFrom: env('GA4_EXPORT_COMPLETE_FROM', '2026-10-20'),
  /** TRM de referencia: pesos colombianos por dólar. */
  fxCopPerUsd: Number(env('FX_COP_PER_USD', '3250')) || 3250,
};
