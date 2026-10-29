import { fmtNum } from '@/lib/format';

export const COLORS = {
  blue: '#2a00ff',
  tint: '#6d55ff',
  green: '#02e943',
  pink: '#ff3fb4',
  violet: '#7803ff',
  white: 'var(--chart-primary)',
};

const AXIS = 'var(--chart-axis)';
const GRID = 'var(--chart-grid)';

function onBar(color: string): string {
  return color === COLORS.green || color === COLORS.pink ? '#111318' : '#fff';
}

export interface Series {
  name: string;
  color: string;
  values: Array<number | null>;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * p;
}

export function Legend({ items }: { items: Array<{ name: string; color: string }> }) {
  return (
    <div className="lg">
      {items.map((s) => (
        <span key={s.name}>
          <i style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

/** Líneas por día (o por categoría en el eje X). */
export function LineChart({
  labels, series, label, height = 220, format = (v: number) => fmtNum(v, 0),
}: {
  labels: string[];
  series: Series[];
  label: string;
  height?: number;
  format?: (v: number) => string;
}) {
  const W = 1120, H = height, L = 52, R = 10, T = 16, B = 24;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null && Number.isFinite(v)));
  if (!labels.length || !all.length) return <p className="cnote">Sin datos en el período.</p>;
  const max = niceMax(Math.max(...all));
  const x = (i: number) => (labels.length === 1 ? L : L + (i * (W - L - R)) / (labels.length - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const every = Math.max(1, Math.ceil(labels.length / 8));
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={L - 6} y={y(t) + 4} fill={AXIS} fontSize="10" textAnchor="end">{format(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => (i % every === 0 ? (
          <text key={l + i} x={x(i)} y={H - 6} fill={AXIS} fontSize="10" textAnchor="middle">{l}</text>
        ) : null))}
        {series.map((s) => {
          let d = '';
          let pen = false;
          s.values.forEach((v, i) => {
            if (v === null || !Number.isFinite(v)) { pen = false; return; }
            d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
            pen = true;
          });
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.2" />
              {s.values.length <= 6 && s.values.map((v, i) => (v === null ? null : (
                <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={s.color} />
              )))}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && <Legend items={series} />}
    </>
  );
}

/** Barras horizontales con valor al final. */
export function HBars({
  items, label, labelWidth = 170, max,
}: {
  items: Array<{ label: string; value: number | null; text: string; color?: string }>;
  label: string;
  labelWidth?: number;
  max?: number;
}) {
  const W = 620, rowH = 36, barW = 330;
  const vals = items.map((i) => i.value ?? 0);
  const top = max ?? Math.max(...vals, 0);
  if (!items.length) return <p className="cnote">Sin datos en el período.</p>;
  return (
    <svg viewBox={`0 0 ${W} ${items.length * rowH + 8}`} role="img" aria-label={label}>
      {items.map((it, i) => {
        const w = top > 0 && it.value !== null ? Math.max(0, (it.value / top) * barW) : 0;
        const yy = 8 + i * rowH;
        return (
          <g key={it.label + i}>
            <text x="0" y={yy + 16} fill="var(--chart-label)" fontSize="11.5">{it.label}</text>
            <rect x={labelWidth} y={yy} width={w} height="24" fill={it.color ?? COLORS.blue} />
            <text x={labelWidth + w + 6} y={yy + 16} fill="var(--chart-text)" fontSize="11.5">{it.text}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Barras 100% apiladas por fila. */
export function StackBars({
  rows, label,
}: {
  rows: Array<{ label: string; parts: Array<{ name: string; value: number; color: string }> }>;
  label: string;
}) {
  const W = 490, L = 80, barW = W - L - 10, rowH = 44;
  const names = Array.from(new Map(rows.flatMap((r) => r.parts.map((p) => [p.name, p.color] as const))).entries());
  return (
    <>
      <svg viewBox={`0 0 ${W} ${rows.length * rowH + 10}`} role="img" aria-label={label}>
        {rows.map((r, i) => {
          const total = r.parts.reduce((a, p) => a + p.value, 0);
          let x = L;
          const yy = 12 + i * rowH;
          return (
            <g key={r.label}>
              <text x="0" y={yy + 16} fill="var(--chart-label)" fontSize="12">{r.label}</text>
              {total > 0 ? r.parts.map((p) => {
                const w = (p.value / total) * barW;
                const g = (
                  <g key={p.name}>
                    <rect x={x} y={yy} width={w} height="24" fill={p.color} />
                    {w > 30 && (
                      <text x={x + w / 2} y={yy + 16} fill={onBar(p.color)} fontSize="11" textAnchor="middle">
                        {Math.round((p.value / total) * 100)}%
                      </text>
                    )}
                  </g>
                );
                x += w;
                return g;
              }) : (
                <text x={L} y={yy + 16} fill={AXIS} fontSize="11">Sin inversión</text>
              )}
            </g>
          );
        })}
      </svg>
      <Legend items={names.map(([name, color]) => ({ name, color }))} />
    </>
  );
}
