import 'server-only';
import { BigQuery } from '@google-cloud/bigquery';
import { config } from './config';

let client: BigQuery | null = null;

/** Cliente de BigQuery. Solo se usa del lado del servidor. */
export function bigquery(): BigQuery {
  if (client) return client;
  const email = process.env.GCP_CLIENT_EMAIL;
  const key = process.env.GCP_PRIVATE_KEY;
  const keyFile = process.env.BIGQUERY_CREDENTIALS_PATH;
  if (email && key) {
    client = new BigQuery({
      projectId: config.projectId,
      credentials: { client_email: email, private_key: key.replace(/\\n/g, '\n') },
    });
  } else if (keyFile) {
    client = new BigQuery({ projectId: config.projectId, keyFilename: keyFile });
  } else {
    // Credenciales por defecto de la máquina (gcloud auth application-default login)
    client = new BigQuery({ projectId: config.projectId });
  }
  return client;
}

type Params = Record<string, string | number | string[]>;

/** Ejecuta una consulta parametrizada y devuelve filas planas (fechas como YYYY-MM-DD, números como number). */
export async function runQuery<T>(query: string, params: Params): Promise<T[]> {
  const [rows] = await bigquery().query({ query, params, location: config.location });
  return rows.map((r: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) out[k] = normalize(v);
    return out as T;
  });
}

function normalize(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    const o = v as { value?: unknown; constructor?: { name?: string } };
    // BigQueryDate, BigQueryTimestamp, Big (BIGNUMERIC) exponen .value o toString()
    if ('value' in o && (typeof o.value === 'string' || typeof o.value === 'number')) {
      const s = String(o.value);
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : isNumeric(s) ? Number(s) : s;
    }
    const s = String(v);
    if (isNumeric(s)) return Number(s);
    return s;
  }
  return v;
}

function isNumeric(s: string): boolean {
  return /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(s);
}
