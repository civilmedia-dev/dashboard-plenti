import { Model, groupBy, sum } from '@/lib/model';
import { SD, div, fmtInt, fmtMoney, fmtPct } from '@/lib/format';
import { osFromName } from '@/lib/classify';
import { ddmm, eachDay } from '@/lib/dates';
import { Card, Note, OsTable, Section, Table } from '../ui';
import { COLORS, LineChart } from '../charts';

type O = 'todos' | 'Android' | 'iOS';

export default function X({ m }: { m: Model }) {
  const money = (v: number | null) => fmtMoney(v, m.cur, m.fx);
  const cur = m.d.x.filter((r) => m.in(r.date));
  const forOs = (os: O) => cur.filter((r) => os === 'todos' || osFromName(r.campaign) === os);
  const sp = (os: O) => sum(forOs(os), (r) => r.spend) / m.fx;
  const cl = (os: O) => sum(forOs(os), (r) => r.clicks);
  const v = (os: O, f: (o: O) => string) => (forOs(os).length ? f(os) : SD);
  const row = (label: string, f: (o: O) => string): [string, string, string, string] =>
    [label, v('todos', f), v('Android', f), v('iOS', f)];

  const osRows = [
    row('Inversión', (o) => money(sp(o))),
    row('Clics', (o) => fmtInt(cl(o))),
    row('CPC', (o) => money(div(sp(o), cl(o)))),
    ['Instalaciones', SD, SD, SD] as [string, string, string, string],
    ['Costo por instalación', SD, SD, SD] as [string, string, string, string],
    ['Verificaciones', SD, SD, SD] as [string, string, string, string],
    ['Costo por verificación (CPA)', SD, SD, SD] as [string, string, string, string],
  ];

  const undefinedShare = div(sp('todos') - sp('Android') - sp('iOS'), sp('todos'));

  const campRows = Array.from(groupBy(forOs(m.os), (r) => r.campaign).entries())
    .map(([c, rs]) => {
      const s = sum(rs, (r) => r.spend) / m.fx, k = sum(rs, (r) => r.clicks);
      const days = new Set(rs.filter((r) => r.spend > 0).map((r) => r.date)).size;
      return { c, s, k, days };
    })
    .sort((a, b) => b.s - a.s)
    .map(({ c, s, k, days }) => [c, osFromName(c), money(s), fmtInt(k), money(div(s, k)), money(div(s, days)), SD, SD]);

  const days = eachDay(m.d.range.from, m.d.range.to);
  const series = [{
    name: m.os === 'todos' ? 'Consolidado' : m.os,
    color: COLORS.tint,
    values: days.map((d) => {
      const rs = forOs(m.os).filter((r) => r.date === d);
      return rs.length ? (sum(rs, (r) => r.spend) / m.fx) * (m.cur === 'COP' ? m.fx : 1) : null;
    }),
  }];

  return (
    <div className="grid">
      <div style={{ gridColumn: 'span 12' }}>
        <Note>
          El conector de X trae inversión y clics por campaña (en COP). Instalaciones y verificaciones de X se completan con Singular; en la página 9 se ve cuántos usuarios atribuye GA4 a X.
          {undefinedShare !== null && undefinedShare > 0 && ` En este período el ${fmtPct(undefinedShare, 0)} de la inversión está en campañas sin SO en el nombre: suman en Consolidado pero no en Android ni iOS.`}
        </Note>
      </div>
      <Section title="Resultados principales" sub="Consolidado y separado por campañas de Android e iOS. Sistema operativo según el nombre de la campaña." />
      <Card title="Resultados de X por sistema operativo">
        <OsTable rows={osRows} />
      </Card>

      <Section title="Detalle" />
      <Card title="Rendimiento por campaña" note="Ordenado por inversión. Gasto diario promedio sobre los días con inversión.">
        <Table
          cols={[{ label: 'Campaña', left: true }, { label: 'SO', left: true }, { label: 'Inversión' }, { label: 'Clics' }, { label: 'CPC' }, { label: 'Gasto diario promedio' }, { label: 'Instalaciones' }, { label: 'Verificaciones' }]}
          rows={campRows}
        />
      </Card>
      <Card title={`Inversión por día (${m.cur})`}>
        <LineChart label="Inversión de X por día" labels={days.map(ddmm)} series={series} />
      </Card>
    </div>
  );
}
