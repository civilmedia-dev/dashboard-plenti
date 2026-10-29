import { Model, OSES, PAID } from '@/lib/model';
import { SD, div, fmtInt, fmtMoney, fmtPct } from '@/lib/format';
import { Card, Section, Table, type Cell } from '../ui';
import { COLORS, HBars } from '../charts';
import type { OsFilter } from '@/lib/types';

export function appFunnel(m: Model, os: OsFilter) {
  const steps: Array<[string, Parameters<Model['appEvent']>[0], string]> = [
    ['Instalaciones (first_open)', 'first_open', COLORS.blue],
    ['Registro iniciado', 'signup_started', COLORS.tint],
    ['Registro completado', 'signup_success', COLORS.violet],
    ['Verificación', 'verification_completed', COLORS.pink],
    ['Primera transacción', 'first_transaction', COLORS.green],
  ];
  const vals = steps.map(([, ev]) => m.appEvent(ev, 'cur', os));
  return steps.map(([label, , color], i) => ({
    label,
    value: vals[i],
    color,
    text: i === 0 ? fmtInt(vals[i]) : `${fmtInt(vals[i])} (${fmtPct(div(vals[i], vals[i - 1]))})`,
  }));
}

export default function Funnel({ m }: { m: Model }) {
  const money = (v: number | null) => fmtMoney(v, m.cur, m.fx);
  const oses = m.os === 'todos' ? OSES : [m.os];
  const rows: Cell[][] = [];
  const instVerif: Array<{ label: string; value: number | null; text: string; color: string }> = [];
  const ecpi: Array<{ label: string; value: number | null; text: string; color: string }> = [];

  for (const ch of PAID) {
    for (const os of oses) {
      const s = m.spendUsd('cur', { channel: ch, os });
      const isG = ch === 'Google Ads';
      const inst = isG ? m.googleConv('install', 'cur', os) : null;
      const su = isG ? m.googleConv('signup', 'cur', os) : null;
      const v = isG ? m.googleConv('verification', 'cur', os) : null;
      const f = isG ? m.googleConv('first_tx', 'cur', os) : null;
      rows.push([ch, os, fmtPct(div(su, inst)), fmtPct(div(v, su)), fmtPct(div(f, v)), fmtPct(div(v, inst)),
        money(s > 0 ? div(s, inst) : null), money(s > 0 ? div(s, v) : null), money(s > 0 ? div(s, f) : null)]);
      const iv = div(v, inst);
      instVerif.push({ label: `${ch} ${os}`, value: iv, text: iv === null ? SD : fmtPct(iv), color: os === 'Android' ? COLORS.blue : COLORS.pink });
      const e = s > 0 ? div(s, inst) : null;
      ecpi.push({ label: `${ch} ${os}`, value: e, text: e === null ? SD : money(e), color: os === 'Android' ? COLORS.blue : COLORS.pink });
    }
  }
  for (const os of oses) {
    const s = m.spendUsd('cur', { os });
    const fo = m.appEvent('first_open', 'cur', os);
    const su = m.appEvent('signup_success', 'cur', os);
    const v = m.appEvent('verification_completed', 'cur', os);
    const f = m.appEvent('first_transaction', 'cur', os);
    rows.push(['Total app (Firebase)', os, fmtPct(div(su, fo)), fmtPct(div(v, su)), fmtPct(div(f, v)), fmtPct(div(v, fo)),
      money(div(s, fo)), money(div(s, v)), money(div(s, f))]);
    const iv = div(v, fo);
    instVerif.push({ label: `Total app ${os}`, value: iv, text: fmtPct(iv), color: COLORS.green });
    const e = div(s, fo);
    ecpi.push({ label: `Total app ${os}`, value: e, text: money(e), color: COLORS.green });
  }

  return (
    <div className="grid">
      <Section title="Resultados principales" sub="Tasas y costos de cada etapa por canal y sistema operativo." />
      <Card
        title="Funnel por canal y sistema operativo"
        note="Google Ads y Meta Ads: conversiones según cada plataforma. Total app: todos los usuarios según Firebase, con la inversión paga total del sistema operativo. Las etapas sin acción de conversión en la plataforma aparecen como s/d."
      >
        <Table
          cols={[{ label: 'Canal', left: true }, { label: 'SO', left: true }, { label: 'Inst. a registro' }, { label: 'Registro a verif.' }, { label: 'Verif. a primera tx' }, { label: 'Inst. a verif.' }, { label: 'Costo por inst.' }, { label: 'Costo por verif.' }, { label: 'Costo por primera tx' }]}
          rows={rows}
        />
      </Card>

      <Section title="Detalle" />
      <Card title={`Funnel de la app (${m.os === 'todos' ? 'consolidado' : m.os})`} span={6} note="Firebase. Entre paréntesis, la conversión desde la etapa anterior.">
        <HBars label="Funnel de la app" items={appFunnel(m, m.os)} />
      </Card>
      <Card title="Instalación a verificación por canal y SO" span={6}>
        <HBars label="Instalación a verificación" items={instVerif} labelWidth={150} />
      </Card>

      <Section title="Diagnóstico" sub="Costo de la parte alta del funnel." />
      <Card title={`eCPI (costo por instalación) por canal y SO, ${m.cur}`} note="Leer junto al costo por verificación: un eCPI bajo con poca verificación indica tráfico de baja calidad.">
        <HBars label="eCPI por canal y SO" items={ecpi} labelWidth={150} />
      </Card>
    </div>
  );
}
