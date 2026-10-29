'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { Model } from '@/lib/model';
import { ddmm, ddmmyyyy, periodRange, type PeriodKey } from '@/lib/dates';
import type { Currency, OsFilter, Payload } from '@/lib/types';
import Resumen from './pages/Resumen';
import Funnel from './pages/Funnel';
import Cohortes from './pages/Cohortes';
import Meta from './pages/Meta';
import Google from './pages/Google';
import X from './pages/X';
import Creatividades from './pages/Creatividades';
import Producto from './pages/Producto';
import Medicion from './pages/Medicion';

interface PageDef {
  id: string;
  title: string;
  desc: string;
  sources: string[];
  C: ComponentType<{ m: Model }>;
}

const PAGES: PageDef[] = [
  { id: 'resumen', title: 'Resumen ejecutivo', desc: '¿Cuánto invertimos, cuántos usuarios de calidad conseguimos y a qué costo? Consolidado y por sistema operativo.', sources: ['Firebase (eventos de la app)', 'Google Ads, Meta Ads y X Ads (inversión)'], C: Resumen },
  { id: 'funnel', title: 'Funnel y costo por canal', desc: 'Comparar canales y sistemas operativos en cada etapa: instalación, registro, verificación y primera transacción.', sources: ['Firebase (eventos de la app)', 'Google Ads, Meta Ads y X Ads (inversión y conversiones)'], C: Funnel },
  { id: 'cohortes', title: 'Calidad por cohorte', desc: '¿Los usuarios adquiridos verifican, transaccionan y vuelven? Por semana de instalación, canal y sistema operativo.', sources: ['Firebase (export diario, provisorio hasta conectar Singular)'], C: Cohortes },
  { id: 'meta', title: 'Meta Ads', desc: 'Resultados de Meta consolidados y por campañas de Android e iOS.', sources: ['Meta Ads (Windsor a BigQuery)'], C: Meta },
  { id: 'google', title: 'Google Ads', desc: 'Resultados de Google consolidados y por campañas de Android e iOS.', sources: ['Google Ads (BigQuery Data Transfer)', 'Conversiones de iOS importadas desde GA4'], C: Google },
  { id: 'x', title: 'X Ads', desc: 'Resultados de X consolidados y por sistema operativo.', sources: ['X Ads (Windsor a BigQuery)'], C: X },
  { id: 'creatividades', title: 'Creatividades', desc: 'Qué anuncios generan verificaciones y usuarios que transaccionan, y cuáles muestran fatiga.', sources: ['Meta Ads (Windsor a BigQuery)'], C: Creatividades },
  { id: 'producto', title: 'Producto e in-app', desc: 'Cómo se comportan los usuarios dentro de la app, en Android e iOS.', sources: ['Firebase (eventos de la app, export a BigQuery)'], C: Producto },
  { id: 'medicion', title: 'Control de medición', desc: 'Detectar problemas de tracking comparando el mismo evento entre fuentes.', sources: ['Google Analytics 4 (primera fuente / medio)', 'Firebase', 'Google Ads', 'Meta Ads', 'X Ads'], C: Medicion },
];

const PERIODS: Array<[PeriodKey, string]> = [
  ['7d', 'Últimos 7 días'],
  ['14d', 'Últimos 14 días'],
  ['30d', 'Últimos 30 días'],
  ['mtd', 'Mes en curso'],
  ['mes_anterior', 'Mes anterior'],
  ['custom', 'Personalizado'],
];

function pageFromHash(): string {
  if (typeof window === 'undefined') return 'resumen';
  const h = window.location.hash.slice(1);
  return PAGES.some((p) => p.id === h) ? h : 'resumen';
}

export default function Dashboard() {
  const [page, setPage] = useState('resumen');
  const [period, setPeriod] = useState<PeriodKey>('14d');
  const [custom, setCustom] = useState(() => periodRange('14d'));
  const [os, setOs] = useState<OsFilter>('todos');
  const [cur, setCur] = useState<Currency>('USD');
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => periodRange(period, custom), [period, custom]);

  useEffect(() => {
    const on = () => {
      setPage(pageFromHash());
      window.scrollTo(0, 0);
    };
    on();
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const load = useCallback(async (from: string, to: string, signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/data?from=${from}&to=${to}`, { signal });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'No se pudieron cargar los datos.');
      setData(body as Payload);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError((e as Error).message);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctl = new AbortController();
    load(range.from, range.to, ctl.signal);
    return () => ctl.abort();
  }, [range.from, range.to, load]);

  const model = useMemo(() => (data ? new Model(data, os, cur) : null), [data, os, cur]);
  const def = PAGES.find((p) => p.id === page) ?? PAGES[0];
  const idx = PAGES.indexOf(def) + 1;
  const fresh = model?.freshness() ?? [];

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <>
      <header className="top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Civil Mafia" className="logo" width={120} height={34} />
        <div className="ttl">
          <b>Plenti | Performance</b>
          <span>Inversión, volumen y calidad de usuarios por canal y sistema operativo</span>
        </div>
        <div className="fresh">
          {fresh.length > 0 && (
            <>
              Datos hasta:{' '}
              {fresh.map((f, i) => (
                <span key={f.label}>{i > 0 && ', '}{f.label} <b>{f.date ? ddmm(f.date) : 's/d'}</b></span>
              ))}
              <br />
            </>
          )}
          Las fuentes se actualizan una vez por día ·{' '}
          <button type="button" className="linkbtn" onClick={logout}>Cerrar sesión</button>
        </div>
      </header>
      <div className="layout">
        <nav className="pages" aria-label="Páginas del dashboard">
          {PAGES.map((p, i) => (
            <a key={p.id} href={`#${p.id}`} className={p.id === def.id ? 'on' : undefined} aria-current={p.id === def.id ? 'page' : undefined}>
              {i + 1}. {p.title}
            </a>
          ))}
        </nav>
        <main>
          <div className="canvas">
            <div className="ph">
              <div>
                <h1>{idx}. {def.title}</h1>
                <p>{def.desc}</p>
                <div className="src">
                  <b>Fuente de datos:</b>
                  {def.sources.map((s) => <em key={s}>{s}</em>)}
                </div>
              </div>
              <div className="fl" aria-busy={loading}>
                <label>
                  Período
                  <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodKey)}>
                    {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </label>
                {period === 'custom' && (
                  <>
                    <label>
                      Desde
                      <input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
                    </label>
                    <label>
                      Hasta
                      <input type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
                    </label>
                  </>
                )}
                <label>
                  Sistema operativo
                  <select value={os} onChange={(e) => setOs(e.target.value as OsFilter)}>
                    <option value="todos">Consolidado</option>
                    <option value="Android">Android</option>
                    <option value="iOS">iOS</option>
                  </select>
                </label>
                <label>
                  Moneda
                  <select value={cur} onChange={(e) => setCur(e.target.value as Currency)}>
                    <option value="USD">USD</option>
                    <option value="COP">COP</option>
                  </select>
                </label>
              </div>
            </div>

            {data && (
              <div className="src" style={{ marginTop: -6, marginBottom: 14 }}>
                Período: {ddmmyyyy(data.range.from)} al {ddmmyyyy(data.range.to)}. Comparación: {ddmmyyyy(data.range.prevFrom)} al {ddmmyyyy(data.range.prevTo)}.
                {cur === 'COP' || data.googleCurrency === 'COP' ? ` TRM de referencia: ${data.fx.toLocaleString('es-CO')} COP por USD.` : ''}
              </div>
            )}

            {error && (
              <div className="err" role="alert">
                <b>No se pudieron cargar los datos.</b> {error}
              </div>
            )}
            {!error && loading && !model && (
              <div className="grid" aria-label="Cargando">
                {[0, 1, 2, 3].map((i) => <div key={i} className="c skel" style={{ gridColumn: 'span 6' }} />)}
              </div>
            )}
            {!error && model && (
              <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .2s' }}>
                <def.C m={model} />
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
