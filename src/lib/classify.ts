/** Reglas de negocio para clasificar filas. Ajustar acá si cambian las nomenclaturas. */
import type { OS } from './types';

/** Sistema operativo según el nombre de la campaña. */
export function osFromName(name: string | null | undefined): OS {
  const n = (name || '').toLowerCase();
  if (/\bandroid\b/.test(n)) return 'Android';
  if (/\bios\b/.test(n)) return 'iOS';
  return 'Sin definir';
}

/** Perfil de audiencia de Meta según el nombre del ad set. */
export function metaProfile(adset: string): string {
  const n = adset.toLowerCase();
  if (n.includes('inversionista')) return 'Inversionista';
  if (n.includes('freelancer')) return 'Freelancer';
  if (n.includes('viajero')) return 'Viajero';
  if (n.includes('ahorrador')) return 'Ahorrador';
  if (n.includes('academiadelexitoo')) return 'Academia del Éxito';
  if (n.includes('oro')) return 'ORO';
  return 'Abierta';
}

/** Agrupa copias del mismo anuncio bajo una sola creatividad. */
export function creativeKey(ad: string): string {
  return ad
    .replace(/\s*[-–]\s*(copia|copy)(\s*\d+)?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type ConvKind = 'install' | 'signup' | 'verification' | 'first_tx' | 'other';

/** Tipo de acción de conversión de Google Ads según su nombre. */
export function convKind(action: string): ConvKind {
  const n = action.toLowerCase();
  if (n.includes('first open') || n.includes('first_open') || n.includes('install')) return 'install';
  if (n.includes('verification')) return 'verification';
  if (n.includes('first_transaction') || n.includes('first transaction')) return 'first_tx';
  if (n.includes('signup') || n.includes('sign_up')) return 'signup';
  return 'other';
}

/** Red de Google Ads agrupada. */
export function networkGroup(n: string): 'Search' | 'YouTube' | 'Display' | 'Otras' {
  if (n === 'SEARCH' || n === 'SEARCH_PARTNERS') return 'Search';
  if (n === 'YOUTUBE' || n === 'YOUTUBE_SEARCH' || n === 'YOUTUBE_WATCH') return 'YouTube';
  if (n === 'CONTENT') return 'Display';
  return 'Otras';
}
