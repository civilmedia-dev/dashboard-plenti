/** Modelo de datos del lado del cliente: filtra por período y SO, y normaliza monedas a USD. */
import { convKind, osFromName, type ConvKind } from './classify';
import type { AppEventName, Currency, OS, OsFilter, Payload } from './types';

export type PaidChannel = 'Google Ads' | 'Meta Ads' | 'X Ads';
export const PAID: PaidChannel[] = ['Google Ads', 'Meta Ads', 'X Ads'];
export const OSES: Array<'Android' | 'iOS'> = ['Android', 'iOS'];

export interface SpendRow { date: string; channel: PaidChannel; os: OS; usd: number }
export interface GoogleConv { date: string; campaignId: string; campaign: string; action: string; kind: ConvKind; os: OS; conversions: number }

export type Which = 'cur' | 'prev';

export class Model {
  readonly d: Payload;
  readonly os: OsFilter;
  readonly cur: Currency;
  readonly fx: number;
  readonly spend: SpendRow[];
  readonly gConv: GoogleConv[];

  constructor(d: Payload, os: OsFilter, cur: Currency) {
    this.d = d;
    this.os = os;
    this.cur = cur;
    this.fx = d.fx;
    const gToUsd = d.googleCurrency === 'USD' ? 1 : 1 / d.fx;
    this.spend = [
      ...d.meta.map((r) => ({ date: r.date, channel: 'Meta Ads' as const, os: osFromName(r.campaign), usd: r.spend })),
      ...d.googleDaily.map((r) => ({ date: r.date, channel: 'Google Ads' as const, os: osFromName(r.campaign), usd: r.cost * gToUsd })),
      ...d.x.map((r) => ({ date: r.date, channel: 'X Ads' as const, os: osFromName(r.campaign), usd: r.spend / d.fx })),
    ];
    this.gConv = d.googleConv.map((r) => ({ ...r, kind: convKind(r.action), os: osFromName(r.campaign) }));
  }

  /** Factor para pasar montos de Google Ads (moneda de la cuenta) a USD. */
  get googleToUsd(): number {
    return this.d.googleCurrency === 'USD' ? 1 : 1 / this.fx;
  }

  in(date: string, w: Which = 'cur'): boolean {
    const r = this.d.range;
    return w === 'cur' ? date >= r.from && date <= r.to : date >= r.prevFrom && date <= r.prevTo;
  }

  /** ¿La fila entra en el filtro de SO? En Consolidado entra todo, incluso "Sin definir". */
  osOk(os: OS | string): boolean {
    return this.os === 'todos' || os === this.os;
  }

  /** Inversión en USD. */
  spendUsd(w: Which = 'cur', opts: { channel?: PaidChannel; os?: OS | 'todos' } = {}): number {
    const osSel = opts.os ?? this.os;
    return this.spend
      .filter((r) => this.in(r.date, w) && (!opts.channel || r.channel === opts.channel) && (osSel === 'todos' || r.os === osSel))
      .reduce((a, r) => a + r.usd, 0);
  }

  /** ¿Hay inversión del canal en el período (cualquier SO)? */
  hasSpend(channel: PaidChannel, w: Which = 'cur'): boolean {
    return this.spend.some((r) => r.channel === channel && this.in(r.date, w));
  }

  /** Usuarios únicos por día sumados, para un evento de la app. */
  appEvent(ev: AppEventName, w: Which = 'cur', os: OsFilter = this.os): number {
    return this.d.events
      .filter((r) => r.event === ev && this.in(r.date, w) && (os === 'todos' || r.os === os))
      .reduce((a, r) => a + r.users, 0);
  }

  /** Conversiones de Google Ads por tipo de acción. */
  googleConv(kind: ConvKind, w: Which = 'cur', os: OS | 'todos' = this.os): number | null {
    const rows = this.gConv.filter((r) => r.kind === kind && this.in(r.date, w) && (os === 'todos' || r.os === os));
    if (!rows.length) return null;
    return rows.reduce((a, r) => a + r.conversions, 0);
  }

  /** Último día con datos de cada fuente (en todo lo traído). */
  freshness(): Array<{ label: string; date: string | null }> {
    const max = (xs: string[]) => (xs.length ? xs.reduce((a, b) => (a > b ? a : b)) : null);
    return [
      { label: 'X Ads', date: max(this.d.x.map((r) => r.date)) },
      { label: 'Meta Ads', date: max(this.d.meta.map((r) => r.date)) },
      { label: 'Google Ads', date: max(this.d.googleDaily.map((r) => r.date)) },
      { label: 'Firebase', date: max(this.d.events.map((r) => r.date)) },
    ];
  }

  /** Último día con export de Firebase. */
  exportEnd(): string | null {
    const xs = this.d.engage.map((r) => r.date);
    return xs.length ? xs.reduce((a, b) => (a > b ? a : b)) : null;
  }
}

export function sum<T>(xs: T[], f: (x: T) => number): number {
  return xs.reduce((a, x) => a + (f(x) || 0), 0);
}

export function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const arr = m.get(k);
    if (arr) arr.push(x);
    else m.set(k, [x]);
  }
  return m;
}
