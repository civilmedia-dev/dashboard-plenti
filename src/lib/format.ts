/** Formato numérico colombiano: miles con punto, decimales con coma. */
import type { Currency } from './types';

export const SD = 's/d';

function group(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return SD;
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(decimals);
  const [i, d] = fixed.split('.');
  return `${neg ? '-' : ''}${group(i)}${d ? `,${d}` : ''}`;
}

export function fmtInt(n: number | null | undefined): string {
  return fmtNum(n, 0);
}

export function fmtPct(r: number | null | undefined, decimals = 1): string {
  if (r === null || r === undefined || !Number.isFinite(r)) return SD;
  return `${fmtNum(r * 100, decimals)}%`;
}

/** Monto a partir de USD. En COP se multiplica por la TRM. */
export function fmtMoney(usd: number | null | undefined, cur: Currency, fx: number): string {
  if (usd === null || usd === undefined || !Number.isFinite(usd)) return SD;
  if (cur === 'COP') return `COP ${fmtNum(usd * fx, 0)}`;
  return Math.abs(usd) >= 1000 ? `USD ${fmtNum(usd, 0)}` : `USD ${fmtNum(usd, 2)}`;
}

/** Divide y devuelve null cuando no se puede calcular. */
export function div(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return a / b;
}

export type Tone = 'g' | 'b' | '';

/** Variación vs período anterior. higherIsBetter define el color. */
export function delta(cur: number | null, prev: number | null, higherIsBetter: boolean): { text: string; tone: Tone } {
  const r = cur !== null && prev !== null && prev !== 0 ? cur / prev - 1 : null;
  if (r === null || !Number.isFinite(r)) return { text: 'Sin comparación', tone: '' };
  const pct = Math.round(r * 100);
  const tone: Tone = pct === 0 ? '' : (pct > 0) === higherIsBetter ? 'g' : 'b';
  return { text: `${pct > 0 ? '+' : ''}${pct}% vs período anterior`, tone };
}

/** Variación en puntos porcentuales para tasas. */
export function deltaPp(cur: number | null, prev: number | null, higherIsBetter: boolean): { text: string; tone: Tone } {
  if (cur === null || prev === null) return { text: 'Sin comparación', tone: '' };
  const pp = (cur - prev) * 100;
  const rounded = Math.round(pp * 10) / 10;
  const tone: Tone = rounded === 0 ? '' : (rounded > 0) === higherIsBetter ? 'g' : 'b';
  return { text: `${rounded > 0 ? '+' : ''}${fmtNum(rounded, 1)} pp vs período anterior`, tone };
}
