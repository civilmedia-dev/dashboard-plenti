import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: 'Falta configurar DASHBOARD_PASSWORD en el servidor.' }, { status: 500 });
  }
  let password = '';
  try {
    const body = (await req.json()) as { password?: string };
    password = String(body.password ?? '');
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }
  // Pequeña demora para frenar intentos repetidos
  await new Promise((r) => setTimeout(r, 400));
  if (password !== expected) {
    return NextResponse.json({ error: 'Contraseña incorrecta.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
