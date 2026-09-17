import { useState } from 'react';
import { UserPlus, KeyRound, Trash2, Check, X, UserCog } from 'lucide-react';
import { useFetch } from '../lib/useFetch.js';
import { api } from '../api.js';
import { Spinner, Empty } from '../components/ui.jsx';
import { fmtClock } from '../lib/format.js';

export default function Users() {
  const { data, loading, reload } = useFetch('/users', []);
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pwFor, setPwFor] = useState(null);
  const [pwValue, setPwValue] = useState('');

  const users = data?.users || [];
  const me = data?.me;

  async function addUser(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/users', { method: 'POST', body: { username: newUser, password: newPass } });
      setNewUser(''); setNewPass('');
      reload();
    } catch (err) {
      setError(err.data?.message
        || ({ username_taken: 'That username is already taken.', weak_password: 'Password must be at least 6 characters.' }[err.data?.error])
        || 'Could not create user.');
    } finally { setBusy(false); }
  }

  async function changePassword(id) {
    setError('');
    try {
      await api(`/users/${id}`, { method: 'PATCH', body: { password: pwValue } });
      setPwFor(null); setPwValue('');
    } catch (err) {
      setError(err.data?.message || 'Could not change password (min 6 characters).');
    }
  }

  async function removeUser(id, username) {
    if (!confirm(`Delete dashboard user "${username}"? They will lose access immediately.`)) return;
    setError('');
    try {
      await api(`/users/${id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      setError({ cannot_delete_self: 'You cannot delete your own account.', last_admin: 'You cannot delete the last remaining user.' }[err.data?.error]
        || 'Could not delete user.');
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-[var(--color-muted)]">Accounts that can sign in to this dashboard</p>
      </div>

      <form onSubmit={addUser} className="card p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><UserPlus size={18} /> Add a user</h2>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="label">Username</label>
            <input className="input w-48" value={newUser} onChange={(e) => setNewUser(e.target.value)}
              autoComplete="off" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input w-48" type="password" value={newPass}
              onChange={(e) => setNewPass(e.target.value)} autoComplete="new-password" />
          </div>
          <button className="btn btn-primary" disabled={busy || !newUser || !newPass}>
            <UserPlus size={16} /> Create
          </button>
        </div>
        {error && <div className="text-sm text-red-400 mt-3">{error}</div>}
      </form>

      {loading && !data ? <Spinner /> : users.length === 0 ? (
        <div className="card"><Empty>No users.</Empty></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <UserCog size={16} className="text-[var(--color-brand)]" />
                      <span className="font-medium">{u.username}</span>
                      {u.id === me && <span className="chip" style={{ background: '#1e293b', color: '#94a3b8' }}>you</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{fmtClock(u.created_at)}</td>
                  <td className="px-4 py-3">
                    {pwFor === u.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <input className="input py-1 w-44" type="password" placeholder="New password"
                          value={pwValue} autoFocus onChange={(e) => setPwValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && changePassword(u.id)} />
                        <button className="btn py-1 px-2" onClick={() => changePassword(u.id)}><Check size={15} /></button>
                        <button className="btn py-1 px-2" onClick={() => { setPwFor(null); setPwValue(''); }}><X size={15} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 justify-end">
                        <button className="btn py-1 px-2" onClick={() => { setPwFor(u.id); setPwValue(''); setError(''); }}>
                          <KeyRound size={14} /> Password
                        </button>
                        <button className="btn btn-danger py-1 px-2" disabled={u.id === me}
                          onClick={() => removeUser(u.id, u.username)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
