/** Sesión simple por contraseña. Funciona en el edge (middleware) y en Node. */

export const SESSION_COOKIE = 'plenti_session';

export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`plenti-dashboard:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw || !cookieValue) return false;
  return cookieValue === (await sessionToken(pw));
}
