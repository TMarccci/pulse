import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Map, MonitorSmartphone, Settings as SettingsIcon,
  Activity, LogOut, Users as UsersIcon, Github, Globe, Mail, Heart,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { UpdateBanner } from './UpdateBanner.jsx';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/office', label: 'Office', icon: Map },
  { to: '/devices', label: 'Devices', icon: MonitorSmartphone },
  { to: '/users', label: 'Users', icon: UsersIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function AuthorCredit() {
  return (
    <div className="px-1 pb-3 mb-3 border-b border-[var(--color-border)]">
      <div className="text-[11px] text-[var(--color-muted)] flex items-center gap-1">
        Made with <Heart size={11} className="text-rose-500 fill-rose-500" /> by
        <span className="text-[var(--color-text)] font-medium">TMarccci</span>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[var(--color-muted)]">
        <a href="https://github.com/TMarccci/pulse" target="_blank" rel="noreferrer"
          title="GitHub repository" className="hover:text-[var(--color-text)]"><Github size={16} /></a>
        <a href="https://tmarccci.hu" target="_blank" rel="noreferrer"
          title="tmarccci.hu" className="hover:text-[var(--color-text)]"><Globe size={16} /></a>
        <a href="mailto:contact@tmarccci.hu"
          title="contact@tmarccci.hu" className="hover:text-[var(--color-text)]"><Mail size={16} /></a>
      </div>
    </div>
  );
}

function SessionCountdown({ expiresAt }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, (expiresAt || 0) - Math.floor(Date.now() / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  if (!expiresAt) return null;
  const m = Math.floor(left / 60);
  const s = left % 60;
  const low = left < 120;
  return (
    <span className={`text-xs font-mono ${low ? 'text-amber-400' : 'text-[var(--color-muted)]'}`}
      title="Session / CSRF token expiry">
      session {m}:{String(s).padStart(2, '0')}
    </span>
  );
}

export default function Layout() {
  const { user, logout, expiresAt } = useAuth();
  return (
    <div className="flex h-full">
      <aside className="w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2">
          <div className="rounded-lg bg-[var(--color-brand)] p-1.5"><Activity size={18} className="text-white" /></div>
          <div className="font-semibold text-lg tracking-tight">Pulse</div>
        </div>
        <nav className="px-3 flex flex-col gap-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition
                 ${isActive ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'}`}
            >
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto p-3 border-t border-[var(--color-border)]">
          <AuthorCredit />
          <div className="text-xs text-[var(--color-muted)] mb-2 px-1">
            Signed in as <span className="text-[var(--color-text)]">{user?.username}</span>
          </div>
          <button className="btn w-full justify-center" onClick={logout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-[var(--color-border)] flex items-center justify-end gap-4 px-6 bg-[var(--color-surface)]">
          <SessionCountdown expiresAt={expiresAt} />
        </header>
        <UpdateBanner />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
