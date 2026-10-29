export type OS = 'Android' | 'iOS' | 'Sin definir';
export type OsFilter = 'todos' | 'Android' | 'iOS';
export type Currency = 'USD' | 'COP';

export type Channel = 'Google Ads' | 'Meta Ads' | 'X Ads' | 'Orgánico' | 'Directo / sin atribuir';

export interface DateRange {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
}

export interface MetaRow {
  date: string;
  campaign: string;
  adset: string;
  ad: string;
  spend: number; // USD
  impressions: number;
  linkClicks: number;
  reach: number;
}

export interface MetaAdStart {
  campaign: string;
  ad: string;
  firstDate: string;
}

export interface GoogleDailyRow {
  date: string;
  campaignId: string;
  campaign: string;
  network: string;
  cost: number; // moneda de la cuenta (COP)
  clicks: number;
  impressions: number;
}

export interface GoogleConvRow {
  date: string;
  campaignId: string;
  campaign: string;
  action: string;
  conversions: number;
}

export interface GoogleCampaign {
  campaignId: string;
  name: string;
  status: string;
  budget: number | null; // diario, moneda de la cuenta
  targetCpa: number | null;
}

export interface XRow {
  date: string;
  campaign: string;
  spend: number; // COP
  clicks: number;
}

export type AppEventName =
  | 'first_open'
  | 'signup_started'
  | 'signup_success'
  | 'verification_completed'
  | 'first_transaction';

export interface AppEventRow {
  date: string;
  os: 'Android' | 'iOS';
  event: AppEventName;
  users: number;
}

export interface CohortRow {
  installDate: string;
  os: 'Android' | 'iOS';
  channel: Channel;
  installs: number;
  su7: number;
  ve7: number;
  ft7: number;
  ft30: number;
  r1: number;
  r7: number;
  r30: number;
}

export interface VersionRow {
  date: string;
  os: 'Android' | 'iOS';
  version: string;
  event: AppEventName;
  users: number;
}

export interface EngageRow {
  date: string;
  os: 'Android' | 'iOS';
  dau: number;
  minutes: number;
}

export interface SourceRow {
  date: string;
  os: 'Android' | 'iOS';
  channel: Channel;
  event: AppEventName;
  users: number;
}

export interface Payload {
  range: DateRange;
  fx: number;
  googleCurrency: string;
  exportFrom: string;
  generatedAt: string;
  meta: MetaRow[];
  metaStarts: MetaAdStart[];
  googleDaily: GoogleDailyRow[];
  googleConv: GoogleConvRow[];
  googleCampaigns: GoogleCampaign[];
  x: XRow[];
  events: AppEventRow[];
  cohorts: CohortRow[];
  versions: VersionRow[];
  engage: EngageRow[];
  sources: SourceRow[];
}
