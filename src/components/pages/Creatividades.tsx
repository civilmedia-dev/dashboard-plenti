import { Model, groupBy, sum } from '@/lib/model';
import { SD, div, fmtInt, fmtMoney, fmtPct } from '@/lib/format';
import { creativeKey, osFromName } from '@/lib/classify';
import { daysBetween, ddmm, weekStart } from '@/lib/dates';
import { Card, Section, Table, type Cell } from '../ui';
import { COLORS, LineChart } from '../charts';

/** Color de calor: verde barato, rosa caro. */
function heat(t: number): string {
  const a = [2, 233, 67], b = [255, 63, 180];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgba(${c[0]},${c[1]},${c[2]},0.22)`;
}

export default function Creatividades({ m }: { m: Model }) {
  const money = (v: number | null) => fmtMoney(v, m.cur, m.fx);
  const cur = m.d.meta.filter((r) => m.in(r.date) && m.osOk(osFromName(r.campaign)));
  const starts = new Map<string, string>();
  for (const s of m.d.metaStarts) {
    const k = `${creativeKey(s.ad)}|${osFromName(s.campaign)}`;
    const prev = starts.get(k);
    if (!prev || s.firstDate < prev) starts.set(k, s.firstDate);
  }

  const groups = Array.from(groupBy(cur, (r) => `${creativeKey(r.ad)}|${osFromName(r.campaign)}`).entries())
    .map(([k, rs]) => {
      const [ad, os] = k.split('|');
      return {
        k, ad, os, rs,
        s: sum(rs, (r) => r.spend),
        c: sum(rs, (r) => r.linkClicks),
        i: sum(rs, (r) => r.impressions),
      };
    })
    .sort((a, b) => b.s - a.s);

  const cpcs = groups.map((g) => div(g.s, g.c)).filter((v): v is number => v !== null);
  const lo = Math.min(...cpcs), hi = Math.max(...cpcs);

  const rows: Cell[][] = groups.map((g) => {
    const cpc = div(g.s, g.c);
    const t = cpc === null || hi === lo ? 0.5 : (cpc - lo) / (hi - lo);
    const first = starts.get(g.k);
    const onAir = first ? daysBetween(first, m.d.range.to) + 1 : null;
    return [
      g.ad, 'Meta', g.os, money(g.s), fmtInt(g.c), fmtPct(div(g.c, g.i), 2),
      { text: money(cpc), style: cpc === null ? undefined : { background: heat(t), color: '#fff' } },
      SD, SD, SD, onAir === null ? SD : fmtInt(onAir),
    ];
  });

  // Fatiga: CTR de link semanal de los 3 anuncios con más inversión
  const top = groups.slice(0, 3);
  const weeks = Array.from(new Set(cur.map((r) => weekStart(r.date)))).sort();
  const palette = [COLORS.white, COLORS.pink, COLORS.tint];
  const series = top.map((g, i) => {
    const byW = groupBy(g.rs, (r) => weekStart(r.date));
    return {
      name: `${g.ad} (${g.os})`,
      color: palette[i],
      values: weeks.map((w) => {
        const rs = byW.get(w);
        if (!rs) return null;
        const v = div(sum(rs, (r) => r.linkClicks), sum(rs, (r) => r.impressions));
        return v === null ? null : v * 100;
      }),
    };
  });

  return (
    <div className="grid">
      <Section title="Resultados principales" sub="Copias del mismo anuncio agrupadas bajo una sola creatividad." />
      <Card
        title="Ranking de anuncios por inversión"
        note="Mapa de calor en CPC de link: verde más barato, rosa más caro. Verificaciones por anuncio se completan cuando Windsor traiga los eventos de app de Meta. Días al aire desde el primer día con inversión."
      >
        <Table
          cols={[{ label: 'Anuncio', left: true }, { label: 'Plataforma', left: true }, { label: 'SO', left: true }, { label: 'Inversión' }, { label: 'Clics de link' }, { label: 'CTR de link' }, { label: 'CPC de link' }, { label: 'Verificaciones' }, { label: 'Costo por verif.' }, { label: 'Verif. a primera tx' }, { label: 'Días al aire' }]}
          rows={rows}
        />
      </Card>

      <Section title="Diagnóstico" sub="Fatiga creativa: CTR que cae semana a semana con la misma creatividad." />
      <Card title="CTR de link semanal de los 3 anuncios con más inversión (%)">
        {weeks.length >= 2 ? (
          <LineChart
            label="CTR de link semanal"
            labels={weeks.map((w) => `Sem. ${ddmm(w)}`)}
            series={series}
            format={(v) => `${v.toFixed(1).replace('.', ',')}%`}
          />
        ) : (
          <p className="cnote">Elegí un período de al menos dos semanas para ver la tendencia.</p>
        )}
      </Card>
    </div>
  );
}
