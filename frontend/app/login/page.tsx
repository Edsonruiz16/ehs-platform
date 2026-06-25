'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@ehs.local');
  const [password, setPassword] = useState('Admin123*');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-brand-dark to-brand">
      <form onSubmit={onSubmit} className="card w-[380px] space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-2 h-12 w-12 rounded-xl bg-brand grid place-items-center text-white font-bold text-xl">
            EHS
          </div>
          <h1 className="text-xl font-semibold text-ink">EHS Platform</h1>
          <p className="text-sm text-muted">Seguridad Industrial · Medio Ambiente · Salud</p>
        </div>

        {error && <div className="badge bg-red-100 text-red-700 w-full justify-center py-2">{error}</div>}

        <div>
          <label className="text-sm text-slate-600">Correo</label>
          <input className="input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>
        <div>
          <label className="text-sm text-slate-600">Contraseña</label>
          <input
            className="input mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </div>

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
        <p className="text-xs text-center text-muted">Demo: admin@ehs.local / Admin123*</p>
      </form>
    </div>
  );
}
