import 'server-only';
import { config } from './config';

const P = config.projectId;
const W = `\`${P}.${config.windsorDataset}`;
const G = `\`${P}.${config.googleAdsDataset}`;
const C = `\`${P}.${config.curatedDataset}`;
const GA = `\`${P}.${config.ga4Dataset}.events_*\``;
const CID = config.googleAdsCustomerId.replace(/\D/g, '');

/**
 * Parámetros comunes:
 *  @start / @end: rango completo pedido (período anterior + período actual), DATE en texto YYYY-MM-DD
 *  @exportFrom: primer día con export completo de GA4
 */

/** Canal según la primera fuente del usuario en GA4. */
const CHANNEL_SQL = (src: string, med: string) => `CASE
  WHEN LOWER(IFNULL(${src},''))='google' AND LOWER(IFNULL(${med},''))='cpc' THEN 'Google Ads'
  WHEN REGEXP_CONTAINS(LOWER(IFNULL(${src},'')), r'facebook|instagram|meta') THEN 'Meta Ads'
  WHEN REGEXP_CONTAINS(LOWER(IFNULL(${src},'')), r'twitter|^x$|t[.]co') THEN 'X Ads'
  WHEN LOWER(IFNULL(${med},''))='organic' THEN 'Orgánico'
  ELSE 'Directo / sin atribuir' END`;

const EXPORT_SUFFIX = `_TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', GREATEST(DATE(@start), DATE(@exportFrom))) AND FORMAT_DATE('%Y%m%d', DATE(@end))`;
const OS_SQL = `IF(platform='IOS','iOS','Android')`;

export const SQL = {
  /** Meta Ads por día y anuncio. Solo anuncios con inversión diaria de al menos USD 1. */
  meta: `
    SELECT CAST(date AS STRING) AS date, campaign, adset_name AS adset, ad_name AS ad,
      CAST(SUM(f.spend) AS FLOAT64) AS spend,
      CAST(SUM(f.impressions) AS FLOAT64) AS impressions,
      CAST(SUM(f.link_clicks) AS FLOAT64) AS linkClicks,
      CAST(SUM(f.reach) AS FLOAT64) AS reach
    FROM ${W}.facebook_ads_all\` AS f
    WHERE account_name = @metaAccount AND date BETWEEN DATE(@start) AND DATE(@end)
    GROUP BY 1, 2, 3, 4
    HAVING SUM(f.spend) >= 1`,

  /** Primer día con inversión de cada anuncio de Meta (para "días al aire"). */
  metaStarts: `
    SELECT campaign, ad_name AS ad, CAST(MIN(date) AS STRING) AS firstDate
    FROM ${W}.facebook_ads_all\`
    WHERE account_name = @metaAccount AND spend > 0 AND date <= DATE(@end)
    GROUP BY 1, 2`,

  googleCurrency: `
    SELECT ARRAY_AGG(customer_currency_code ORDER BY _DATA_DATE DESC LIMIT 1)[OFFSET(0)] AS currency
    FROM ${G}.ads_Customer_${CID}\``,

  /** Google Ads por día, campaña y red. */
  googleDaily: `
    WITH names AS (
      SELECT campaign_id, ARRAY_AGG(campaign_name ORDER BY _DATA_DATE DESC LIMIT 1)[OFFSET(0)] AS name
      FROM ${G}.ads_Campaign_${CID}\` GROUP BY 1)
    SELECT CAST(s.segments_date AS STRING) AS date, CAST(s.campaign_id AS STRING) AS campaignId, n.name AS campaign,
      s.segments_ad_network_type AS network,
      SUM(s.metrics_cost_micros) / 1e6 AS cost,
      SUM(s.metrics_clicks) AS clicks,
      SUM(s.metrics_impressions) AS impressions
    FROM ${G}.ads_CampaignBasicStats_${CID}\` s
    JOIN names n USING (campaign_id)
    WHERE s.segments_date BETWEEN DATE(@start) AND DATE(@end)
    GROUP BY 1, 2, 3, 4
    HAVING cost > 0 OR impressions > 0`,

  /** Google Ads: conversiones por día, campaña y acción de conversión (cada acción por separado). */
  googleConv: `
    WITH names AS (
      SELECT campaign_id, ARRAY_AGG(campaign_name ORDER BY _DATA_DATE DESC LIMIT 1)[OFFSET(0)] AS name
      FROM ${G}.ads_Campaign_${CID}\` GROUP BY 1)
    SELECT CAST(s.segments_date AS STRING) AS date, CAST(s.campaign_id AS STRING) AS campaignId, n.name AS campaign,
      s.segments_conversion_action_name AS action,
      SUM(s.metrics_conversions) AS conversions
    FROM ${G}.ads_CampaignConversionStats_${CID}\` s
    JOIN names n USING (campaign_id)
    WHERE s.segments_date BETWEEN DATE(@start) AND DATE(@end)
    GROUP BY 1, 2, 3, 4
    HAVING conversions > 0`,

  /** Estado actual de campañas de Google Ads: presupuesto diario y CPA objetivo de los grupos activos. */
  googleCampaigns: `
    WITH camp AS (
      SELECT campaign_id,
        ARRAY_AGG(STRUCT(campaign_name, campaign_status, campaign_budget_amount_micros) ORDER BY _DATA_DATE DESC LIMIT 1)[OFFSET(0)] AS c
      FROM ${G}.ads_Campaign_${CID}\` GROUP BY 1),
    ag AS (
      SELECT ad_group_id,
        ARRAY_AGG(STRUCT(campaign_id, ad_group_status, ad_group_effective_target_cpa_micros) ORDER BY _DATA_DATE DESC LIMIT 1)[OFFSET(0)] AS a
      FROM ${G}.ads_AdGroup_${CID}\` GROUP BY 1),
    tcpa AS (
      SELECT a.campaign_id, AVG(a.ad_group_effective_target_cpa_micros) AS t
      FROM ag WHERE a.ad_group_status = 'ENABLED' AND a.ad_group_effective_target_cpa_micros > 0 GROUP BY 1)
    SELECT CAST(camp.campaign_id AS STRING) AS campaignId, camp.c.campaign_name AS name, camp.c.campaign_status AS status,
      camp.c.campaign_budget_amount_micros / 1e6 AS budget, tcpa.t / 1e6 AS targetCpa
    FROM camp LEFT JOIN tcpa USING (campaign_id)
    WHERE camp.c.campaign_status = 'ENABLED'`,

  /** X Ads por día y campaña (inversión en COP). */
  x: `
    SELECT CAST(date AS STRING) AS date, campaign,
      CAST(SUM(spend) AS FLOAT64) AS spend, CAST(SUM(clicks) AS FLOAT64) AS clicks
    FROM ${W}.twitterAds_campaigns_ads\`
    WHERE account_name = @xAccount AND date BETWEEN DATE(@start) AND DATE(@end)
    GROUP BY 1, 2
    HAVING spend > 0 OR clicks > 0`,

  /**
   * Eventos de negocio de la app por día y SO (usuarios únicos por día).
   * Desde @exportFrom se usa el export diario de Firebase; antes, la vista resumen de la API de GA4.
   */
  events: `
    WITH ex AS (
      SELECT CAST(PARSE_DATE('%Y%m%d', event_date) AS STRING) AS date, ${OS_SQL} AS os, event_name AS event,
        COUNT(DISTINCT user_pseudo_id) AS users
      FROM ${GA}
      WHERE ${EXPORT_SUFFIX} AND platform IN ('ANDROID','IOS') AND event_name IN UNNEST(@events)
      GROUP BY 1, 2, 3),
    sm AS (
      SELECT CAST(event_date AS STRING) AS date, platform AS os, event_name AS event, SUM(total_users) AS users
      FROM ${C}.plenti_ga4_event_summary_60d\`
      WHERE event_date BETWEEN DATE(@start) AND DATE(@end) AND event_date < DATE(@exportFrom)
        AND platform IN ('Android','iOS') AND event_name IN UNNEST(@events)
      GROUP BY 1, 2, 3)
    SELECT * FROM ex UNION ALL SELECT * FROM sm`,

  /** Cohortes por día de instalación, SO y canal (export de Firebase). */
  cohorts: `
    WITH base AS (
      SELECT user_pseudo_id AS u, ${OS_SQL} AS os, PARSE_DATE('%Y%m%d', event_date) AS d, event_name AS ev,
        traffic_source.source AS src, traffic_source.medium AS med
      FROM ${GA}
      WHERE ${EXPORT_SUFFIX} AND platform IN ('ANDROID','IOS')
        AND event_name IN ('first_open','signup_success','verification_completed','first_transaction','user_engagement','session_start')),
    fo AS (SELECT u, os, MIN(d) AS d, ANY_VALUE(src) AS src, ANY_VALUE(med) AS med FROM base WHERE ev = 'first_open' GROUP BY 1, 2),
    firsts AS (SELECT u, ev, MIN(d) AS d FROM base WHERE ev IN ('signup_success','verification_completed','first_transaction') GROUP BY 1, 2),
    act AS (SELECT DISTINCT u, d FROM base WHERE ev IN ('user_engagement','session_start')),
    per_user AS (
      SELECT fo.u, fo.os, fo.d, ${CHANNEL_SQL('fo.src', 'fo.med')} AS channel,
        MAX(IF(f.ev='signup_success' AND DATE_DIFF(f.d, fo.d, DAY) BETWEEN 0 AND 6, 1, 0)) AS su7,
        MAX(IF(f.ev='verification_completed' AND DATE_DIFF(f.d, fo.d, DAY) BETWEEN 0 AND 6, 1, 0)) AS ve7,
        MAX(IF(f.ev='first_transaction' AND DATE_DIFF(f.d, fo.d, DAY) BETWEEN 0 AND 6, 1, 0)) AS ft7,
        MAX(IF(f.ev='first_transaction' AND DATE_DIFF(f.d, fo.d, DAY) BETWEEN 0 AND 29, 1, 0)) AS ft30
      FROM fo LEFT JOIN firsts f USING (u) GROUP BY 1, 2, 3, 4),
    ret AS (
      SELECT p.u, p.d,
        MAX(IF(a.d = DATE_ADD(p.d, INTERVAL 1 DAY), 1, 0)) AS r1,
        MAX(IF(a.d = DATE_ADD(p.d, INTERVAL 7 DAY), 1, 0)) AS r7,
        MAX(IF(a.d = DATE_ADD(p.d, INTERVAL 30 DAY), 1, 0)) AS r30
      FROM per_user p LEFT JOIN act a ON a.u = p.u AND a.d > p.d GROUP BY 1, 2)
    SELECT CAST(p.d AS STRING) AS installDate, p.os, p.channel, COUNT(*) AS installs,
      SUM(su7) AS su7, SUM(ve7) AS ve7, SUM(ft7) AS ft7, SUM(ft30) AS ft30,
      SUM(r.r1) AS r1, SUM(r.r7) AS r7, SUM(r.r30) AS r30
    FROM per_user p JOIN ret r USING (u, d)
    GROUP BY 1, 2, 3`,

  /** Usuarios por versión de app, SO y evento. */
  versions: `
    SELECT CAST(PARSE_DATE('%Y%m%d', event_date) AS STRING) AS date, ${OS_SQL} AS os,
      IFNULL(app_info.version, 's/d') AS version, event_name AS event, COUNT(DISTINCT user_pseudo_id) AS users
    FROM ${GA}
    WHERE ${EXPORT_SUFFIX} AND platform IN ('ANDROID','IOS')
      AND event_name IN ('first_open','signup_success','verification_completed','first_transaction')
    GROUP BY 1, 2, 3, 4`,

  /** Usuarios activos y minutos de uso por día y SO. */
  engage: `
    SELECT CAST(PARSE_DATE('%Y%m%d', event_date) AS STRING) AS date, ${OS_SQL} AS os,
      COUNT(DISTINCT user_pseudo_id) AS dau,
      SUM((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'engagement_time_msec')) / 60000 AS minutes
    FROM ${GA}
    WHERE ${EXPORT_SUFFIX} AND platform IN ('ANDROID','IOS') AND event_name = 'user_engagement'
    GROUP BY 1, 2`,

  /** Eventos por primera fuente del usuario (atribución GA4). */
  sources: `
    SELECT CAST(PARSE_DATE('%Y%m%d', event_date) AS STRING) AS date, ${OS_SQL} AS os,
      ${CHANNEL_SQL('traffic_source.source', 'traffic_source.medium')} AS channel,
      event_name AS event, COUNT(DISTINCT user_pseudo_id) AS users
    FROM ${GA}
    WHERE ${EXPORT_SUFFIX} AND platform IN ('ANDROID','IOS')
      AND event_name IN ('first_open','signup_success','verification_completed','first_transaction')
    GROUP BY 1, 2, 3, 4`,
};
