import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface Props {
  children: (session: Session) => ReactNode;
}

export function AuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => { setSession(data.session); })
      .catch((e) => { console.error('[AuthGate] getSession failed:', e); })
      .finally(() => { setChecking(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div dir="rtl" className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <>{children(session)}</>;
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    setLoading(false);
  };

  return (
    <div dir="rtl" className="flex items-center justify-center min-h-screen p-4" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl p-8 space-y-5"
        style={{
          background: 'var(--card-surface)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Kalpack Storage</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>התחברות למערכת</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>אימייל</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            dir="ltr"
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>סיסמה</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            dir="ltr"
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>

        {error && (
          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, var(--accent-strong) 0%, var(--accent) 100%)' }}
        >
          {loading ? 'מתחבר…' : 'התחבר'}
        </button>
      </form>
    </div>
  );
}

/** Sign the current user out. Use from a logout button. */
export async function signOut() {
  await supabase.auth.signOut();
}
