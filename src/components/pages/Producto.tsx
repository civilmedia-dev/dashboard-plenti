import { Model, groupBy, sum } from '@/lib/model';
import { div, fmtInt, fmtNum, fmtPct, SD } from '@/lib/format';
import { ddmm, ddmmyyyy, eachDay } from '@/lib/dates';
import type { OsFilter } from '@/lib/types';
import { Card, OsTable, Section, Table } from '../ui';
import { COLORS, HBars, LineChart } from '../charts';
import { appFunnel } from './Funnel';

const MIN_VERSION_USERS = 30;

export default function Producto({ m }: { m: Model }) {
  const ev = (e: Parameters<Model['appEvent']>[0], os: OsFilter) => fmtInt(m.appEvent(e, 'cur', os));
  const row = (label: string, f: (os: OsFilter) => string): [string, string, string, string] => [label, f('todos'), f('Android'), f('iOS')];
  const osRows = [
    row('Usuarios nuevos (first_open)', (o) => ev('first_open', o)),
    row('Registros (signup_success)', (o) => ev('signup_success', o)),
    row('Verificaciones (verification_completed)', (o) => ev('verification_completed', o)),
    row('Primeras transacciones (first_transaction)', (o) => ev('first_transaction', o)),
    row('Tasa first open a verificación', (o) => fmtPct(div(m.appEvent('verification_completed', 'cur', o), m.appEvent('first_open', 'cur', o)))),
  ];

  const vr = m.d.versions.filter((r) => m.in(r.date) && m.osOk(r.os));
  const verRows = Array.from(groupBy(vr, (r) => `${r.version}|${r.os}`).entries())
    .map(([k, rs]) => {
      const [v, os] = k.split('|');
      const e = (n: string) => sum(rs.filter((r) => r.event === n), (r) => r.users);
      return { v, os, fo: e('first_open'), su: e('signup_success'), ve: e('verification_completed'), ft: e('first_transaction') };
    })
    .filter((x) => x.fo >= MIN_VERSION_USERS)
    .sort((a, b) => b.fo - a.fo)
    .map((x) => [x.v, x.os, fmtInt(x.fo), fmtPct(div(x.su, x.fo)), fmtPct(div(x.ve, x.su)), fmtPct(div(x.ft, x.ve))]);

  const days = eachDay(m.d.range.from, m.d.range.to);
  const eng = m.d.engage.filter((r) => m.in(r.date));
  const dauSeries = (['Android', 'iOS'] as const).filter((os) => m.osOk(os)).map((os) => ({
    name: os,
    color: os === 'Android' ? COLORS.blue : COLORS.pink,
    values: days.map((d) => eng.find((r) => r.date === d && r.os === os)?.dau ?? null),
  }));
  const engRows = (['Android', 'iOS'] as const).filter((os) => m.osOk(os)).map((os) => {
    const rs = eng.filter((r) => r.os === os);
    return [os, rs.length ? fmtInt(sum(rs, (r) => r.dau) / rs.length) : SD, fmtNum(div(sum(rs, (r) => r.minutes), sum(rs, (r) => r.dau)), 1)];
  });

  return (
    <div className="grid">
      <Section title="Resultados principales" sub="Eventos de negocio registrados por la app. Fuente de verdad del producto, no de atribución." />
      <Card title="Eventos de la app por sistema operativo">
        <OsTable rows={osRows} />
      </Card>

      <Section title="Detalle" />
      <Card title={`Funnel de onboarding (${m.os === 'todos' ? 'consolidado' : m.os})`} span={6} note="Usuarios únicos por paso; entre paréntesis, la conversión desde el paso anterior.">
        <HBars label="Funnel de onboarding" items={appFunnel(m, m.os)} />
      </Card>
      <Card
        title="Conversión por versión de app"
        span={6}
        note={`Versiones con al menos ${MIN_VERSION_USERS} usuarios nuevos en el período. Cada tasa compara con el paso anterior. Detecta si un release afectó la conversión.`}
      >
        <Table
          cols={[{ label: 'Versión', left: true }, { label: 'SO', left: true }, { label: 'Usuarios nuevos' }, { label: 'Registro' }, { label: 'Verificación' }, { label: 'Primera tx' }]}
          rows={verRows}
        />
      </Card>

      <Section title="Diagnóstico" sub={`Actividad diaria, disponible desde el ${ddmmyyyy(m.d.exportFrom)} con el export completo de Firebase.`} />
      <Card title="Usuarios activos por día y SO" span={8}>
        <LineChart label="Usuarios activos por día" labels={days.map(ddmm)} series={dauSeries} />
      </Card>
      <Card title="Engagement por SO" span={4}>
        <Table cols={[{ label: 'SO', left: true }, { label: 'Usuarios activos por día' }, { label: 'Minutos por usuario activo' }]} rows={engRows} />
      </Card>
    </div>
  );
}
