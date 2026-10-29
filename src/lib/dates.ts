/** Utilidades de fechas en texto YYYY-MM-DD (sin zonas horarias). */

export function parseISO(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  const x = parseISO(d);
  x.setUTCDate(x.getUTCDate() + n);
  return toISO(x);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Lunes de la semana de la fecha. */
export function weekStart(d: string): string {
  const x = parseISO(d);
  const dow = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - dow);
  return toISO(x);
}

export function ddmm(d: string): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

export function ddmmyyyy(d: string): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

/** Hoy en Colombia (UTC-5, sin horario de verano). */
export function todayBogota(): string {
  return toISO(new Date(Date.now() - 5 * 3600 * 1000));
}

export type PeriodKey = '7d' | '14d' | '30d' | 'mtd' | 'mes_anterior' | 'custom';

/** Rango del período elegido. Termina ayer (hora de Colombia), salvo personalizado. */
export function periodRange(key: PeriodKey, custom?: { from: string; to: string }): { from: string; to: string } {
  const yesterday = addDays(todayBogota(), -1);
  switch (key) {
    case '7d':
      return { from: addDays(yesterday, -6), to: yesterday };
    case '30d':
      return { from: addDays(yesterday, -29), to: yesterday };
    case 'mtd': {
      const first = `${yesterday.slice(0, 8)}01`;
      return { from: first, to: yesterday };
    }
    case 'mes_anterior': {
      const firstThis = parseISO(`${yesterday.slice(0, 8)}01`);
      const lastPrev = new Date(firstThis.getTime() - 86400000);
      const firstPrev = new Date(Date.UTC(lastPrev.getUTCFullYear(), lastPrev.getUTCMonth(), 1));
      return { from: toISO(firstPrev), to: toISO(lastPrev) };
    }
    case 'custom':
      if (custom && custom.from && custom.to && custom.from <= custom.to) return custom;
      return { from: addDays(yesterday, -13), to: yesterday };
    case '14d':
    default:
      return { from: addDays(yesterday, -13), to: yesterday };
  }
}

/** Período de comparación: misma cantidad de días, inmediatamente antes. */
export function previousRange(from: string, to: string): { prevFrom: string; prevTo: string } {
  const len = daysBetween(from, to) + 1;
  return { prevFrom: addDays(from, -len), prevTo: addDays(from, -1) };
}

export const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
