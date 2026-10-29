import { Model, groupBy, sum } from '@/lib/model';
import { SD, div, fmtInt, fmtMoney, fmtNum, fmtPct } from '@/lib/format';
import { networkGroup, osFromName } from '@/lib/classify';
import { daysBetween } from '@/lib/dates';
import { Card, OsTable, Section, Table } from '../ui';
import { COLORS, StackBars } from '../charts';

type O = 'todos' | 'Android' | 'iOS';

export default function Google({ m }: { m: Model }) {
  const money = (v: number | null) => fmtMoney(v, m.cur, m.fx);
  const g2u = m.googleToUsd;
  const daily = m.d.googleDaily.filter((r) => m.in(r.date));
  const sp = (os: O) => m.spendUsd('cur', { channel: 'Google Ads', os });
  const conv = (k: Parameters<Model['googleConv']>[0], os: O) => m.googleConv(k, 'cur', os);

  // CPA objetivo promedio de las campañas activas del SO (en USD)
  const target = (os: O) => {
    const cs = m.d.googleCampaigns.filter((c) => c.targetCpa && (os === 'todos' || osFromName(c.name) === os));
    return cs.length ? (sum(cs, (c) => c.targetCpa ?? 0) / cs.length) * g2u : null;
  };
  const ratio = (os: O) => {
    const cpa = div(sp(os), conv('verification', os));
    const t = target(os);
    const r = div(cpa, t);
    return r === null ? SD : fmtNum(r, 2);
  };
  const row = (label: string, f: (os: O) => string): [string, string, string, string] => [label, f('todos'), f('Android'), f('iOS')];
  const osRows = [
    row('Inversión', (o) => money(sp(o))),
    row('Verificaciones', (o) => fmtInt(conv('verification', o))),
    row('Costo por verificación (CPA)', (o) => money(div(sp(o), conv('verification', o)))),
    row('Primeras transacciones', (o) => fmtInt(conv('first_tx', o))),
    row('Costo por primera transacción', (o) => money(div(sp(o), conv('first_tx', o)))),
    row('CPA real / CPA objetivo', ratio),
  ];

  // Conversiones por campaña y acción
  const spendByCamp = new Map<string, number>();
  for (const r of daily) spendByCamp.set(r.campaignId, (spendByCamp.get(r.campaignId) ?? 0) + r.cost * g2u);
  const targetByCamp = new Map(m.d.googleCampaigns.map((c) => [c.campaignId, c.targetCpa]));
  const convRows = Array.from(
    groupBy(m.gConv.filter((r) => m.in(r.date) && m.osOk(r.os)), (r) => `${r.campaignId}|${r.action}`).entries(),
  )
    .map(([, rs]) => ({ r: rs[0], n: sum(rs, (x) => x.conversions) }))
    .sort((a, b) => (a.r.campaign === b.r.campaign ? b.n - a.n : a.r.campaign < b.r.campaign ? -1 : 1))
    .map(({ r, n }) => {
      const s = spendByCamp.get(r.campaignId) ?? 0;
      const t = r.kind === 'verification' ? targetByCamp.get(r.campaignId) : null;
      return [r.campaign, r.os, r.action, fmtInt(n), money(div(s, n)), t ? money(t * g2u) : ''];
    });

  // Presupuesto y consumo
  const nDays = daysBetween(m.d.range.from, m.d.range.to) + 1;
  const budgetRows = m.d.googleCampaigns
    .filter((c) => m.osOk(osFromName(c.name)))
    .map((c) => {
      const avg = (spendByCamp.get(c.campaignId) ?? 0) / nDays;
      const b = c.budget === null ? null : c.budget * g2u;
      return { c, avg, b };
    })
    .sort((a, b) => b.avg - a.avg)
    .map(({ c, avg, b }) => [c.name, osFromName(c.name), money(b), money(avg), fmtPct(div(avg, b))]);

  // Red
  const netColors = { Search: COLORS.blue, YouTube: COLORS.pink, Display: COLORS.violet, Otras: COLORS.tint };
  const netRows = (['Android', 'iOS'] as const).filter((os) => m.osOk(os)).map((os) => {
    const rs = daily.filter((r) => osFromName(r.campaign) === os);
    const by = groupBy(rs, (r) => networkGroup(r.network));
    return {
      label: os,
      parts: (['Search', 'YouTube', 'Display', 'Otras'] as const)
        .map((n) => ({ name: n, color: netColors[n], value: sum(by.get(n) ?? [], (r) => r.cost) }))
        .filter((p) => p.value > 0),
    };
  });

  // Entrega
  const del = (label: string, os: O) => {
    const rs = daily.filter((r) => os === 'todos' || osFromName(r.campaign) === os);
    const s = sum(rs, (r) => r.cost) * g2u, c = sum(rs, (r) => r.clicks), i = sum(rs, (r) => r.impressions);
    return [label, fmtPct(div(c, i), 2), money(div(s, c)), money(div(s * 1000, i)), fmtPct(div(conv('install', os), c))];
  };
  const delRows = [
    ...(['Android', 'iOS'] as const).filter((os) => m.osOk(os)).map((os) => del(os, os)),
    ...(m.os === 'todos' ? [del('Consolidado', 'todos')] : []),
  ];

  return (
    <div className="grid">
      <Section title="Resultados principales" sub="Consolidado y separado por campañas de Android e iOS. Conversiones según la acción de cada evento." />
      <Card
        title="Resultados de Google Ads por sistema operativo"
        note="iOS: las conversiones se importan desde GA4 y dependen de su atribución. CPA objetivo según los grupos de anuncios activos; por debajo de 1 hay margen para entregar."
      >
        <OsTable rows={osRows} />
      </Card>

      <Section title="Detalle" />
      <Card title="Conversiones por campaña y acción" note="Cada acción por separado; no se usa la columna total de Conversiones.">
        <Table
          cols={[{ label: 'Campaña', left: true }, { label: 'SO', left: true }, { label: 'Acción', left: true }, { label: 'Conversiones' }, { label: 'Costo por acción' }, { label: 'CPA objetivo' }]}
          rows={convRows}
        />
      </Card>
      <Card title="Presupuesto diario y consumo (campañas activas)" note={`Gasto promedio diario del período (${nDays} días) sobre el presupuesto diario actual.`}>
        <Table
          cols={[{ label: 'Campaña', left: true }, { label: 'SO', left: true }, { label: 'Presupuesto diario' }, { label: 'Gasto promedio diario' }, { label: 'Consumo' }]}
          rows={budgetRows}
        />
      </Card>

      <Section title="Diagnóstico" sub="Dónde corre la inversión y calidad del tráfico." />
      <Card title="Distribución de la inversión por red" span={6}>
        <StackBars label="Inversión por red" rows={netRows} />
      </Card>
      <Card title="Entrega y tráfico por SO" span={6} note="Clic a first open: instalaciones reportadas por Google Ads sobre clics.">
        <Table
          cols={[{ label: 'SO', left: true }, { label: 'CTR' }, { label: 'CPC' }, { label: 'CPM' }, { label: 'Clic a first open' }]}
          rows={delRows}
          rowClass={(i) => (i === delRows.length - 1 && m.os === 'todos' ? 'sub' : undefined)}
        />
      </Card>
    </div>
  );
}
