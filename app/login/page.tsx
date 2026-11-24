'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function post(path: string, body: object) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  }

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const { ok, data } = await post('/api/login/request-code', { email });
      if (!ok) {
        setError(data.error || 'Could not send the code.');
        return;
      }
      setInfo(data.message || 'Check Slack for your code.');
      setCode('');
      setStep('code');
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { ok, data } = await post('/api/login/verify', { email, code });
      if (ok) {
        const from = new URLSearchParams(window.location.search).get('from') || '/';
        // Only same-site paths ("//host" would leave the site).
        window.location.href = from.startsWith('/') && !from.startsWith('//') ? from : '/';
        return;
      }
      setError(data.error || 'Could not sign in.');
    } catch {
      setError('Connection error. Please try again.');
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
      <form onSubmit={step === 'email' ? requestCode : verify} style={cardStyle}>
        <h1 style={{ fontSize: 20, margin: '0 0 4px', fontWeight: 700, color: '#fff' }}>Inn-Flow Procurement - Hotel Health Monitor</h1>
        <p style={{ fontSize: 13, opacity: 0.85, margin: '0 0 20px', color: '#fff' }}>
          {step === 'email'
            ? 'Sign in with your Inn-Flow email. We will send you a code in Slack.'
            : `Enter the 6-digit code sent to you in Slack.`}
        </p>

        {step === 'email' ? (
          <>
            <label style={labelStyle}>Work email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@inn-flow.com"
              autoFocus
              autoComplete="email"
              required
              style={inputStyle}
            />
          </>
        ) : (
          <>
            {info && <div style={{ fontSize: 13, marginBottom: 12, opacity: 0.9 }}>{info}</div>}
            <label style={labelStyle}>Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              style={{ ...inputStyle, letterSpacing: 6, fontSize: 18, textAlign: 'center' }}
            />
          </>
        )}

        {error && <div style={{ color: '#fee2e2', fontSize: 13, marginTop: 12, fontWeight: 600 }}>{error}</div>}

        <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Please wait…' : step === 'email' ? 'Send code' : 'Sign in'}
        </button>

        {step === 'code' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 13 }}>
            <button type="button" onClick={() => { setStep('email'); setError(''); }} style={linkStyle}>
              Use another email
            </button>
            <button type="button" onClick={() => requestCode()} disabled={loading} style={linkStyle}>
              Send a new code
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 360,
  background: '#0d9488',
  border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: 14,
  padding: 28,
  boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
  color: '#fff',
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  display: 'block',
  marginBottom: 4,
  color: '#fff',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.4)',
  fontSize: 14,
  background: 'rgba(255,255,255,0.12)',
  color: '#fff',
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 20,
  padding: '10px 14px',
  borderRadius: 10,
  border: 'none',
  background: '#fff',
  color: '#0d9488',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};

const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: '#fff',
  textDecoration: 'underline',
  cursor: 'pointer',
  fontSize: 13,
};
