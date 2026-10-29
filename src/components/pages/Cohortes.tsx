import { Model, groupBy, sum } from '@/lib/model';
import { div, fmtInt, fmtPct, SD } from '@/lib/format';
import { addDays, ddmm, ddmmyyyy, weekStart } from '@/lib/dates';
import type { CohortRow } from '@/lib/types';
import { Card, Note, Section, Table } from '../ui';
import { COLORS, LineChart } from '../charts';

const MIN_USERS = 20;

/** Tasa sobre las instalaciones que ya cumplieron N días. */
function rate(rows: CohortRow[], end: string | null, days: number, pick: (r: CohortRow) => number): number | null {
  if (!end) return null;
  const elig = rows.filter((r) => addDays(r.installDate, days) <= end);
  const n = sum(elig, (r) => r.installs);
  if (n < MIN_USERS) return null;
  return div(sum(elig, pick), n);
}

export default function Cohortes({ m }: { m: Model }) {
  const end = m.exportEnd();
  const rows = m.d.cohorts.filter((r) => m.in(r.installDate) && m.osOk(r.os));

  const byKey = groupBy(rows, (r) => `${weekStart(r.installDate)}|${r.channel}|${r.os}`);
  const cohortRows = Array.from(byKey.entries())
    .map(([k, rs]) => {
      const [wk, ch, os] = k.split('|');
      return { wk, ch, os, rs, installs: sum(rs, (r) => r.installs) };
    })
    .filter((x) => x.installs >= MIN_USERS)
    .sort((a, b) => (a.wk === b.wk ? b.installs - a.installs : a.wk < b.wk ? 1 : -1))
    .map((x) => [
      ddmm(x.wk), x.ch, x.os, fmtInt(x.installs),
      fmtPct(rate(x.rs, end, 6, (r) => r.su7)),
      fmtPct(rate(x.rs, end, 6, (r) => r.ve7)),
      fmtPct(rate(x.rs, end, 6, (r) => r.ft7)),
      fmtPct(rate(x.rs, end, 29, (r) => r.ft30)),
    ]);

  const byWeek = groupBy(rows, (r) => weekStart(r.installDate));
  const retRows = Array.from(byWeek.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([wk, rs]) => [
      ddmm(wk), fmtInt(sum(rs, (r) => r.installs)),
      fmtPct(rate(rs, end, 1, (r) => r.r1)),
      fmtPct(rate(rs, end, 7, (r) => r.r7)),
      fmtPct(rate(rs, end, 30, (r) => r.r30)),
    ]);

  const curve = (['Android', 'iOS'] as const)
    .filter((os) => m.osOk(os))
    .map((os) => {
      const rs = rows.filter((r) => r.os === os);
      return {
        name: os,
        color: os === 'Android' ? COLORS.blue : COLORS.pink,
        values: [
          rate(rs, end, 1, (r) => r.r1),
          rate(rs, end, 7, (r) => r.r7),
          rate(rs, end, 30, (r) => r.r30),
        ].map((v) => (v === null ? null : v * 100)),
      };
    });

  const exportFrom = m.d.exportFrom;
  const partial = m.d.range.from < exportFrom;

  return (
    <div className="grid">
      <div style={{ gridColumn: 'span 12' }}>
        <Note>
          Cohortes calculadas con el export diario de Firebase (completo desde el {ddmmyyyy(exportFrom)}) y el canal de la primera fuente del usuario.
          Una tasa D7 o D30 aparece recién cuando la cohorte cumplió esos días.
          {partial && ' Las instalaciones anteriores a esa fecha no entran en esta página.'}
        </Note>
      </div>
      <Section title="Resultados principales" sub="Eventos de negocio dentro de los primeros 7 y 30 días desde la instalación." />
      <Card
        title="Eventos por cohorte, canal y SO"
        note={`Se muestran combinaciones con al menos ${MIN_USERS} instalaciones. En iOS la mayoría de los usuarios llega sin fuente (Directo / sin atribuir).`}
      >
        <Table
          cols={[{ label: 'Cohorte (semana)', left: true }, { label: 'Canal', left: true }, { label: 'SO', left: true }, { label: 'Instalaciones' }, { label: 'Registro D7' }, { label: 'Verif. D7' }, { label: 'Primera tx D7' }, { label: 'Primera tx D30' }]}
          rows={cohortRows}
        />
      </Card>

      <Section title="Detalle" />
      <Card
        title="Retención por cohorte semanal"
        span={6}
        note={`Usuarios que abren la app exactamente N días después de instalar. Cada tasa necesita al menos ${MIN_USERS} usuarios que ya cumplieron esos días.`}
      >
        <Table cols={[{ label: 'Cohorte', left: true }, { label: 'Instalaciones' }, { label: 'D1' }, { label: 'D7' }, { label: 'D30' }]} rows={retRows} />
      </Card>
      <Card title="Curva de retención por SO (%)" span={6}>
        {curve.some((s) => s.values.some((v) => v !== null)) ? (
          <LineChart label="Curva de retención por SO" labels={['D1', 'D7', 'D30']} series={curve} height={240} format={(v) => `${Math.round(v)}%`} />
        ) : (
          <p className="cnote">{SD}: las cohortes del período todavía no cumplieron los días necesarios.</p>
        )}
      </Card>
    </div>
  );
}
