import { useState } from 'react';
import { Activity } from 'lucide-react';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await login(username, password);
    } catch (err) {
      setError(err.status === 401 ? 'Invalid username or password.' : 'Login failed. Check the server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="rounded-lg bg-[var(--color-brand)] p-2"><Activity size={22} className="text-white" /></div>
          <div className="text-2xl font-semibold tracking-tight">Pulse</div>
        </div>
        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="label">Username</label>
            <input className="input" value={username} autoFocus
              onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error && <div className="text-sm text-red-400">{error}</div>}
          <button className="btn btn-primary w-full justify-center" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-xs text-[var(--color-muted)] mt-4">
          Pulse admin dashboard
        </p>
      </div>
    </div>
  );
}
