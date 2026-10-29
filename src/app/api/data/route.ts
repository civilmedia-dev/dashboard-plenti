import { NextResponse, type NextRequest } from 'next/server';
import { getDashboardData } from '@/server/data';
import { SESSION_COOKIE, isValidSession } from '@/lib/auth';
import { ISO_RE, daysBetween } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!(await isValidSession(req.cookies.get(SESSION_COOKIE)?.value))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const from = req.nextUrl.searchParams.get('from') ?? '';
  const to = req.nextUrl.searchParams.get('to') ?? '';
  if (!ISO_RE.test(from) || !ISO_RE.test(to) || from > to) {
    return NextResponse.json({ error: 'Rango de fechas inválido.' }, { status: 400 });
  }
  if (daysBetween(from, to) > 120) {
    return NextResponse.json({ error: 'El período no puede superar 120 días.' }, { status: 400 });
  }
  try {
    const data = await getDashboardData(from, to);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, max-age=600' } });
  } catch (err) {
    console.error('[api/data]', err);
    return NextResponse.json(
      { error: 'No se pudieron leer los datos de BigQuery. Revisá las credenciales y los permisos de la service account.' },
      { status: 502 },
    );
  }
}
