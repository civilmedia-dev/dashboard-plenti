import 'server-only';
import { unstable_cache } from 'next/cache';
import { config } from './config';
import { runQuery } from './bigquery';
import { SQL } from './queries';
import { previousRange } from '@/lib/dates';
import type {
  AppEventRow, CohortRow, EngageRow, GoogleCampaign, GoogleConvRow, GoogleDailyRow,
  MetaAdStart, MetaRow, Payload, SourceRow, VersionRow, XRow,
} from '@/lib/types';

const EVENTS = ['first_open', 'signup_started', 'signup_success', 'verification_completed', 'first_transaction'];

async function load(from: string, to: string): Promise<Payload> {
  const { prevFrom, prevTo } = previousRange(from, to);
  const base = {
    start: prevFrom,
    end: to,
    exportFrom: config.ga4ExportCompleteFrom,
  };
  const withMeta = { ...base, metaAccount: config.metaAccountName };

  const [
    meta, metaStarts, currency, googleDaily, googleConv, googleCampaigns, x,
    events, cohorts, versions, engage, sources,
  ] = await Promise.all([
    runQuery<MetaRow>(SQL.meta, withMeta),
    runQuery<MetaAdStart>(SQL.metaStarts, { end: to, metaAccount: config.metaAccountName }),
    runQuery<{ currency: string }>(SQL.googleCurrency, {}),
    runQuery<GoogleDailyRow>(SQL.googleDaily, { start: prevFrom, end: to }),
    runQuery<GoogleConvRow>(SQL.googleConv, { start: prevFrom, end: to }),
    runQuery<GoogleCampaign>(SQL.googleCampaigns, {}),
    runQuery<XRow>(SQL.x, { start: prevFrom, end: to, xAccount: config.xAccountName }),
    runQuery<AppEventRow>(SQL.events, { ...base, events: EVENTS }),
    runQuery<CohortRow>(SQL.cohorts, base),
    runQuery<VersionRow>(SQL.versions, base),
    runQuery<EngageRow>(SQL.engage, base),
    runQuery<SourceRow>(SQL.sources, base),
  ]);

  return {
    range: { from, to, prevFrom, prevTo },
    fx: config.fxCopPerUsd,
    googleCurrency: currency[0]?.currency || 'COP',
    exportFrom: config.ga4ExportCompleteFrom,
    generatedAt: new Date().toISOString(),
    meta, metaStarts, googleDaily, googleConv, googleCampaigns, x,
    events, cohorts, versions, engage, sources,
  };
}

/**
 * Datos del dashboard con caché de 3 horas por rango.
 * Las fuentes se actualizan una vez por día, así que no hace falta consultar BigQuery en cada visita.
 */
export const getDashboardData = unstable_cache(load, ['plenti-dashboard-v1'], { revalidate: 3 * 3600 });
