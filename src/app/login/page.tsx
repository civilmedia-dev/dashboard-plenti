'use client';

import { useState, type FormEvent } from 'react';
import ThemeToggle from '@/components/ThemeToggle';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(body.error || 'No se pudo iniciar sesión.');
        return;
      }
      window.location.href = '/';
    } catch {
      setMsg('Sin conexión con el servidor. Intentá de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-theme"><ThemeToggle /></div>
      <form onSubmit={submit}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Civil Mafia" className="logo" width={120} height={34} />
        <h1>Plenti | Performance</h1>
        <p>Ingresá la contraseña para ver el dashboard.</p>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus required />
        </label>
        <div className="msg" role="alert">{msg}</div>
        <button type="submit" disabled={busy || !password}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
