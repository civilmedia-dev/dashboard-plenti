import type { ReactNode } from 'react';
import type { Tone } from '@/lib/format';

export function Section({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="sec">
      <b>{title}</b>
      {sub && <span>{sub}</span>}
    </div>
  );
}

export function Kpi({ title, value, d }: { title: string; value: string; d?: { text: string; tone: Tone } }) {
  return (
    <div className="c half-sm" style={{ gridColumn: 'span 2' }}>
      <h3>{title}</h3>
      <div className="sv">{value}</div>
      {d && <div className={`sd ${d.tone}`}>{d.text}</div>}
    </div>
  );
}

export function Card({ title, span = 12, children, note }: { title: string; span?: number; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="c" style={{ gridColumn: `span ${span}` }}>
      <h3>{title}</h3>
      {children}
      {note && <div className="cnote">{note}</div>}
    </div>
  );
}

export interface Col {
  label: string;
  left?: boolean;
}

export type Cell = string | { text: string; style?: React.CSSProperties; className?: string };

export function Table({
  cols, rows, className, rowClass,
}: {
  cols: Col[];
  rows: Cell[][];
  className?: string;
  rowClass?: (i: number) => string | undefined;
}) {
  return (
    <div className="tw">
      <table className={className}>
        <thead>
          <tr>{cols.map((c) => <th key={c.label} className={c.left ? 'l' : undefined}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td className="l" colSpan={cols.length}>Sin datos en el período.</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className={rowClass?.(i)}>
              {r.map((cell, j) => {
                const c = typeof cell === 'string' ? { text: cell } : cell;
                const cls = [cols[j]?.left ? 'l' : '', c.className ?? ''].join(' ').trim() || undefined;
                return <td key={j} className={cls} style={c.style}>{c.text}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tabla de métricas con columnas Consolidado / Android / iOS. */
export function OsTable({ rows }: { rows: Array<[string, string, string, string]> }) {
  return (
    <Table
      className="osm"
      cols={[{ label: 'Métrica', left: true }, { label: 'Consolidado' }, { label: 'Android' }, { label: 'iOS' }]}
      rows={rows.map(([m, c, a, i]) => [m, { text: c, className: 'cons' }, a, i])}
    />
  );
}

export function Note({ kind = 'info', children }: { kind?: 'info' | 'empty'; children: ReactNode }) {
  return <div className={kind}>{children}</div>;
}
