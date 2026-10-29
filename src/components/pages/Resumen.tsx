import { Model, OSES, PAID } from '@/lib/model';
import { SD, delta, deltaPp, div, fmtInt, fmtMoney, fmtPct } from '@/lib/format';
import { eachDay, ddmm } from '@/lib/dates';
import { Card, Kpi, Section, Table, type Cell } from '../ui';
import { COLORS, LineChart } from '../charts';

export default function Resumen({ m }: { m: Model }) {
  const money = (v: number | null) => fmtMoney(v, m.cur, m.fx);
  const sp = m.spendUsd('cur'), spP = m.spendUsd('prev');
  const ve = m.appEvent('verification_completed'), veP = m.appEvent('verification_completed', 'prev');
  const ft = m.appEvent('first_transaction'), ftP = m.appEvent('first_transaction', 'prev');
  const fo = m.appEvent('first_open');

  const rows: Cell[][] = [];
  const sub: number[] = [];
  const oses = m.os === 'todos' ? OSES : [m.os];
  for (const ch of PAID) {
    for (const os of oses) {
      const s = m.spendUsd('cur', { channel: ch, os });
      const isG = ch === 'Google Ads';
      const inst = isG ? m.googleConv('install', 'cur', os) : null;
      const v = isG ? m.googleConv('verification', 'cur', os) : null;
      const f = isG ? m.googleConv('first_tx', 'cur', os) : null;
      rows.push([ch, os, s > 0 ? money(s) : SD, fmtInt(inst), fmtInt(v), money(div(s, v)), fmtInt(f), fmtPct(div(f, v))]);
    }
    if (m.os === 'todos') {
      const s = m.spendUsd('cur', { channel: ch, os: 'todos' });
      const isG = ch === 'Google Ads';
      const inst = isG ? m.googleConv('install', 'cur', 'todos') : null;
      const v = isG ? m.googleConv('verification', 'cur', 'todos') : null;
      const f = isG ? m.googleConv('first_tx', 'cur', 'todos') : null;
      sub.push(rows.length);
      rows.push([ch, 'Consolidado', s > 0 ? money(s) : SD, fmtInt(inst), fmtInt(v), money(div(s, v)), fmtInt(f), fmtPct(div(f, v))]);
    }
  }
  sub.push(rows.length);
  rows.push(['Total app (Firebase)', m.os === 'todos' ? 'Consolidado' : m.os, money(sp), fmtInt(fo), fmtInt(ve), money(div(sp, ve)), fmtInt(ft), fmtPct(div(ft, ve))]);

  const days = eachDay(m.d.range.from, m.d.range.to);
  const fbByDay = days.map((d) => {
    const r = m.d.events.filter((e) => e.date === d && e.event === 'verification_completed' && m.osOk(e.os));
    return r.length ? r.reduce((a, e) => a + e.users, 0) : null;
  });
  const gByDay = days.map((d) => {
    const r = m.gConv.filter((c) => c.date === d && c.kind === 'verification' && m.osOk(c.os));
    return r.length ? r.reduce((a, c) => a + c.conversions, 0) : null;
  });

  return (
    <div className="grid">
      <Section title="Resultados principales" sub="Verificaciones y primeras transacciones: total de la app según Firebase, incluye orgánico. El costo divide la inversión paga por ese total." />
      <Kpi title={`Inversión (${m.cur})`} value={money(sp)} d={delta(sp, spP, true)} />
      <Kpi title="Verificaciones" value={fmtInt(ve)} d={delta(ve, veP, true)} />
      <Kpi title="Costo por verificación" value={money(div(sp, ve))} d={delta(div(sp, ve), div(spP, veP), false)} />
      <Kpi title="Primeras transacciones" value={fmtInt(ft)} d={delta(ft, ftP, true)} />
      <Kpi title="Costo por primera tx" value={money(div(sp, ft))} d={delta(div(sp, ft), div(spP, ftP), false)} />
      <Kpi title="Verificación a primera tx" value={fmtPct(div(ft, ve))} d={deltaPp(div(ft, ve), div(ftP, veP), true)} />

      <Section title="Por canal y sistema operativo" sub="Instalaciones, verificaciones y primeras transacciones según la atribución de cada plataforma. No se suman entre canales." />
      <Card
        title="Resultados por canal y sistema operativo"
        note="Meta Ads: los eventos de app todavía no llegan por Windsor. Google Ads: primeras transacciones s/d mientras no sea una acción de conversión. X Ads: el conector trae inversión y clics; las campañas sin SO en el nombre suman solo en Consolidado."
      >
        <Table
          cols={[{ label: 'Canal', left: true }, { label: 'SO', left: true }, { label: `Inversión ${m.cur}` }, { label: 'Instalaciones' }, { label: 'Verificaciones' }, { label: 'Costo por verif.' }, { label: 'Primeras tx' }, { label: 'Verif. a primera tx' }]}
          rows={rows}
          rowClass={(i) => (sub.includes(i) ? 'sub' : undefined)}
        />
      </Card>

      <Section title="Evolución" />
      <Card title="Verificaciones por día">
        <LineChart
          label="Verificaciones por día"
          labels={days.map(ddmm)}
          series={[
            { name: 'Total app (Firebase)', color: COLORS.white, values: fbByDay },
            { name: 'Google Ads (reportado por la plataforma)', color: COLORS.tint, values: gByDay },
          ]}
        />
      </Card>
    </div>
  );
}
