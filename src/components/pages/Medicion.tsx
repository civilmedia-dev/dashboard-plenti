import { Model, sum } from '@/lib/model';
import { div, fmtInt, fmtPct, SD } from '@/lib/format';
import { osFromName } from '@/lib/classify';
import type { AppEventName, Channel } from '@/lib/types';
import { Card, Note, Section, Table } from '../ui';
import { COLORS, HBars } from '../charts';

const CHANNELS: Channel[] = ['Google Ads', 'Meta Ads', 'X Ads', 'Orgánico', 'Directo / sin atribuir'];
const ALERT_PP = 20;

export default function Medicion({ m }: { m: Model }) {
  const src = m.d.sources.filter((r) => m.in(r.date));
  const by = (os: 'Android' | 'iOS', ev: AppEventName, ch?: Channel) =>
    sum(src.filter((r) => r.os === os && r.event === ev && (!ch || r.channel === ch)), (r) => r.users);

  const share = (os: 'Android' | 'iOS') => div(by(os, 'signup_success', 'Google Ads'), by(os, 'signup_success'));
  const sA = share('Android'), sI = share('iOS');
  const gap = sA !== null && sI !== null ? Math.abs(sA - sI) * 100 : null;

  const oses = (['Android', 'iOS'] as const).filter((os) => m.osOk(os));
  const events: Array<[string, AppEventName, Parameters<Model['googleConv']>[0] | null]> = [
    ['Instalación (first_open)', 'first_open', 'install'],
    ['Registro (signup_success)', 'signup_success', 'signup'],
    ['Verificación', 'verification_completed', 'verification'],
    ['Primera transacción', 'first_transaction', 'first_tx'],
  ];
  const cmpRows = events.flatMap(([label, ev, kind]) => oses.map((os) => [
    label, os, fmtInt(m.appEvent(ev, 'cur', os)), SD, SD, kind ? fmtInt(m.googleConv(kind, 'cur', os)) : SD, SD,
  ]));

  const vTot = { Android: by('Android', 'verification_completed'), iOS: by('iOS', 'verification_completed') };
  const srcRows = CHANNELS.map((ch) => [
    ch,
    fmtInt(by('Android', 'verification_completed', ch)), fmtPct(div(by('Android', 'verification_completed', ch), vTot.Android)),
    fmtInt(by('iOS', 'verification_completed', ch)), fmtPct(div(by('iOS', 'verification_completed', ch), vTot.iOS)),
  ]);

  const iosCampaigns = [
    ...Array.from(new Set(m.d.meta.filter((r) => m.in(r.date) && osFromName(r.campaign) === 'iOS').map((r) => r.campaign))).map((c) => ['Meta', c]),
    ...Array.from(new Set(m.d.googleDaily.filter((r) => m.in(r.date) && osFromName(r.campaign) === 'iOS').map((r) => r.campaign))).map((c) => ['Google', c]),
  ];
  const skanRows = (iosCampaigns.length ? iosCampaigns : [['s/d', 's/d']]).map(([n, c]) => [n, c, SD, SD, SD]);

  return (
    <div className="grid">
      {gap !== null && gap > ALERT_PP && (
        <div style={{ gridColumn: 'span 12' }}>
          <Note kind="empty">
            Alerta de atribución: la parte de registros que GA4 asigna a Google Ads difiere en {Math.round(gap)} puntos entre Android e iOS.
            {(sI ?? 0) < (sA ?? 0) && ' En iOS casi todo llega como directo, por eso las conversiones importadas a Google Ads quedan subrepresentadas.'}
          </Note>
        </div>
      )}
      <Section title="Resultados principales" sub={`Alertas de atribución por sistema operativo. GA4 con datos completos desde el ${m.d.exportFrom.split('-').reverse().join('/')}.`} />
      <Card
        title="% de registros atribuidos a Google Ads (GA4)"
        span={5}
        note={`Primera fuente del usuario google / cpc sobre el total de signup_success. Alerta si la diferencia entre SO supera ${ALERT_PP} pp.`}
      >
        <HBars
          label="Registros atribuidos a Google Ads"
          labelWidth={80}
          max={1}
          items={[
            { label: 'Android', value: sA, text: fmtPct(sA), color: COLORS.blue },
            { label: 'iOS', value: sI, text: fmtPct(sI), color: COLORS.pink },
          ]}
        />
      </Card>
      <Card
        title="Mismo evento según cada fuente"
        span={7}
        note="Diferencias grandes indican problemas de tracking o de mapeo de eventos. Meta: eventos de app pendientes en Windsor. X: el conector trae solo inversión y clics. Singular: pendiente de conexión."
      >
        <Table
          cols={[{ label: 'Evento', left: true }, { label: 'SO', left: true }, { label: 'Firebase' }, { label: 'Singular' }, { label: 'Meta' }, { label: 'Google Ads' }, { label: 'X' }]}
          rows={cmpRows}
        />
      </Card>

      <Section title="Detalle" sub="De dónde viene cada verificación según GA4." />
      <Card title="Verificaciones por primera fuente del usuario" span={6}>
        <Table
          cols={[{ label: 'Primera fuente (canal)', left: true }, { label: 'Android: verif.' }, { label: 'Android: %' }, { label: 'iOS: verif.' }, { label: 'iOS: %' }]}
          rows={srcRows}
        />
      </Card>
      <Card title="SKAdNetwork (iOS)" span={6} note="Se completa con el reporte SKAN de Singular.">
        <Table
          cols={[{ label: 'Red', left: true }, { label: 'Campaña', left: true }, { label: 'Instalaciones SKAN' }, { label: 'Conversion value más frecuente' }, { label: 'Postbacks con evento' }]}
          rows={skanRows}
        />
      </Card>
    </div>
  );
}
