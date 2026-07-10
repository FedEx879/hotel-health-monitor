'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const params = new URLSearchParams(window.location.search);
        const from = params.get('from') || '/';
        window.location.href = from.startsWith('/') ? from : '/';
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'No se pudo iniciar sesión.');
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--card, #fff)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 14,
          padding: 28,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}
      >
        <h1 style={{ fontSize: 20, margin: '0 0 4px', fontWeight: 700 }}>Hotel Health Monitor</h1>
        <p style={{ fontSize: 13, opacity: 0.7, margin: '0 0 20px' }}>Inicia sesión para continuar</p>

        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Usuario</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          autoComplete="username"
          style={inputStyle}
        />

        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', margin: '14px 0 4px' }}>Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          style={inputStyle}
        />

        {error && (
          <div style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            marginTop: 20,
            padding: '10px 14px',
            borderRadius: 10,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid var(--border, #d1d5db)',
  fontSize: 14,
  background: 'var(--bg, #fff)',
  color: 'inherit',
  boxSizing: 'border-box',
};
