import { Model, groupBy, sum } from '@/lib/model';
import { SD, div, fmtInt, fmtMoney, fmtNum, fmtPct } from '@/lib/format';
import { metaProfile, osFromName } from '@/lib/classify';
import { ddmm, eachDay } from '@/lib/dates';
import type { MetaRow } from '@/lib/types';
import { Card, Note, OsTable, Section, Table } from '../ui';
import { COLORS, LineChart } from '../charts';

export default function Meta({ m }: { m: Model }) {
  const money = (v: number | null) => fmtMoney(v, m.cur, m.fx);
  const cur = m.d.meta.filter((r) => m.in(r.date));
  const forOs = (os: 'todos' | 'Android' | 'iOS') => cur.filter((r) => os === 'todos' || osFromName(r.campaign) === os);
  const visible = forOs(m.os);

  const sp = (os: 'todos' | 'Android' | 'iOS') => m.spendUsd('cur', { channel: 'Meta Ads', os });
  const osRows: Array<[string, string, string, string]> = [
    ['Inversión', money(sp('todos')), money(sp('Android')), money(sp('iOS'))],
    ['Verificaciones', SD, SD, SD],
    ['Costo por verificación (CPA)', SD, SD, SD],
    ['Primeras transacciones', SD, SD, SD],
    ['Costo por primera transacción', SD, SD, SD],
    ['Instalación a verificación', SD, SD, SD],
  ];

  const prof = groupBy(visible, (r) => `${metaProfile(r.adset)}|${osFromName(r.campaign)}`);
  const profRows = Array.from(prof.entries())
    .map(([k, rs]) => ({ k, s: sum(rs, (r) => r.spend), c: sum(rs, (r) => r.linkClicks) }))
    .sort((a, b) => b.s - a.s)
    .map(({ k, s, c }) => {
      const [p, os] = k.split('|');
      return [p, os, money(s), fmtInt(c), money(div(s, c)), SD, SD, SD, SD, SD];
    });

  const days = eachDay(m.d.range.from, m.d.range.to);
  const daily = (['Android', 'iOS'] as const).filter((os) => m.osOk(os)).map((os) => ({
    name: os,
    color: os === 'Android' ? COLORS.blue : COLORS.pink,
    values: days.map((d) => {
      const rs = cur.filter((r) => r.date === d && osFromName(r.campaign) === os);
      return rs.length ? sum(rs, (r) => r.spend) * (m.cur === 'COP' ? m.fx : 1) : null;
    }),
  }));

  const delivery = (label: string, rs: MetaRow[]) => {
    const s = sum(rs, (r) => r.spend), i = sum(rs, (r) => r.impressions), c = sum(rs, (r) => r.linkClicks);
    const byDay = groupBy(rs, (r) => r.date);
    const freqs = Array.from(byDay.values()).map((x) => div(sum(x, (r) => r.impressions), sum(x, (r) => r.reach))).filter((v): v is number => v !== null);
    const freq = freqs.length ? freqs.reduce((a, b) => a + b, 0) / freqs.length : null;
    return [label, money(div(s * 1000, i)), fmtPct(div(c, i), 2), money(div(s, c)), SD, freq === null ? SD : fmtNum(freq, 2)];
  };
  const delRows = [
    ...(['Android', 'iOS'] as const).filter((os) => m.osOk(os)).map((os) => delivery(os, forOs(os))),
    ...(m.os === 'todos' ? [delivery('Consolidado', forOs('todos'))] : []),
  ];

  return (
    <div className="grid">
      <div style={{ gridColumn: 'span 12' }}>
        <Note kind="empty">
          Los eventos de app (instalación, registro, verificación y primera transacción) todavía no llegan desde Meta por Windsor.
          Inversión y entrega están completas; el resto se completa cuando se agreguen esas acciones al conector.
        </Note>
      </div>
      <Section title="Resultados principales" sub="Consolidado y separado por campañas de Android e iOS. Sistema operativo según el nombre de la campaña." />
      <Card title="Resultados de Meta por sistema operativo">
        <OsTable rows={osRows} />
      </Card>

      <Section title="Detalle" sub="Qué perfiles de audiencia explican el resultado." />
      <Card title="Rendimiento por perfil de audiencia (ad set)" note="Perfil derivado del nombre del ad set. Ordenado por inversión. Incluye anuncios con inversión diaria de al menos USD 1.">
        <Table
          cols={[{ label: 'Perfil', left: true }, { label: 'SO', left: true }, { label: 'Inversión' }, { label: 'Clics de link' }, { label: 'CPC de link' }, { label: 'Instalaciones' }, { label: 'Verificaciones' }, { label: 'Costo por verif.' }, { label: 'Primeras tx' }, { label: 'Inst. a verif.' }]}
          rows={profRows}
        />
      </Card>
      <Card title={`Inversión por día y SO (${m.cur})`}>
        <LineChart label="Inversión por día y SO" labels={days.map(ddmm)} series={daily} />
      </Card>

      <Section title="Diagnóstico" sub="Explica por qué se mueve el CPA: costo de alcance, respuesta al anuncio e intención." />
      <Card title="Entrega y respuesta por SO" note="Frecuencia: promedio de la frecuencia diaria (el alcance no se suma entre días).">
        <Table
          cols={[{ label: 'SO', left: true }, { label: 'CPM' }, { label: 'CTR de link' }, { label: 'CPC de link' }, { label: 'Clic a instalación' }, { label: 'Frecuencia diaria' }]}
          rows={delRows}
          rowClass={(i) => (i === delRows.length - 1 && m.os === 'todos' ? 'sub' : undefined)}
        />
      </Card>
    </div>
  );
}
